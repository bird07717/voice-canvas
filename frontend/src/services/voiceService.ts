import { apiService } from './api'

// 百度语音识别相关类型定义
export interface BaiduVoiceConfig {
  appId?: string
  apiKey: string
  secretKey: string
}

export interface BaiduTokenResponse {
  access_token: string
  expires_in: number
  error?: string
  error_description?: string
}

export interface BaiduASRResponse {
  err_no: number
  err_msg: string
  corpus_no?: string
  sn: string
  result?: string[]
}

// 语音识别服务类
class VoiceService {
  private recognition: any = null
  private isInitialized = false
  private baiduConfig: BaiduVoiceConfig | null = null
  private keepListening = false
  private audioContext: AudioContext | null = null
  private audioProcessor: ScriptProcessorNode | null = null
  private audioStream: MediaStream | null = null
  private baiduBuffers: Float32Array[] = []
  private baiduRecordingTimer: number | null = null
  private baiduOnResult: ((text: string, isFinal: boolean) => void) | null = null
  private baiduOnError: ((error: any) => void) | null = null
  private useBaidu: boolean = false

  /**
   * 初始化语音识别服务
   * @param config 百度语音配置（可选）
   */
  async initialize(config?: BaiduVoiceConfig) {
    this.baiduConfig = config || null

    // 实时连续监听优先使用浏览器 Web Speech。百度短语音是录完再传，不适合实时交互。
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = 'zh-CN'
      this.useBaidu = false
      this.isInitialized = true
      console.log('使用浏览器Web Speech API实时识别')
      return true
    }

    if (config?.apiKey && config?.secretKey) {
      // 无实时识别能力时，退回百度短语音。
      this.useBaidu = true

      try {
        await apiService.testBaiduASR({
          api_key: config.apiKey,
          secret_key: config.secretKey,
        })
        console.log('百度语音识别初始化成功')
        this.isInitialized = true
        return true
      } catch (error) {
        console.warn('百度语音识别初始化失败，降级到Web Speech API', error)
        this.useBaidu = false
      }
    }

    return false
  }

  /**
   * 百度语音识别
   */
  private async recognizeWithBaidu(wavBuffer: ArrayBuffer): Promise<string> {
    if (!this.baiduConfig) {
      throw new Error('百度配置未设置')
    }

    // 将WAV音频转为base64
    const arrayBuffer = wavBuffer
    const base64Audio = this.arrayBufferToBase64(arrayBuffer)

    try {
      const data = await apiService.recognizeWithBaidu({
        api_key: this.baiduConfig.apiKey,
        secret_key: this.baiduConfig.secretKey,
        format: 'wav',
        rate: 16000,
        channel: 1,
        cuid: this.generateCUID(),
        dev_pid: 1537,
        speech: base64Audio,
        len: arrayBuffer.byteLength,
      })
      return data.text
    } catch (error) {
      console.error('百度ASR调用失败:', error)
      throw error
    }
  }

  /**
   * 开始语音识别
   */
  async startListening(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: any) => void
  ) {
    if (!this.isInitialized) {
      const initialized = await this.initialize()
      if (!initialized) {
        onError?.(new Error('语音识别不支持'))
        return
      }
    }

    if (this.useBaidu) {
      // 使用百度ASR
      await this.startBaiduRecording(onResult, onError)
    } else {
      // 使用Web Speech API
      await this.startWebSpeechRecognition(onResult, onError)
    }
  }

  /**
   * 启动百度录音
   */
  private async startBaiduRecording(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: any) => void
  ) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextClass()
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      this.audioStream = stream
      this.audioContext = audioContext
      this.audioProcessor = processor
      this.baiduBuffers = []
      this.baiduOnResult = onResult
      this.baiduOnError = onError || null

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        this.baiduBuffers.push(new Float32Array(input))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      // 百度ASR支持最长60秒，这里设置为55秒自动停止
      this.baiduRecordingTimer = window.setTimeout(() => {
        this.stopBaiduRecording()
      }, 55000)

    } catch (error) {
      console.error('获取麦克风权限失败:', error)
      onError?.(error)
    }
  }

  /**
   * 启动Web Speech识别
   */
  private async startWebSpeechRecognition(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: any) => void
  ) {
    if (!this.recognition) return
    this.keepListening = true

    this.recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        onResult(finalTranscript, true)
      } else if (interimTranscript) {
        onResult(interimTranscript, false)
      }
    }

    this.recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error)
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return
      }
      onError?.(event.error)
    }

    this.recognition.onend = () => {
      if (!this.keepListening) return
      window.setTimeout(() => {
        try {
          this.recognition?.start()
        } catch (error) {
          console.warn('语音识别重启失败:', error)
        }
      }, 250)
    }

    try {
      this.recognition.start()
    } catch (error) {
      console.warn('语音识别已经在运行:', error)
    }
  }

  /**
   * 停止语音识别
   */
  stopListening() {
    this.keepListening = false
    if (this.useBaidu) {
      this.stopBaiduRecording()
    } else {
      // 停止Web Speech
      if (this.recognition) {
        this.recognition.stop()
      }
    }
  }

  /**
   * 检查浏览器是否支持语音识别
   */
  isSupported(): boolean {
    return (
      'webkitSpeechRecognition' in window ||
      'SpeechRecognition' in window ||
      'MediaRecorder' in window
    )
  }

  /**
   * 获取当前使用的识别方式
   */
  getRecognitionType(): 'baidu' | 'webspeech' | 'none' {
    if (!this.isInitialized) return 'none'
    return this.useBaidu ? 'baidu' : 'webspeech'
  }

  /**
   * ArrayBuffer转Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * 停止百度录音并提交识别
   */
  private async stopBaiduRecording() {
    if (!this.audioContext || !this.audioProcessor || !this.audioStream) {
      return
    }

    if (this.baiduRecordingTimer) {
      window.clearTimeout(this.baiduRecordingTimer)
      this.baiduRecordingTimer = null
    }

    const audioContext = this.audioContext
    const processor = this.audioProcessor
    const stream = this.audioStream
    const buffers = this.baiduBuffers
    const onResult = this.baiduOnResult
    const onError = this.baiduOnError

    processor.disconnect()
    stream.getTracks().forEach(track => track.stop())
    this.audioContext = null
    this.audioProcessor = null
    this.audioStream = null
    this.baiduBuffers = []
    this.baiduOnResult = null
    this.baiduOnError = null

    try {
      const samples = this.mergeAudioBuffers(buffers)
      const wavBuffer = this.encodeWav(
        this.downsampleBuffer(samples, audioContext.sampleRate, 16000),
        16000
      )
      await audioContext.close()

      const text = await this.recognizeWithBaidu(wavBuffer)
      onResult?.(text, true)
    } catch (error) {
      console.error('百度ASR识别失败:', error)
      onError?.(error)
      try {
        await audioContext.close()
      } catch {
        // ignore close errors
      }
    }
  }

  private mergeAudioBuffers(buffers: Float32Array[]): Float32Array {
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0

    buffers.forEach((buffer) => {
      result.set(buffer, offset)
      offset += buffer.length
    })

    return result
  }

  private downsampleBuffer(buffer: Float32Array, sourceRate: number, targetRate: number): Float32Array {
    if (sourceRate === targetRate) {
      return buffer
    }

    const ratio = sourceRate / targetRate
    const newLength = Math.round(buffer.length / ratio)
    const result = new Float32Array(newLength)

    for (let i = 0; i < newLength; i++) {
      const start = Math.floor(i * ratio)
      const end = Math.min(Math.floor((i + 1) * ratio), buffer.length)
      let sum = 0
      let count = 0

      for (let j = start; j < end; j++) {
        sum += buffer[j]
        count++
      }

      result[i] = count > 0 ? sum / count : 0
    }

    return result
  }

  private encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const bytesPerSample = 2
    const dataLength = samples.length * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer)

    this.writeAscii(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    this.writeAscii(view, 8, 'WAVE')
    this.writeAscii(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * bytesPerSample, true)
    view.setUint16(32, bytesPerSample, true)
    view.setUint16(34, 16, true)
    this.writeAscii(view, 36, 'data')
    view.setUint32(40, dataLength, true)

    let offset = 44
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }

    return buffer
  }

  private writeAscii(view: DataView, offset: number, value: string) {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  /**
   * 生成设备唯一标识
   */
  private generateCUID(): string {
    // 使用浏览器指纹作为CUID
    const userAgent = navigator.userAgent
    const screenResolution = `${screen.width}x${screen.height}`
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const cuid = btoa(`${userAgent}-${screenResolution}-${timezone}`).substring(0, 60)
    return cuid
  }
}

export const voiceService = new VoiceService()
