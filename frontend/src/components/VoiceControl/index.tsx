import { useState, useEffect } from 'react'
import { Button, Space, message, Tag } from 'antd'
import { AudioOutlined, AudioMutedOutlined } from '@ant-design/icons'
import { useVoiceStore } from '@/stores/voiceStore'
import { useLLMStore } from '@/stores/llmStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { voiceService } from '@/services/voiceService'
import { apiService } from '@/services/api'
import { DrawCommand } from '@/types'
import './VoiceControl.css'

export default function VoiceControl() {
  const {
    isListening,
    status,
    recognizedText,
    recognitionType,
    baiduConfig,
    setRecognizedText,
    setStatus,
    setRecognitionType
  } = useVoiceStore()
  const { activeConfig, setIsProcessing } = useLLMStore()
  const { currentCanvasId, addObject, updateObject, removeObject, clearCanvas, undo } = useCanvasStore()
  const [isStarting, setIsStarting] = useState(false)

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
    if (!activeConfig) {
      message.warning('请先配置LLM模型')
      return
    }

    if (!voiceService.isSupported()) {
      message.error('您的浏览器不支持语音识别')
      return
    }

    setIsStarting(true)
    setStatus('listening')

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
          if (isFinal) {
            handleVoiceCommand(text)
          }
        },
        (error) => {
          console.error('语音识别错误:', error)
          message.error('语音识别出错: ' + (error.message || error))
          setStatus('idle')
        }
      )
    } catch (error: any) {
      message.error('启动语音识别失败: ' + (error.message || error))
      setStatus('idle')
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopVoice = () => {
    voiceService.stopListening()
    setStatus('idle')
  }

  const handleVoiceCommand = async (text: string) => {
    if (!currentCanvasId || !text.trim()) return

    setStatus('processing')
    setIsProcessing(true)

    try {
      const response = await apiService.processVoiceCommand({
        canvas_id: currentCanvasId,
        text: text.trim(),
        llm_config_id: activeConfig?.id,
      })

      setStatus('drawing')
      executeCommands(response.commands)
      message.success(response.response)
    } catch (error: any) {
      message.error(error.response?.data?.detail || '处理命令失败')
    } finally {
      setStatus('listening')
      setIsProcessing(false)
    }
  }

  const executeCommands = (commands: DrawCommand[]) => {
    commands.forEach((cmd) => {
      switch (cmd.action) {
        case 'create':
          if (cmd.type && cmd.id) {
            addObject({
              id: cmd.id,
              type: cmd.type,
              params: cmd.params || {},
              children: cmd.children,
            })
          }
          break

        case 'modify':
          if (cmd.target && cmd.params) {
            updateObject(cmd.target, cmd.params)
          }
          break

        case 'move':
          if (cmd.target && cmd.params) {
            updateObject(cmd.target, { x: cmd.params.x, y: cmd.params.y })
          }
          break

        case 'delete':
          if (cmd.target) {
            removeObject(cmd.target)
          }
          break

        case 'clear':
          clearCanvas()
          break

        case 'undo':
          undo()
          break

        default:
          console.warn('未知命令:', cmd)
      }
    })
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

  return (
    <div className="voice-control">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3>语音控制</h3>
        {getRecognitionTypeLabel()}
      </div>

      <Space direction="vertical" style={{ width: '100%' }}>
        {status === 'idle' ? (
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

        {recognizedText && (
          <div className="recognized-text-box">
            <p className="label">识别文本：</p>
            <p className="text">{recognizedText}</p>
          </div>
        )}

        <div className="voice-tips">
          <h4>语音命令示例：</h4>
          <ul>
            <li>"画一个红色的圆"</li>
            <li>"画一个蓝色的矩形"</li>
            <li>"画一个房子"</li>
            <li>"把它变成绿色"</li>
            <li>"移到左边"</li>
            <li>"清空画布"</li>
            <li>"撤销"</li>
          </ul>
          {recognitionType === 'webspeech' && (
            <div style={{ marginTop: 12, padding: 8, background: '#fff7e6', borderRadius: 4 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#fa8c16' }}>
                ℹ️ 当前使用浏览器识别（降级方案），识别准确率可能较低。
                {baiduConfig ? '百度ASR初始化失败，请检查配置。' : ''}
              </p>
            </div>
          )}
        </div>
      </Space>
    </div>
  )
}
