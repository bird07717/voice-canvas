import { useState, useEffect, useRef } from 'react'
import { Button, Space, message, Tag } from 'antd'
import { AudioOutlined, AudioMutedOutlined, PictureOutlined, ReloadOutlined } from '@ant-design/icons'
import { useVoiceStore } from '@/stores/voiceStore'
import { useLLMStore } from '@/stores/llmStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { voiceService } from '@/services/voiceService'
import { apiService } from '@/services/api'
import { isLikelySceneRequest, matchFastCommand } from '@/services/fastCommandMatcher'
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

const SCENE_SHORTCUTS = ['海边日落', '公园', '生日贺卡', '城市夜景', '森林小屋']

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
  } = useCanvasStore()
  const [isStarting, setIsStarting] = useState(false)
  const lastFinalTextRef = useRef('')
  const lastFinalTimeRef = useRef(0)
  const commandSequenceRef = useRef(0)

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
          if (isFinal) {
            const normalizedText = text.trim()
            const now = Date.now()
            if (
              normalizedText &&
              (normalizedText !== lastFinalTextRef.current || now - lastFinalTimeRef.current > 2000)
            ) {
              lastFinalTextRef.current = normalizedText
              lastFinalTimeRef.current = now
              handleVoiceCommand(normalizedText)
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
    setStatus('idle')
    setExecutionMessage('')
  }

  const handleResetVoice = () => {
    commandSequenceRef.current += 1
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
    const fastCommand = matchFastCommand(text, canvasContext)

    if (fastCommand.matched) {
      setLastCommandSource('fast')
      setInterpretedText(fastCommand.interpretation || '')

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

    const canUseTemplateScene = isLikelySceneRequest(text)
    if (!activeConfig && !canUseTemplateScene) {
      setStatus('error')
      setLastCommandSource(null)
      setInterpretedText('需要 AI 理解的复杂命令')
      setErrorMessage('未配置LLM模型，复杂命令暂时无法理解。请先在首页设置中配置LLM。')
      setExecutionMessage('')
      return
    }

    setStatus('thinking')
    setLastCommandSource('llm')
    setInterpretedText('复杂绘图或编辑命令，交给 AI 继续理解。')
    setExecutionMessage('AI 正在规划完整场景...')
    setIsProcessing(true)

    try {
      const response = await apiService.processVoiceCommand({
        canvas_id: canvasState.currentCanvasId,
        text: text.trim(),
        llm_config_id: activeConfig?.id,
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

      setStatus('drawing')
      if (response.commands.length > 0) {
        const result = response.scene
          ? await executeSceneCommands(response.commands)
          : executeCommands(response.commands)
        if (!result.success) {
          setStatus('error')
          setErrorMessage(result.message)
          setExecutionMessage('')
          return
        }
        recordCommands(response.commands)
      }
      if (response.response) {
        setInterpretedText(response.scene ? `理解为：${response.scene.title}场景` : response.response)
      }
      setStatus('done')
      setExecutionMessage(
        response.scene
          ? `执行状态：已生成 ${response.scene.object_count || response.commands.length} 个对象`
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
      centerX: bounds ? bounds.x + bounds.width / 2 : undefined,
      centerY: bounds ? bounds.y + bounds.height / 2 : undefined,
      area: typeof width === 'number' && typeof height === 'number' ? width * height : undefined,
      sceneType: obj.params?.sceneType,
      sceneRole: obj.params?.sceneRole,
      idHint: obj.params?.idHint,
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

        <Space wrap size={[8, 8]}>
          {SCENE_SHORTCUTS.map((scene) => (
            <Button
              key={scene}
              icon={<PictureOutlined />}
              size="small"
              onClick={() => handleVoiceCommand(`画一个${scene}`)}
            >
              {scene}
            </Button>
          ))}
        </Space>

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
              ⚠️ 未配置LLM模型，请先在首页设置中配置LLM。
            </p>
          </div>
        )}
      </Space>
    </div>
  )
}
