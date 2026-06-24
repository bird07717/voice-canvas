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
import {
  buildCanvasContext,
  buildDisambiguationPrompt,
  DRAW_COMMAND_PROTOCOL,
  executeDrawCommands,
  prepareCommandsWithTargetQueries,
  replacePendingTarget,
  resolveDisambiguationTarget,
} from '@/services/canvasCommandExecutor'
import { matchFastCommand, matchTemplateSceneShortcut } from '@/services/fastCommandMatcher'
import { DrawCommand, SceneTemplateManifestItem, VoiceCommandResponse } from '@/types'
import './VoiceControl.css'

type VoiceControlProps = {
  onSave?: () => Promise<boolean> | boolean
  onExport?: () => Promise<boolean> | boolean
}

type PendingDisambiguation = {
  commands: DrawCommand[]
  candidates: string[]
  userText: string
  interpretation: string
  createdAt: number
}

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

const isObjectSceneResponse = (response: Pick<VoiceCommandResponse, 'scene' | 'llm_route'>) =>
  response.scene?.render_mode === 'object_scene' ||
  (
    response.scene &&
    !response.scene.render_mode &&
    response.llm_route !== 'open_scene' &&
    response.scene.source !== 'llm_svg_scene' &&
    response.scene.source !== 'llm_svg_scene_repaired' &&
    response.scene.source !== 'llm_svg_scene_fallback'
  )

const isWholeSvgSceneResponse = (response: Pick<VoiceCommandResponse, 'scene' | 'llm_route'>) =>
  response.scene?.render_mode === 'svg_image' ||
  response.llm_route === 'open_scene' ||
  response.scene?.source === 'llm_svg_scene' ||
  response.scene?.source === 'llm_svg_scene_repaired' ||
  response.scene?.source === 'llm_svg_scene_fallback'

const getSceneGenerationStatus = (
  response: Pick<VoiceCommandResponse, 'scene' | 'commands' | 'llm_route'>,
  routeLabel: string
) => {
  if (!response.scene) return ''

  const objectCount = response.scene.object_count || response.commands.length
  const unit = isWholeSvgSceneResponse(response) ? '整图 SVG' : `${objectCount} 个可编辑对象`
  const base = `执行状态：${routeLabel || '场景生成'}，已生成 ${unit}`
  if (response.scene.source === 'llm_svg_scene_fallback') {
    return `${base}；AI SVG 生成失败，已使用本地兜底图`
  }
  if (response.scene.repaired) {
    return `${base}；首轮 SVG 校验失败，已自动修复`
  }
  return base
}

const COLLAPSED_SCENE_COUNT = 5
const DISAMBIGUATION_TIMEOUT_MS = 30000
const INTERIM_TEMPLATE_SCENE_COOLDOWN_MS = 1500

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
    recordCommands,
    setDisambiguationCandidates,
    clearDisambiguationCandidates,
  } = useCanvasStore()
  const [isStarting, setIsStarting] = useState(false)
  const [sceneManifest, setSceneManifest] = useState<SceneTemplateManifestItem[]>([])
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

  useEffect(() => {
    let cancelled = false

    apiService.getSceneManifest()
      .then((manifest) => {
        if (!cancelled) {
          setSceneManifest(Array.isArray(manifest.templates) ? manifest.templates : [])
        }
      })
      .catch((error) => {
        console.warn('加载场景模板 manifest 失败:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

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
            const shortcut = matchTemplateSceneShortcut(text, sceneManifest)
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
            const shortcut = matchTemplateSceneShortcut(normalizedText, sceneManifest)
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

    const fastCommand = matchFastCommand(text, canvasContext, { sceneManifest })

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
          const result = executeDrawCommands(fastCommand.commands)
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
    setInterpretedText('后端意图路由正在理解。')
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

      if (response.command_protocol && response.command_protocol !== DRAW_COMMAND_PROTOCOL) {
        setStatus('error')
        setErrorMessage(`不支持的命令协议：${response.command_protocol}`)
        setExecutionMessage('')
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
          if (isObjectSceneResponse(response)) {
            const sceneSetupCommands = response.commands.filter((command) => command.action === 'create')
            const setupResult = await executeDrawCommands(sceneSetupCommands, { mode: 'replaceScene' })
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
        const replacesScene = Boolean(response.scene)
        const prepared = replacesScene
          ? { status: 'ready' as const, commands: response.commands }
          : prepareCommandsWithTargetQueries(
              response.commands,
              canvasContext,
              text
            )
        if (prepared.status === 'pending') {
          pendingDisambiguationRef.current = {
            commands: prepared.pending.commands,
            candidates: prepared.pending.candidates,
            userText: text,
            interpretation: response.response || 'AI 编辑命令',
            createdAt: Date.now(),
          }
          setDisambiguationCandidates(prepared.pending.candidates)
          setErrorMessage('')
          setExecutionMessage(buildDisambiguationPrompt(prepared.pending.candidates))
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

        const result = executeDrawCommands(
          prepared.commands,
          replacesScene ? { mode: 'replaceScene' } : undefined
        )
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
            ? `理解为：${response.scene.title}${isWholeSvgSceneResponse(response) ? '整图' : '场景'}${routeLabel ? `（${routeLabel}）` : ''}`
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
      `${pending.userText}；确认：${text}`
    )
    if (prepared.status === 'pending') {
      pendingDisambiguationRef.current = {
        commands: prepared.pending.commands,
        candidates: prepared.pending.candidates,
        userText: pending.userText,
        interpretation: pending.interpretation,
        createdAt: Date.now(),
      }
      setDisambiguationCandidates(prepared.pending.candidates)
      setErrorMessage('')
      setExecutionMessage(buildDisambiguationPrompt(prepared.pending.candidates))
      return true
    }
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

    const result = executeDrawCommands(prepared.commands)
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
            {sceneManifest
              .slice(0, scenesExpanded ? sceneManifest.length : COLLAPSED_SCENE_COUNT)
              .map((scene) => (
                <Button
                  key={scene.title}
                  icon={<PictureOutlined />}
                  className="scene-shortcut-button"
                  onClick={() => handleVoiceCommand(`画一个${scene.title}`)}
                >
                  <span className="scene-shortcut-title">{scene.title}</span>
                  <span className="scene-shortcut-tone">{scene.aliases.find((alias) => alias !== scene.title) || scene.scene_type}</span>
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
