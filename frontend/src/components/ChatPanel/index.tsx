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
    const handleHistoryUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ canvasId?: number | null }>).detail
      if (!currentCanvasId || (detail?.canvasId && detail.canvasId !== currentCanvasId)) return
      loadChatHistory()
    }

    window.addEventListener('voice-canvas:chat-history-updated', handleHistoryUpdated)
    return () => {
      window.removeEventListener('voice-canvas:chat-history-updated', handleHistoryUpdated)
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

  const getCommandCount = (commandJson: any) =>
    commandJson?.commands?.length || 0

  const getSceneTitle = (commandJson: any) =>
    commandJson?.scene?.title || commandJson?.scene?.scene_title || ''

  const getRouteLabel = (commandJson: any) => {
    switch (commandJson?.llm_route) {
      case 'local_object':
        return '本地素材/模板'
      case 'template_scene':
        return '固定模板'
      case 'template_scene_patch':
        return commandJson?.llm_used ? '模板 + LLM补丁' : '模板，补丁未启用'
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

  const getSceneDebugSummary = (commandJson: any) => {
    if (!import.meta.env.DEV || !commandJson?.scene) return null

    return {
      scene: commandJson.scene,
      command_count: getCommandCount(commandJson),
      reason: commandJson.reason,
      llm_route: commandJson.llm_route,
      llm_used: commandJson.llm_used,
      routing_reason: commandJson.routing_reason,
    }
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
                  <>
                    <div className="chat-command">
                      执行了 {getCommandCount(msg.command_json)} 个命令
                    </div>
                    {getSceneTitle(msg.command_json) && (
                      <div className="chat-command">
                        场景：{getSceneTitle(msg.command_json)}
                      </div>
                    )}
                    {getRouteLabel(msg.command_json) && (
                      <div className="chat-command">
                        路由：{getRouteLabel(msg.command_json)}
                      </div>
                    )}
                    {getSceneDebugSummary(msg.command_json) && (
                      <details className="chat-command">
                        <summary>Scene Plan</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>
                          {JSON.stringify(getSceneDebugSummary(msg.command_json), null, 2)}
                        </pre>
                      </details>
                    )}
                  </>
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
