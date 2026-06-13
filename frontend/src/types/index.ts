// 绘图命令类型定义
export interface DrawCommand {
  action: 'create' | 'modify' | 'move' | 'delete' | 'clear' | 'undo' | 'redo'
  type?: string
  id?: string
  target?: string
  params?: any
  children?: any[]
}

// Canvas对象类型
export interface CanvasObject {
  id: string
  type: string
  params: {
    x?: number
    y?: number
    width?: number
    height?: number
    radius?: number
    fill?: string
    stroke?: string
    strokeWidth?: number
    text?: string
    fontSize?: number
    points?: number[]
    [key: string]: any
  }
  children?: CanvasObject[]
}

// Canvas数据类型
export interface CanvasData {
  id: number
  user_id: number
  title: string
  canvas_json: {
    objects: CanvasObject[]
    version: string
  }
  thumbnail_url?: string
  created_at: string
  updated_at: string
}

// 语音命令请求
export interface VoiceCommandRequest {
  canvas_id: number
  text: string
  llm_config_id?: number
}

export type VoiceIntent =
  | 'draw'
  | 'edit'
  | 'control'
  | 'delete'
  | 'clarify'
  | 'ignore'

// 语音命令响应
export interface VoiceCommandResponse {
  intent: VoiceIntent
  confidence: number
  commands: DrawCommand[]
  response: string
  reason?: string
  chat_history: ChatMessage[]
}

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  command_json?: any
  created_at: string
}
