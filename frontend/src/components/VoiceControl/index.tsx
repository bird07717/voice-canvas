import { useState, useEffect, useRef } from 'react'
import { Button, Space, message, Tag } from 'antd'
import {
  AudioMutedOutlined,
  AudioOutlined,
  DownOutlined,
  PictureOutlined,
  ReloadOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { useVoiceStore } from '@/stores/voiceStore'
import { useLLMStore } from '@/stores/llmStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { voiceService } from '@/services/voiceService'
import { apiService } from '@/services/api'
import { PENDING_TARGET, matchFastCommand, matchTemplateSceneShortcut } from '@/services/fastCommandMatcher'
import { ResolveAction, resolveObjectTarget } from '@/services/objectResolver'
import {
  buildMoveByUpdates,
  buildMoveToUpdates,
  buildScaleAroundCenterUpdates,
  getObjectBounds as getResolvedObjectBounds,
} from '@/services/transformEngine'
import { CanvasCommandContext, CanvasObject, DrawCommand } from '@/types'
import './VoiceControl.css'

type VoiceControlProps = {
  onSave?: () => Promise<boolean> | boolean
  onExport?: () => Promise<boolean> | boolean
}

type CommandExecutionResult = {
  success: boolean
  message: string
}

type CommandExecutionOptions = {
  deferHistory?: boolean
}

type PendingDisambiguation = {
  commands: DrawCommand[]
  candidates: string[]
  userText: string
  interpretation: string
  createdAt: number
}

type PreparedCommandsResult =
  | { status: 'ready'; commands: DrawCommand[] }
  | { status: 'pending' }
  | { status: 'error'; message: string }

const getLLMRouteLabel = (route?: string, llmUsed?: boolean) => {
  switch (route) {
    case 'local_object':
      return '本地素材/模板'
    case 'template_scene':
      return '固定模板'
    case 'template_scene_patch':
      return llmUsed ? '模板 + LLM补丁' : '固定模板，补丁未启用'
    case 'open_scene':
      return 'LLM SVG整图'
    case 'tool_plan':
      return 'LLM工具规划'
    case 'requires_llm':
      return '需要LLM'
    default:
      return ''
  }
}

const getSceneGenerationStatus = (response: { scene?: any; commands: DrawCommand[] }, routeLabel: string) => {
  if (!response.scene) return ''

  const objectCount = response.scene.object_count || response.commands.length
  const base = `执行状态：${routeLabel || '场景生成'}，已生成 ${objectCount} 个对象`
  if (response.scene.source === 'llm_svg_scene_fallback') {
    return `${base}；AI SVG 生成失败，已使用本地兜底图`
  }
  if (response.scene.repaired) {
    return `${base}；首轮 SVG 校验失败，已自动修复`
  }
  return base
}

const SCENE_SHORTCUTS = [
  { title: '海边日落', tone: '暖阳海面' },
  { title: '公园', tone: '草地长椅' },
  { title: '生日贺卡', tone: '蛋糕礼物' },
  { title: '城市夜景', tone: '楼宇车流' },
  { title: '森林小屋', tone: '树木小屋' },
  { title: '山水风景', tone: '远山河流' },
  { title: '教室', tone: '黑板课桌' },
  { title: '温馨客厅', tone: '沙发窗景' },
  { title: '桌面工作区', tone: '电脑书桌' },
  { title: '节日派对', tone: '彩带灯笼' },
]
const COLLAPSED_SCENE_COUNT = 5
const DISAMBIGUATION_TIMEOUT_MS = 30000
const INTERIM_TEMPLATE_SCENE_COOLDOWN_MS = 1500

const translateSceneObject = (obj: CanvasObject, dx: number, dy: number): CanvasObject => {
  const params = { ...(obj.params || {}) }

  if (Array.isArray(params.points)) {
    params.points = params.points.map((point: number, index: number) =>
      index % 2 === 0 ? point + dx : point + dy
    )
  } else {
    params.x = (params.x || 0) + dx
    params.y = (params.y || 0) + dy
  }

  return {
    ...obj,
    params,
    children: obj.children?.map((child) => translateSceneObject(child, dx, dy)),
  }
}

const applySceneObjectParams = (obj: CanvasObject, updates: any): CanvasObject => {
  let nextObject = obj

  if (typeof updates?.dx === 'number' || typeof updates?.dy === 'number') {
    nextObject = translateSceneObject(nextObject, updates.dx || 0, updates.dy || 0)
  }

  const scale = typeof updates?.scale_delta === 'number'
    ? updates.scale_delta
    : typeof updates?.scale === 'number'
      ? updates.scale
      : null

  if (scale && scale > 0) {
    nextObject = scaleSceneObject(nextObject, scale)
  }

  const filteredUpdates = Object.fromEntries(
    Object.entries(updates || {}).filter(([key]) => !['dx', 'dy', 'scale', 'scale_delta'].includes(key))
  )
  const params = { ...(nextObject.params || {}), ...filteredUpdates }
  const styleKeys = ['fill', 'stroke', 'strokeWidth', 'opacity']
  const styleUpdates = Object.fromEntries(
    Object.entries(filteredUpdates || {}).filter(([key]) => styleKeys.includes(key))
  )

  if (nextObject.type !== 'group' || Object.keys(styleUpdates).length === 0) {
    return { ...nextObject, params }
  }

  return {
    ...nextObject,
    params,
    children: nextObject.children?.map((child) => applySceneObjectParams(child, styleUpdates)),
  }
}

const scaleSceneObject = (obj: CanvasObject, scale: number): CanvasObject => {
  const params = { ...(obj.params || {}) }

  if (typeof params.width === 'number') params.width = Math.max(8, params.width * scale)
  if (typeof params.height === 'number') params.height = Math.max(8, params.height * scale)
  if (typeof params.radius === 'number') params.radius = Math.max(6, params.radius * scale)
  if (typeof params.innerRadius === 'number') params.innerRadius = Math.max(4, params.innerRadius * scale)
  if (typeof params.outerRadius === 'number') params.outerRadius = Math.max(6, params.outerRadius * scale)
  if (typeof params.fontSize === 'number') params.fontSize = Math.max(10, params.fontSize * scale)

  return {
    ...obj,
    params,
    children: obj.children?.map((child) => scaleSceneObject(child, scale)),
  }
}

export default function VoiceControl({ onSave, onExport }: VoiceControlProps) {
  const [scenesExpanded, setScenesExpanded] = useState(false)
  const {
    isListening,
    status,
    recognizedText,
    interpretedText,
    executionMessage,
    errorMessage,
    lastCommandSource,
    recognitionType,
    baiduConfig,
    setIsListening,
    setRecognizedText,
    setInterpretedText,
    setExecutionMessage,
    setErrorMessage,
    setLastCommandSource,
    resetVoiceFeedback,
    setStatus,
    setRecognitionType
  } = useVoiceStore()
  const { activeConfig, setIsProcessing, setChatHistory, addChatMessage } = useLLMStore()
  const {
    addObject,
    replaceSceneObjects,
    updateObject,
    removeObject,
    clearCanvas,
    undo,
    redo,
    recordCommands,
    setSelectedObjectId,
    setDisambiguationCandidates,
    clearDisambiguationCandidates,
  } = useCanvasStore()
  const [isStarting, setIsStarting] = useState(false)
  const lastFinalTextRef = useRef('')
  const lastFinalTimeRef = useRef(0)
  const lastInterimTemplateSceneRef = useRef<{ normalizedText: string; time: number } | null>(null)
  const commandSequenceRef = useRef(0)
  const pendingDisambiguationRef = useRef<PendingDisambiguation | null>(null)

  useEffect(() => {
    // 初始化语音服务
    const initVoice = async () => {
      if (baiduConfig) {
        await voiceService.initialize(baiduConfig)
        const type = voiceService.getRecognitionType()
        setRecognitionType(type)
      }
    }
    initVoice()
  }, [baiduConfig, setRecognitionType])

  const handleStartVoice = async () => {
    if (!voiceService.isSupported()) {
      setStatus('error')
      setErrorMessage('您的浏览器不支持语音识别')
      message.error('您的浏览器不支持语音识别')
      return
    }

    setIsStarting(true)
    setIsListening(true)
    setStatus('listening')
    setExecutionMessage('正在听...')
    setErrorMessage('')

    try {
      // 初始化语音服务（带百度配置）
      if (baiduConfig) {
        await voiceService.initialize(baiduConfig)
      }

      const type = voiceService.getRecognitionType()
      setRecognitionType(type)

      await voiceService.startListening(
        (text, isFinal) => {
          setRecognizedText(text)
          setErrorMessage('')
          setStatus('recognizing')
          setExecutionMessage(isFinal ? '正在匹配命令...' : '正在识别...')
          if (!isFinal) {
            const shortcut = matchTemplateSceneShortcut(text)
            const now = Date.now()
            if (
              shortcut &&
              (
                lastInterimTemplateSceneRef.current?.normalizedText !== shortcut.normalizedText ||
                now - lastInterimTemplateSceneRef.current.time > INTERIM_TEMPLATE_SCENE_COOLDOWN_MS
              )
            ) {
              lastInterimTemplateSceneRef.current = {
                normalizedText: shortcut.normalizedText,
                time: now,
              }
              lastFinalTextRef.current = shortcut.canonicalText
              lastFinalTimeRef.current = now
              setExecutionMessage(`快速识别到${shortcut.title}模板，正在生成...`)
              handleVoiceCommand(shortcut.canonicalText)
              return
            }
          }
          if (isFinal) {
            const normalizedText = text.trim()
            const shortcut = matchTemplateSceneShortcut(normalizedText)
            const finalCommandText = shortcut?.canonicalText || normalizedText
            const now = Date.now()
            if (
              finalCommandText &&
              (finalCommandText !== lastFinalTextRef.current || now - lastFinalTimeRef.current > 2000)
            ) {
              lastFinalTextRef.current = finalCommandText
              lastFinalTimeRef.current = now
              handleVoiceCommand(finalCommandText)
            }
          }
        },
        (error) => {
          console.error('语音识别错误:', error)
          const nextError = '语音识别出错: ' + (error.message || error)
          setErrorMessage(nextError)
          setExecutionMessage('')
          setStatus('error')
          setIsListening(false)
          message.error(nextError)
        }
      )
      setRecognitionType(voiceService.getRecognitionType())
    } catch (error: any) {
      const nextError = '启动语音识别失败: ' + (error.message || error)
      setErrorMessage(nextError)
      setExecutionMessage('')
      setStatus('error')
      setIsListening(false)
      message.error(nextError)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopVoice = () => {
    voiceService.stopListening()
    setIsListening(false)
    const currentStatus = useVoiceStore.getState().status
    if (!['thinking', 'drawing', 'matched'].includes(currentStatus)) {
      setStatus('idle')
      setExecutionMessage('')
    }
  }

  const handleResetVoice = () => {
    commandSequenceRef.current += 1
    pendingDisambiguationRef.current = null
    lastInterimTemplateSceneRef.current = null
    clearDisambiguationCandidates()
    voiceService.stopListening()
    setIsListening(false)
    resetVoiceFeedback()
    setStatus('idle')
  }

  const handleVoiceCommand = async (text: string) => {
    const canvasState = useCanvasStore.getState()
    if (!canvasState.currentCanvasId || !text.trim()) return
    const commandSequence = commandSequenceRef.current + 1
    commandSequenceRef.current = commandSequence
    const isCurrentCommand = () => commandSequenceRef.current === commandSequence

    const canvasContext = buildCanvasContext()

    if (pendingDisambiguationRef.current) {
      const completed = handleDisambiguationReply(text)
      if (completed) return
    }

    const fastCommand = matchFastCommand(text, canvasContext)

    if (fastCommand.matched) {
      setLastCommandSource('fast')
      setInterpretedText(fastCommand.interpretation || '')

      if (fastCommand.needsDisambiguation && fastCommand.pendingCommands?.length) {
        const candidates = (fastCommand.candidates || [])
          .map((candidate) => candidate.objectId)
          .filter(Boolean)

        if (candidates.length) {
          pendingDisambiguationRef.current = {
            commands: fastCommand.pendingCommands,
            candidates,
            userText: text,
            interpretation: fastCommand.interpretation || '确认目标对象',
            createdAt: Date.now(),
          }
          setDisambiguationCandidates(candidates)
          setStatus('matched')
          setErrorMessage('')
          setExecutionMessage(fastCommand.message || buildDisambiguationPrompt(candidates))
          return
        }
      }

      if (fastCommand.errorMessage) {
        setStatus('error')
        setErrorMessage(fastCommand.errorMessage)
        setExecutionMessage('')
        return
      }

      setStatus('matched')
      setExecutionMessage(fastCommand.message || '快速匹配成功')

      try {
        if (fastCommand.controlAction) {
          const completed = await executeControlAction(fastCommand.controlAction)
          if (!completed) return
          appendLocalChat(text, fastCommand.message || fastCommand.interpretation || '已完成', [])
          if (!isCurrentCommand()) return
          setStatus('done')
          setExecutionMessage(fastCommand.message || '已完成')
          return
        }

        if (fastCommand.commands?.length) {
          clearPendingDisambiguation()
          setStatus('drawing')
          const result = executeCommands(fastCommand.commands)
          if (!result.success) {
            setStatus('error')
            setErrorMessage(result.message)
            setExecutionMessage('')
            return
          }
          recordCommands(fastCommand.commands)
          appendLocalChat(text, result.message || fastCommand.message || fastCommand.interpretation || '已完成', fastCommand.commands)
          setStatus('done')
          setExecutionMessage(result.message || fastCommand.message || '已完成')
          return
        }
      } catch (error: any) {
        setStatus('error')
        setErrorMessage(error.message || '快速命令执行失败')
        setExecutionMessage('')
        return
      }
    }

    const resolvedActiveConfig = activeConfig

    setStatus('thinking')
    setLastCommandSource('llm')
    setInterpretedText('后端智能路由正在理解。')
    setExecutionMessage('正在匹配本地素材、场景模板或 AI 规划...')
    setIsProcessing(true)

    try {
      const response = await apiService.processVoiceCommand({
        canvas_id: canvasState.currentCanvasId,
        text: text.trim(),
        llm_config_id: resolvedActiveConfig?.id,
        canvas_context: canvasContext,
      })

      if (!isCurrentCommand()) {
        return
      }

      if (response.intent === 'ignore') {
        setStatus('done')
        setExecutionMessage('已忽略无效语音')
        return
      }

      const routeLabel = getLLMRouteLabel(response.llm_route, response.llm_used)

      if (response.chat_history.length > 0) {
        setChatHistory(response.chat_history)
        notifyChatHistoryUpdated(canvasState.currentCanvasId)
      }

      if (response.intent === 'clarify') {
        if (response.response) {
          setExecutionMessage(response.response)
        }
        setStatus('done')
        return
      }

      if (response.needs_disambiguation && response.disambiguation?.commands?.length) {
        const candidates = (response.disambiguation.candidates || [])
          .map((candidate) => candidate.objectId)
          .filter(Boolean)

        if (candidates.length) {
          if (response.scene) {
            const sceneSetupCommands = response.commands.filter((command) => command.action === 'create')
            const setupResult = await executeSceneCommands(sceneSetupCommands)
            if (!setupResult.success) {
              setStatus('error')
              setErrorMessage(setupResult.message)
              setExecutionMessage('')
              return
            }
            recordCommands(sceneSetupCommands)
          }

          pendingDisambiguationRef.current = {
            commands: response.disambiguation.commands,
            candidates,
            userText: text,
            interpretation: response.disambiguation.interpretation || response.response || '确认目标对象',
            createdAt: Date.now(),
          }
          setDisambiguationCandidates(candidates)
          setStatus('matched')
          setIsProcessing(false)
          setErrorMessage('')
          setExecutionMessage(buildDisambiguationPrompt(candidates))
          return
        }
      }

      setStatus('drawing')
      if (response.commands.length > 0) {
        const prepared = response.scene
          ? { status: 'ready' as const, commands: response.commands }
          : prepareCommandsWithTargetQueries(
              response.commands,
              canvasContext,
              text,
              response.response || 'AI 编辑命令'
            )
        if (prepared.status === 'pending') {
          setStatus('matched')
          setIsProcessing(false)
          return
        }
        if (prepared.status === 'error') {
          setStatus('error')
          setErrorMessage(prepared.message)
          setExecutionMessage('')
          return
        }

        const result = response.scene
          ? await executeSceneCommands(prepared.commands)
          : executeCommands(prepared.commands)
        if (!result.success) {
          setStatus('error')
          setErrorMessage(result.message)
          setExecutionMessage('')
          return
        }
        recordCommands(prepared.commands)
      }
      if (response.response) {
        setInterpretedText(
          response.scene
            ? `理解为：${response.scene.title}场景${routeLabel ? `（${routeLabel}）` : ''}`
            : response.response
        )
      }
      setStatus('done')
      setExecutionMessage(
        response.scene
          ? getSceneGenerationStatus(response, routeLabel)
          : response.response || '已完成'
      )
    } catch (error: any) {
      if (!isCurrentCommand()) {
        return
      }
      setStatus('error')
      setErrorMessage(error.response?.data?.detail || '处理命令失败')
      setExecutionMessage('')
    } finally {
      if (isCurrentCommand()) {
        setIsProcessing(false)
      }
    }
  }

  const executeSceneCommands = async (commands: DrawCommand[]): Promise<CommandExecutionResult> => {
    let lastCreatedId: string | null = null
    let sceneObjects = commands
      .reduce<CanvasObject[]>((objects, command) => {
        if (command.action !== 'create' || !command.type || !command.id) return objects
        lastCreatedId = command.id
        objects.push({
          id: command.id,
          type: command.type,
          params: command.params || {},
          children: command.children,
        })
        return objects
      }, [])

    if (sceneObjects.length === 0) {
      return {
        success: false,
        message: '没有可执行的场景命令',
      }
    }

    for (const command of commands) {
      if (command.action === 'modify' && command.target && command.params) {
        const targetId = resolveSceneCommandTarget(command.target, lastCreatedId, sceneObjects)
        if (targetId) {
          sceneObjects = sceneObjects.map((obj) =>
            obj.id === targetId ? applySceneObjectParams(obj, command.params) : obj
          )
        }
      }

      if (command.action === 'delete' && command.target) {
        const targetId = resolveSceneCommandTarget(command.target, lastCreatedId, sceneObjects)
        if (targetId) {
          sceneObjects = sceneObjects.filter((obj) => obj.id !== targetId)
        }
      }

      if (command.action === 'moveBy' && command.target && command.params) {
        const targetId = resolveSceneCommandTarget(command.target, lastCreatedId, sceneObjects)
        if (targetId) {
          sceneObjects = sceneObjects.map((obj) =>
            obj.id === targetId
              ? translateSceneObject(obj, command.params?.dx || 0, command.params?.dy || 0)
              : obj
          )
        }
      }
    }

    setExecutionMessage(`正在替换场景：${sceneObjects.length} 个对象`)
    replaceSceneObjects(sceneObjects)

    return {
      success: true,
      message: `已完成：生成 ${sceneObjects.length} 个场景对象`,
    }
  }

  const resolveSceneCommandTarget = (
    target: string,
    lastCreatedId: string | null,
    sceneObjects: CanvasObject[]
  ) => {
    if (target === '__last__') return lastCreatedId || sceneObjects[sceneObjects.length - 1]?.id || null

    if (target.startsWith('__kind__:')) {
      const kind = target.replace('__kind__:', '').toLowerCase()
      const matched = [...sceneObjects]
        .reverse()
        .find((obj) => obj.type?.toLowerCase() === kind || obj.params?.kind?.toLowerCase() === kind)
      return matched?.id || null
    }

    return sceneObjects.some((obj) => obj.id === target) ? target : null
  }

  const appendLocalChat = (userText: string, assistantText: string, commands: DrawCommand[]) => {
    const now = new Date().toISOString()
    addChatMessage({
      role: 'user',
      content: userText,
      created_at: now,
    })
    addChatMessage({
      role: 'assistant',
      content: assistantText,
      command_json: {
        intent: 'fast',
        confidence: 1,
        commands,
      },
      created_at: now,
    })
  }

  const notifyChatHistoryUpdated = (canvasId: number | null) => {
    window.dispatchEvent(
      new CustomEvent('voice-canvas:chat-history-updated', {
        detail: { canvasId },
      })
    )
  }

  const clearPendingDisambiguation = () => {
    pendingDisambiguationRef.current = null
    clearDisambiguationCandidates()
  }

  const prepareCommandsWithTargetQueries = (
    commands: DrawCommand[],
    context: CanvasCommandContext,
    userText: string,
    interpretation: string
  ): PreparedCommandsResult => {
    const preparedCommands: DrawCommand[] = []

    for (const [index, command] of commands.entries()) {
      if (!command.targetQuery) {
        preparedCommands.push(command)
        continue
      }

      const action = getResolveActionForCommand(command)
      const result = resolveObjectTarget(
        {
          ...command.targetQuery,
          rawText: command.targetQuery.rawText || userText,
        },
        context,
        {
          allowContextFallback: false,
          action,
        }
      )

      if (result.status === 'ambiguous' && result.candidates?.length) {
        const candidates = result.candidates.map((candidate) => candidate.objectId).filter(Boolean)
        pendingDisambiguationRef.current = {
          commands: [
            ...preparedCommands,
            {
              ...command,
              target: PENDING_TARGET,
              targetQuery: undefined,
            },
            ...commands.slice(index + 1),
          ],
          candidates,
          userText,
          interpretation,
          createdAt: Date.now(),
        }
        setDisambiguationCandidates(candidates)
        setErrorMessage('')
        setExecutionMessage(buildDisambiguationPrompt(candidates))
        return { status: 'pending' }
      }

      if (result.status !== 'resolved' || !result.objectId) {
        return {
          status: 'error',
          message: '没有找到 AI 命令要修改的对象，请换一种更明确的说法。',
        }
      }

      preparedCommands.push({
        ...command,
        target: result.objectId,
        targetQuery: undefined,
      })
    }

    return { status: 'ready', commands: preparedCommands }
  }

  const getResolveActionForCommand = (command: DrawCommand): ResolveAction => {
    if (command.action === 'delete') return 'delete'
    if (command.action === 'move' || command.action === 'moveBy') return 'move'
    if (command.action === 'scale') return 'scale'
    if (command.action === 'select') return 'select'
    if (command.action === 'modify') {
      if (command.params && ('fill' in command.params || 'stroke' in command.params)) {
        return 'recolor'
      }
      return 'edit'
    }
    return 'edit'
  }

  const handleDisambiguationReply = (text: string) => {
    const pending = pendingDisambiguationRef.current
    if (!pending) return false

    if (Date.now() - pending.createdAt > DISAMBIGUATION_TIMEOUT_MS) {
      clearPendingDisambiguation()
      return false
    }

    const targetId = resolveDisambiguationTarget(text, pending.candidates)
    if (!targetId) {
      if (/取消|重说|算了|不用/.test(text)) {
        clearPendingDisambiguation()
        setStatus('idle')
        setExecutionMessage('已取消目标确认')
        setErrorMessage('')
        return true
      }

      setStatus('matched')
      setErrorMessage('')
      setExecutionMessage(buildDisambiguationPrompt(pending.candidates))
      return true
    }

    const resolvedCommands = replacePendingTarget(pending.commands, targetId)
    const prepared = prepareCommandsWithTargetQueries(
      resolvedCommands,
      buildCanvasContext(),
      `${pending.userText}；确认：${text}`,
      pending.interpretation
    )
    if (prepared.status === 'pending') return true
    if (prepared.status === 'error') {
      clearPendingDisambiguation()
      setStatus('error')
      setErrorMessage(prepared.message)
      setExecutionMessage('')
      return true
    }

    clearPendingDisambiguation()
    setLastCommandSource('fast')
    setInterpretedText(`${pending.interpretation}：已确认目标`)
    setStatus('drawing')

    const result = executeCommands(prepared.commands)
    if (!result.success) {
      setStatus('error')
      setErrorMessage(result.message)
      setExecutionMessage('')
      return true
    }

    recordCommands(prepared.commands)
    appendLocalChat(
      `${pending.userText}；确认：${text}`,
      result.message || '已完成',
      prepared.commands
    )
    setStatus('done')
    setExecutionMessage(result.message || '已完成')
    return true
  }

  const buildDisambiguationPrompt = (candidateIds: string[]) =>
    `找到 ${candidateIds.length} 个可能对象，请说第几个、左边那个或右边那个。`

  const normalizeReplyText = (text: string) =>
    text.trim().replace(/[，。！？、,.!?:：\s]/g, '')

  const resolveDisambiguationTarget = (text: string, candidateIds: string[]) => {
    const normalized = normalizeReplyText(text)
    const state = useCanvasStore.getState()

    const selectedCandidate = state.selectedObjectId && candidateIds.includes(state.selectedObjectId)
      ? state.selectedObjectId
      : null
    if (/^(这个|当前|选中|就这个|是这个)$/.test(normalized) && selectedCandidate) {
      return selectedCandidate
    }

    const ordinalIndex = parseOrdinalIndex(normalized)
    if (ordinalIndex !== null && candidateIds[ordinalIndex]) {
      return candidateIds[ordinalIndex]
    }

    const candidateObjects = candidateIds
      .map((id) => {
        const obj = state.canvasObjects.find((item) => item.id === id)
        const bounds = obj ? getObjectBounds(obj) : null
        return obj && bounds
          ? {
              id,
              centerX: bounds.x + bounds.width / 2,
              centerY: bounds.y + bounds.height / 2,
              area: bounds.width * bounds.height,
            }
          : null
      })
      .filter(Boolean) as Array<{ id: string; centerX: number; centerY: number; area: number }>

    if (!candidateObjects.length) return null

    if (/左边|左侧|最左/.test(normalized)) {
      return [...candidateObjects].sort((a, b) => a.centerX - b.centerX)[0]?.id || null
    }
    if (/右边|右侧|最右/.test(normalized)) {
      return [...candidateObjects].sort((a, b) => b.centerX - a.centerX)[0]?.id || null
    }
    if (/上面|上边|顶部|最上/.test(normalized)) {
      return [...candidateObjects].sort((a, b) => a.centerY - b.centerY)[0]?.id || null
    }
    if (/下面|下边|底部|最下/.test(normalized)) {
      return [...candidateObjects].sort((a, b) => b.centerY - a.centerY)[0]?.id || null
    }
    if (/最大|大的/.test(normalized)) {
      return [...candidateObjects].sort((a, b) => b.area - a.area)[0]?.id || null
    }
    if (/最小|小的/.test(normalized)) {
      return [...candidateObjects].sort((a, b) => a.area - b.area)[0]?.id || null
    }

    return null
  }

  const parseOrdinalIndex = (text: string) => {
    const digitMatch = text.match(/第?([1-5一二三四五])个?/)
    const raw = digitMatch?.[1]
    if (!raw) return null

    const map: Record<string, number> = {
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3,
      '5': 4,
      一: 0,
      二: 1,
      三: 2,
      四: 3,
      五: 4,
    }
    return map[raw] ?? null
  }

  const replacePendingTarget = (commands: DrawCommand[], targetId: string): DrawCommand[] =>
    commands.map((command) => ({
      ...command,
      target: command.target === PENDING_TARGET ? targetId : command.target,
      children: command.children,
      params: command.params,
    }))

  const buildCanvasContext = (): CanvasCommandContext => {
    const state = useCanvasStore.getState()

    return {
      objects: state.canvasObjects.slice(-30).map((obj: CanvasObject) => summarizeCanvasObject(obj)),
      lastCreatedObjectId: state.lastCreatedObjectId,
      lastModifiedObjectId: state.lastModifiedObjectId,
      selectedObjectId: state.selectedObjectId,
      recentCommands: state.recentCommands.slice(-10),
    }
  }

  const summarizeCanvasObject = (obj: CanvasObject) => {
    const bounds = getObjectBounds(obj)
    const width = obj.params?.width ?? bounds?.width
    const height = obj.params?.height ?? bounds?.height

    return {
      id: obj.id,
      type: obj.type,
      kind: obj.params?.kind,
      kindLabel: obj.params?.kindLabel,
      text: obj.params?.text,
      x: obj.params?.x ?? bounds?.x,
      y: obj.params?.y ?? bounds?.y,
      width,
      height,
      radius: obj.params?.radius,
      fill: obj.params?.fill,
      stroke: obj.params?.stroke,
      centerX: bounds ? bounds.x + bounds.width / 2 : undefined,
      centerY: bounds ? bounds.y + bounds.height / 2 : undefined,
      area: typeof width === 'number' && typeof height === 'number' ? width * height : undefined,
      sceneType: obj.params?.sceneType,
      sceneRole: obj.params?.sceneRole,
      idHint: obj.params?.idHint,
      assetId: obj.params?.assetId,
      assetCategory: obj.params?.assetCategory,
      semanticAliases: Array.isArray(obj.params?.semanticAliases) ? obj.params.semanticAliases : undefined,
    }
  }

  const getObjectBounds = (obj: CanvasObject) => {
    return getResolvedObjectBounds(obj)
  }

  const executeControlAction = async (action: 'save' | 'export' | 'cancel' | 'continue') => {
    switch (action) {
      case 'save':
        if (!onSave) throw new Error('保存失败，请稍后再试。')
        if (!(await onSave())) throw new Error('保存失败，请稍后再试。')
        return true

      case 'export':
        if (!onExport) throw new Error('导出失败，请确认画布已加载。')
        if (!(await onExport())) throw new Error('导出失败，请确认画布已加载。')
        return true

      case 'cancel':
        handleResetVoice()
        return false

      case 'continue':
        if (!isListening) {
          await handleStartVoice()
        } else {
          setStatus('listening')
          setExecutionMessage('正在听...')
        }
        return false
    }
  }

  const executeCommands = (
    commands: DrawCommand[],
    options: CommandExecutionOptions = {}
  ): CommandExecutionResult => {
    let lastCreatedId: string | null = null
    let executedCount = 0

    commands.forEach((cmd) => {
      switch (cmd.action) {
        case 'create':
          if (cmd.type && cmd.id) {
            lastCreatedId = cmd.id
            addObject({
              id: cmd.id,
              type: cmd.type,
              params: cmd.params || {},
              children: cmd.children,
            }, { deferHistory: options.deferHistory })
            executedCount += 1
          }
          break

        case 'modify':
          if (cmd.target && cmd.params) {
            const target = resolveCommandTarget(cmd.target, lastCreatedId)
            if (target) {
              updateObject(target, cmd.params)
              executedCount += 1
            }
          }
          break

        case 'move':
          if (cmd.target && cmd.params) {
            const target = resolveCommandTarget(cmd.target, lastCreatedId)
            const updates = target ? getMoveToUpdates(target, cmd.params.x, cmd.params.y) : null
            if (target && updates) {
              updateObject(target, updates)
              executedCount += 1
            }
          }
          break

        case 'moveBy':
          if (cmd.target && cmd.params) {
            const target = resolveCommandTarget(cmd.target, lastCreatedId)
            const updates = target ? getMoveByUpdates(target, cmd.params.dx || 0, cmd.params.dy || 0) : null
            if (target && updates) {
              updateObject(target, updates)
              executedCount += 1
            }
          }
          break

        case 'scale':
          if (cmd.target && cmd.params) {
            const target = resolveCommandTarget(cmd.target, lastCreatedId)
            const updates = target ? getScaleUpdates(target, cmd.params.scale || 1) : null
            if (target && updates) {
              updateObject(target, updates)
              executedCount += 1
            }
          }
          break

        case 'select':
          if (cmd.target) {
            const target = resolveCommandTarget(cmd.target, lastCreatedId)
            if (target) {
              setSelectedObjectId(target)
              executedCount += 1
            }
          }
          break

        case 'delete':
          if (cmd.target) {
            const target = resolveCommandTarget(cmd.target, lastCreatedId)
            if (target) {
              removeObject(target)
              executedCount += 1
            }
          }
          break

        case 'clear':
          clearCanvas()
          executedCount += 1
          break

        case 'undo':
          if (useCanvasStore.getState().historyStep <= 0) {
            return
          }
          undo()
          executedCount += 1
          break

        case 'redo':
          {
            const state = useCanvasStore.getState()
            if (state.historyStep >= state.history.length - 1) {
              return
            }
            redo()
            executedCount += 1
          }
          break

        default:
          console.warn('未知命令:', cmd)
      }
    })

    if (executedCount === 0) {
      return {
        success: false,
        message: getNoOpMessage(commands),
      }
    }

    return {
      success: true,
      message: `已完成：执行 ${executedCount} 个命令`,
    }
  }

  const getNoOpMessage = (commands: DrawCommand[]) => {
    const action = commands[0]?.action
    if (action === 'undo') return '当前没有可撤销的操作。'
    if (action === 'redo') return '当前没有可重做的操作。'
    return '没有可修改的对象，请先选中或创建一个对象。'
  }

  const getMoveByUpdates = (targetId: string, dx: number, dy: number) => {
    const obj = useCanvasStore.getState().canvasObjects.find((item) => item.id === targetId)
    if (!obj) return null
    return buildMoveByUpdates(obj, dx, dy)
  }

  const getMoveToUpdates = (targetId: string, x: number, y: number) => {
    const obj = useCanvasStore.getState().canvasObjects.find((item) => item.id === targetId)
    if (!obj || typeof x !== 'number' || typeof y !== 'number') return null
    return buildMoveToUpdates(obj, x, y)
  }

  const getScaleUpdates = (targetId: string, scale: number) => {
    const obj = useCanvasStore.getState().canvasObjects.find((item) => item.id === targetId)
    if (!obj) return null
    return buildScaleAroundCenterUpdates(obj, scale)
  }

  const resolveCommandTarget = (target: string, lastCreatedId: string | null) => {
    const state = useCanvasStore.getState()

    if (target === '__last__') {
      return (
        lastCreatedId ||
        state.selectedObjectId ||
        state.lastModifiedObjectId ||
        state.lastCreatedObjectId ||
        state.canvasObjects[state.canvasObjects.length - 1]?.id ||
        null
      )
    }

    if (target.startsWith('__kind__:')) {
      const kind = target.replace('__kind__:', '').toLowerCase()
      const matched = [...state.canvasObjects]
        .reverse()
        .find((obj) => obj.type?.toLowerCase() === kind || obj.params?.kind?.toLowerCase() === kind)
      return matched?.id || null
    }

    return target
  }

  const getRecognitionTypeLabel = () => {
    switch (recognitionType) {
      case 'baidu':
        return <Tag color="green">百度ASR</Tag>
      case 'webspeech':
        return <Tag color="blue">浏览器识别</Tag>
      default:
        return <Tag color="default">未初始化</Tag>
    }
  }

  const getStatusLabel = () => {
    switch (status) {
      case 'listening':
        return '正在听'
      case 'recognizing':
        return '正在识别'
      case 'matched':
        return '快速匹配'
      case 'thinking':
        return '正在理解'
      case 'drawing':
        return '正在绘制'
      case 'done':
        return '已完成'
      case 'error':
        return '出错'
      default:
        return '空闲'
    }
  }

  const getCommandSourceLabel = () => {
    if (lastCommandSource === 'fast') return '本地快速命令'
    if (lastCommandSource === 'llm') return 'AI 理解'
    return '待识别'
  }

  return (
    <div className="voice-control">
      <div className="voice-control-header">
        <h3>语音控制</h3>
        {getRecognitionTypeLabel()}
      </div>

      <Space direction="vertical" style={{ width: '100%' }}>
        {!isListening ? (
          <Button
            type="primary"
            icon={<AudioOutlined />}
            onClick={handleStartVoice}
            loading={isStarting}
            block
            size="large"
          >
            开始语音识别
          </Button>
        ) : (
          <Button
            danger
            icon={<AudioMutedOutlined />}
            onClick={handleStopVoice}
            block
            size="large"
          >
            停止语音识别
          </Button>
        )}

        <Button
          icon={<ReloadOutlined />}
          onClick={handleResetVoice}
          block
        >
          取消/重说
        </Button>

        <div className="scene-shortcuts">
          <div className="scene-shortcuts-header">
            <span>场景模板</span>
            <Button
              type="text"
              size="small"
              icon={scenesExpanded ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setScenesExpanded((expanded) => !expanded)}
            >
              {scenesExpanded ? '收起' : '展开'}
            </Button>
          </div>
          <div className="scene-shortcuts-grid">
            {SCENE_SHORTCUTS
              .slice(0, scenesExpanded ? SCENE_SHORTCUTS.length : COLLAPSED_SCENE_COUNT)
              .map((scene) => (
                <Button
                  key={scene.title}
                  icon={<PictureOutlined />}
                  className="scene-shortcut-button"
                  onClick={() => handleVoiceCommand(`画一个${scene.title}`)}
                >
                  <span className="scene-shortcut-title">{scene.title}</span>
                  <span className="scene-shortcut-tone">{scene.tone}</span>
                </Button>
              ))}
          </div>
        </div>

        <div className="voice-feedback-panel">
          <div className="voice-feedback-row">
            <span className="voice-feedback-label">当前状态</span>
            <span className={`voice-feedback-value status-${status}`}>{getStatusLabel()}</span>
          </div>
          <div className="voice-feedback-row">
            <span className="voice-feedback-label">识别文本</span>
            <span className="voice-feedback-value">{recognizedText || '等待语音输入'}</span>
          </div>
          <div className="voice-feedback-row">
            <span className="voice-feedback-label">理解为</span>
            <span className="voice-feedback-value">{interpretedText || getCommandSourceLabel()}</span>
          </div>
          <div className="voice-feedback-row">
            <span className="voice-feedback-label">执行状态</span>
            <span className="voice-feedback-value">{executionMessage || '暂无执行状态'}</span>
          </div>
          {errorMessage && (
            <div className="voice-error-box">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="voice-tips">
          <h4>实时语音命令示例：</h4>
          <ul>
            <li>"画一个红色的圆"</li>
            <li>"画一个蓝色的矩形"</li>
            <li>"画一个房子"</li>
            <li>"把它变成绿色"</li>
            <li>"移到左边"</li>
            <li>"清空画布"</li>
            <li>"撤销"</li>
          </ul>
        </div>

        {recognitionType === 'webspeech' && (
          <div className="voice-status-info">
            <p>
              当前使用实时连续识别，说完一句后会自动处理，无需点击停止。
            </p>
          </div>
        )}

        {!activeConfig && (
          <div className="voice-status-info">
            <p>
              未配置 LLM 模型时，仍可使用快速命令、本地 SVG 素材和固定场景；开放式复杂绘图需要先配置模型。
            </p>
          </div>
        )}
      </Space>
    </div>
  )
}
