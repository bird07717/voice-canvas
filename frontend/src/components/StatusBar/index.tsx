import { Badge } from 'antd'
import {
  AudioOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { useVoiceStore } from '@/stores/voiceStore'
import { useLLMStore } from '@/stores/llmStore'
import './StatusBar.css'

export default function StatusBar() {
  const { status, recognizedText } = useVoiceStore()
  const { recognizedText: llmText } = useLLMStore()

  const getStatusConfig = () => {
    switch (status) {
      case 'listening':
        return {
          icon: <AudioOutlined className="status-icon" style={{ color: '#52c41a' }} />,
          text: '监听中...',
          color: 'success',
        }
      case 'recognizing':
        return {
          icon: <span className="status-spinner status-spinner-blue" aria-hidden="true" />,
          text: '识别中...',
          color: 'processing',
        }
      case 'matched':
        return {
          icon: <CheckCircleOutlined style={{ color: '#1677ff' }} />,
          text: '快速匹配',
          color: 'processing',
        }
      case 'thinking':
        return {
          icon: <span className="status-spinner status-spinner-blue" aria-hidden="true" />,
          text: '理解中...',
          color: 'processing',
        }
      case 'drawing':
        return {
          icon: <span className="status-spinner status-spinner-purple" aria-hidden="true" />,
          text: '绘制中...',
          color: 'processing',
        }
      case 'done':
        return {
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          text: '已完成',
          color: 'success',
        }
      case 'error':
        return {
          icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
          text: '出错',
          color: 'error',
        }
      default:
        return {
          icon: <CheckCircleOutlined style={{ color: '#999' }} />,
          text: '空闲',
          color: 'default',
        }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="status-indicator">
          <Badge status={statusConfig.color as any} />
          {statusConfig.icon}
          <span>{statusConfig.text}</span>
        </div>
      </div>
      {(recognizedText || llmText) && (
        <div className="recognized-text">
          识别文本: {recognizedText || llmText}
        </div>
      )}
    </div>
  )
}
