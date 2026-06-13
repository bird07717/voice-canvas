import { useEffect, useRef, useState } from 'react'
import { Button } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useLLMStore } from '@/stores/llmStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { apiService } from '@/services/api'
import './ChatPanel.css'

export default function ChatPanel() {
  const { chatHistory, setChatHistory } = useLLMStore()
  const { currentCanvasId } = useCanvasStore()
  const [collapsed, setCollapsed] = useState(false)
  const messagesRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (currentCanvasId) {
      loadChatHistory()
    }
  }, [currentCanvasId])

  useEffect(() => {
    if (!collapsed && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [chatHistory, collapsed])

  const loadChatHistory = async () => {
    if (!currentCanvasId) return

    try {
      const history = await apiService.getChatHistory(currentCanvasId)
      setChatHistory(history)
    } catch (error) {
      console.error('加载对话历史失败', error)
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={`chat-panel ${collapsed ? 'chat-panel-collapsed' : ''}`}>
      <div className="chat-header">
        {!collapsed && <span>对话历史</span>}
        <Button
          type="text"
          size="small"
          icon={collapsed ? <LeftOutlined /> : <RightOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? '展开对话历史' : '收起对话历史'}
        >
          {collapsed ? '历史' : ''}
        </Button>
      </div>

      {!collapsed && (
      <div className="chat-messages" ref={messagesRef}>
        {chatHistory.length === 0 ? (
          <div className="empty-chat">开始语音对话，这里将显示历史记录</div>
        ) : (
          chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`chat-message chat-message-${msg.role}`}
            >
              <div className="chat-message-content">
                {msg.content}
                {msg.command_json && (
                  <div className="chat-command">
                    执行了 {msg.command_json.commands?.length || 0} 个命令
                  </div>
                )}
              </div>
              <div className="chat-time">{formatTime(msg.created_at)}</div>
            </div>
          ))
        )}
      </div>
      )}
    </div>
  )
}
