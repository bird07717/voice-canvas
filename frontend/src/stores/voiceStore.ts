import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'drawing'
type RecognitionType = 'baidu' | 'webspeech' | 'none'

interface VoiceState {
  isListening: boolean
  status: VoiceStatus
  recognizedText: string
  recognitionType: RecognitionType

  // 百度ASR配置
  baiduConfig: {
    apiKey: string
    secretKey: string
  } | null

  setIsListening: (listening: boolean) => void
  setStatus: (status: VoiceStatus) => void
  setRecognizedText: (text: string) => void
  setRecognitionType: (type: RecognitionType) => void
  setBaiduConfig: (config: { apiKey: string; secretKey: string } | null) => void
  startListening: () => void
  stopListening: () => void
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      isListening: false,
      status: 'idle',
      recognizedText: '',
      recognitionType: 'none',
      baiduConfig: {
        apiKey: 'SRU3kShktNWWRZrw4mANivzE',
        secretKey: 'm95tXCJZAtacKdYXAARtCNgtk5bBj8iS'
      },

      setIsListening: (listening) => set({ isListening: listening }),

      setStatus: (status) => set({ status }),

      setRecognizedText: (text) => set({ recognizedText: text }),

      setRecognitionType: (type) => set({ recognitionType: type }),

      setBaiduConfig: (config) => set({ baiduConfig: config }),

      startListening: () => set({ isListening: true, status: 'listening' }),

      stopListening: () => set({ isListening: false, status: 'idle' }),
    }),
    {
      name: 'voice-storage',
      partialize: (state) => ({
        baiduConfig: state.baiduConfig,
      }),
    }
  )
)
