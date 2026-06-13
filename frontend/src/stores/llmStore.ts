import { create } from 'zustand'

export interface LLMConfig {
  id: number
  name: string
  base_url: string
  api_key: string
  model_name: string
  is_active: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  command_json?: any
  created_at: string
}

interface LLMState {
  configs: LLMConfig[]
  activeConfig: LLMConfig | null
  chatHistory: ChatMessage[]
  isProcessing: boolean
  recognizedText: string

  setConfigs: (configs: LLMConfig[]) => void
  setActiveConfig: (config: LLMConfig | null) => void
  addConfig: (config: LLMConfig) => void
  updateConfig: (id: number, updates: Partial<LLMConfig>) => void
  removeConfig: (id: number) => void
  setChatHistory: (history: ChatMessage[]) => void
  addChatMessage: (message: ChatMessage) => void
  setIsProcessing: (processing: boolean) => void
  setRecognizedText: (text: string) => void
  clearChatHistory: () => void
}

export const useLLMStore = create<LLMState>((set) => ({
  configs: [],
  activeConfig: null,
  chatHistory: [],
  isProcessing: false,
  recognizedText: '',

  setConfigs: (configs) => {
    const active = configs.find((c) => c.is_active) || null
    set({ configs, activeConfig: active })
  },

  setActiveConfig: (config) => set({ activeConfig: config }),

  addConfig: (config) =>
    set((state) => ({ configs: [...state.configs, config] })),

  updateConfig: (id, updates) =>
    set((state) => ({
      configs: state.configs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  removeConfig: (id) =>
    set((state) => ({
      configs: state.configs.filter((c) => c.id !== id),
    })),

  setChatHistory: (history) => set({ chatHistory: history }),

  addChatMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message],
    })),

  setIsProcessing: (processing) => set({ isProcessing: processing }),

  setRecognizedText: (text) => set({ recognizedText: text }),

  clearChatHistory: () => set({ chatHistory: [] }),
}))
