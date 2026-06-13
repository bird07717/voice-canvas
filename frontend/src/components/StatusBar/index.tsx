import { Badge } from 'antd'
import {
  AudioOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  SyncOutlined,
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
          icon: <LoadingOutlined className="status-icon" style={{ color: '#1890ff' }} />,
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
          icon: <LoadingOutlined className="status-icon" style={{ color: '#1890ff' }} />,
          text: '理解中...',
          color: 'processing',
        }
      case 'drawing':
        return {
          icon: <SyncOutlined className="status-icon" spin style={{ color: '#722ed1' }} />,
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
