import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'matched'
  | 'thinking'
  | 'drawing'
  | 'done'
  | 'error'

export type VoiceCommandSource = 'fast' | 'llm' | null
type RecognitionType = 'baidu' | 'webspeech' | 'none'

interface VoiceState {
  isListening: boolean
  status: VoiceStatus
  recognizedText: string
  interpretedText: string
  executionMessage: string
  errorMessage: string
  lastCommandSource: VoiceCommandSource
  recognitionType: RecognitionType

  // 百度ASR配置
  baiduConfig: {
    appId: string
    apiKey: string
    secretKey: string
  } | null

  setIsListening: (listening: boolean) => void
  setStatus: (status: VoiceStatus) => void
  setRecognizedText: (text: string) => void
  setInterpretedText: (text: string) => void
  setExecutionMessage: (message: string) => void
  setErrorMessage: (message: string) => void
  setLastCommandSource: (source: VoiceCommandSource) => void
  resetVoiceFeedback: () => void
  setRecognitionType: (type: RecognitionType) => void
  setBaiduConfig: (config: { appId: string; apiKey: string; secretKey: string } | null) => void
  startListening: () => void
  stopListening: () => void
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      isListening: false,
      status: 'idle',
      recognizedText: '',
      interpretedText: '',
      executionMessage: '',
      errorMessage: '',
      lastCommandSource: null,
      recognitionType: 'none',
      baiduConfig: {
        appId: '123697514',
        apiKey: 'SRU3kShktNWWRZrw4mANivzE',
        secretKey: 'm95tXCJZAtacKdYXAARtCNgtk5bBj8iS'
      },

      setIsListening: (listening) => set({ isListening: listening }),

      setStatus: (status) => set({ status }),

      setRecognizedText: (text) => set({ recognizedText: text }),

      setInterpretedText: (text) => set({ interpretedText: text }),

      setExecutionMessage: (message) => set({ executionMessage: message }),

      setErrorMessage: (message) => set({ errorMessage: message }),

      setLastCommandSource: (source) => set({ lastCommandSource: source }),

      resetVoiceFeedback: () =>
        set({
          recognizedText: '',
          interpretedText: '',
          executionMessage: '',
          errorMessage: '',
          lastCommandSource: null,
        }),

      setRecognitionType: (type) => set({ recognitionType: type }),

      setBaiduConfig: (config) => set({ baiduConfig: config }),

      startListening: () =>
        set({
          isListening: true,
          status: 'listening',
          errorMessage: '',
          executionMessage: '正在听...',
        }),

      stopListening: () =>
        set({
          isListening: false,
          status: 'idle',
          executionMessage: '',
        }),
    }),
    {
      name: 'voice-storage',
      partialize: (state) => ({
        baiduConfig: state.baiduConfig,
      }),
    }
  )
)
