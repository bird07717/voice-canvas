// 百度语音识别相关类型定义
const DEFAULT_BAIDU_APP_ID = '123697514'

export interface BaiduVoiceConfig {
  appId?: string
  apiKey: string
  secretKey: string
}

// 语音识别服务类
class VoiceService {
  private recognition: any = null
  private isInitialized = false
  private baiduConfig: BaiduVoiceConfig | null = null
  private keepListening = false
  private realtimeSocket: WebSocket | null = null
  private realtimeAudioSource: MediaStreamAudioSourceNode | null = null
  private realtimePcmQueue = new Uint8Array(0)
  private readonly realtimeFrameBytes = 5120
  private audioContext: AudioContext | null = null
  private audioProcessor: ScriptProcessorNode | null = null
  private audioStream: MediaStream | null = null
  private useBaidu: boolean = false

  /**
   * 初始化语音识别服务
   * @param config 百度语音配置（可选）
   */
  async initialize(config?: BaiduVoiceConfig) {
    this.baiduConfig = config
      ? { ...config, appId: config.appId || DEFAULT_BAIDU_APP_ID }
      : null

    if (this.baiduConfig?.appId && this.baiduConfig.apiKey) {
      this.useBaidu = true
      this.isInitialized = true
      console.log('使用百度实时语音识别')
      return true
    }

    // 降级到浏览器原生 Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      this.setupWebSpeechRecognition()
      console.log('使用浏览器Web Speech API')
      return true
    }

    return false
  }

  private setupWebSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'zh-CN'
    this.useBaidu = false
    this.isInitialized = true
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
      await this.startBaiduRealtimeRecognition(onResult, onError)
    } else {
      // 使用Web Speech API
      await this.startWebSpeechRecognition(onResult, onError)
    }
  }

  private async startBaiduRealtimeRecognition(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: any) => void
  ) {
    const config = this.baiduConfig
    if (!config?.appId || !config.apiKey) {
      this.fallbackToWebSpeech(onResult, onError)
      return
    }

    const appId = Number(config.appId)
    if (!Number.isFinite(appId)) {
      onError?.(new Error('百度AppID必须是数字'))
      return
    }

    this.keepListening = true
    this.stopBaiduRealtimeRecognition('cancel')

    const sn = this.generateSN()
    const socket = new WebSocket(`wss://vop.baidu.com/realtime_asr?sn=${sn}`)
    this.realtimeSocket = socket

    socket.onmessage = (event) => {
      this.handleBaiduRealtimeMessage(event.data, onResult, onError)
    }

    socket.onerror = () => {
      console.warn('百度实时ASR连接失败，降级到浏览器识别')
      this.stopBaiduRealtimeRecognition('cancel')
      this.fallbackToWebSpeech(onResult, onError)
    }

    socket.onclose = () => {
      this.realtimeSocket = null
      this.stopRealtimeAudio()
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('百度实时ASR连接超时'))
      }, 8000)

      socket.onopen = async () => {
        window.clearTimeout(timeout)
        try {
          socket.send(JSON.stringify({
            type: 'START',
            data: {
              appid: appId,
              appkey: config.apiKey,
              dev_pid: 15372,
              cuid: this.generateCUID(),
              format: 'pcm',
              sample: 16000
            }
          }))
          await this.startRealtimeAudio(socket)
          resolve()
        } catch (error) {
          reject(error)
        }
      }
    }).catch((error) => {
      console.warn('百度实时ASR启动失败，降级到浏览器识别:', error)
      this.stopBaiduRealtimeRecognition('cancel')
      this.fallbackToWebSpeech(onResult, onError)
    })
  }

  private handleBaiduRealtimeMessage(
    data: any,
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: any) => void
  ) {
    if (typeof data !== 'string') return

    try {
      const message = JSON.parse(data)
      if (message.type === 'HEARTBEAT') return

      if (message.err_no && message.err_no !== 0) {
        console.warn('百度实时ASR返回错误:', message)
        if (message.err_no === -3004) {
          onError?.(new Error(message.err_msg || '百度实时ASR鉴权失败'))
        }
        return
      }

      if (message.type === 'MID_TEXT' && message.result) {
        onResult(message.result, false)
      }

      if (message.type === 'FIN_TEXT' && message.result) {
        onResult(message.result, true)
      }
    } catch (error) {
      console.warn('解析百度实时ASR消息失败:', error)
    }
  }

  private async startRealtimeAudio(socket: WebSocket) {
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
    const mute = audioContext.createGain()

    mute.gain.value = 0
    this.audioStream = stream
    this.audioContext = audioContext
    this.audioProcessor = processor
    this.realtimeAudioSource = source
    this.realtimePcmQueue = new Uint8Array(0)

    processor.onaudioprocess = (event) => {
      if (!this.keepListening || socket.readyState !== WebSocket.OPEN) return

      const input = event.inputBuffer.getChannelData(0)
      const downsampled = this.downsampleBuffer(input, audioContext.sampleRate, 16000)
      const pcm = this.floatTo16BitPCM(downsampled)
      this.enqueueRealtimePcm(socket, pcm)
    }

    source.connect(processor)
    processor.connect(mute)
    mute.connect(audioContext.destination)
  }

  private enqueueRealtimePcm(socket: WebSocket, pcm: Uint8Array) {
    const merged = new Uint8Array(this.realtimePcmQueue.length + pcm.length)
    merged.set(this.realtimePcmQueue, 0)
    merged.set(pcm, this.realtimePcmQueue.length)
    this.realtimePcmQueue = merged

    while (this.realtimePcmQueue.length >= this.realtimeFrameBytes) {
      const chunk = this.realtimePcmQueue.slice(0, this.realtimeFrameBytes)
      this.realtimePcmQueue = this.realtimePcmQueue.slice(this.realtimeFrameBytes)
      socket.send(chunk.buffer)
    }
  }

  private stopBaiduRealtimeRecognition(mode: 'finish' | 'cancel') {
    this.stopRealtimeAudio()

    if (this.realtimeSocket && this.realtimeSocket.readyState === WebSocket.OPEN) {
      if (this.realtimePcmQueue.length > 0 && mode === 'finish') {
        this.realtimeSocket.send(this.realtimePcmQueue.buffer)
      }
      this.realtimeSocket.send(JSON.stringify({ type: mode === 'finish' ? 'FINISH' : 'CANCEL' }))
      if (mode === 'cancel') {
        this.realtimeSocket.close()
      }
    }

    this.realtimePcmQueue = new Uint8Array(0)
  }

  private stopRealtimeAudio() {
    if (this.audioProcessor) {
      this.audioProcessor.disconnect()
    }
    if (this.realtimeAudioSource) {
      this.realtimeAudioSource.disconnect()
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop())
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => undefined)
    }

    this.audioContext = null
    this.audioProcessor = null
    this.audioStream = null
    this.realtimeAudioSource = null
  }

  private fallbackToWebSpeech(
    onResult: (text: string, isFinal: boolean) => void,
    onError?: (error: any) => void
  ) {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      this.setupWebSpeechRecognition()
      this.startWebSpeechRecognition(onResult, onError)
      return
    }

    onError?.(new Error('百度实时ASR不可用，且浏览器不支持Web Speech降级'))
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
      this.stopBaiduRealtimeRecognition('finish')
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
      ('WebSocket' in window && 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) ||
      'webkitSpeechRecognition' in window ||
      'SpeechRecognition' in window
    )
  }

  /**
   * 获取当前使用的识别方式
   */
  getRecognitionType(): 'baidu' | 'webspeech' | 'none' {
    if (!this.isInitialized) return 'none'
    return this.useBaidu ? 'baidu' : 'webspeech'
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

  private floatTo16BitPCM(samples: Float32Array): Uint8Array {
    const buffer = new ArrayBuffer(samples.length * 2)
    const view = new DataView(buffer)

    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    }

    return new Uint8Array(buffer)
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

  private generateSN(): string {
    if (crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export const voiceService = new VoiceService()
