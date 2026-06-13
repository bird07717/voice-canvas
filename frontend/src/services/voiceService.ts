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
  private baiduAccessToken: string | null = null
  private tokenExpireTime: number = 0
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private useBaidu: boolean = false

  /**
   * 初始化语音识别服务
   * @param config 百度语音配置（可选）
   */
  async initialize(config?: BaiduVoiceConfig) {
    if (config?.apiKey && config?.secretKey) {
      // 如果提供了百度配置，尝试使用百度ASR
      this.baiduConfig = config
      this.useBaidu = true

      try {
        await this.getBaiduAccessToken()
        console.log('百度语音识别初始化成功')
        this.isInitialized = true
        return true
      } catch (error) {
        console.warn('百度语音识别初始化失败，降级到Web Speech API', error)
        this.useBaidu = false
      }
    }

    // 降级到浏览器原生 Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.lang = 'zh-CN'
      this.isInitialized = true
      console.log('使用浏览器Web Speech API')
      return true
    }

    return false
  }

  /**
   * 获取百度Access Token
   */
  private async getBaiduAccessToken(): Promise<string> {
    // 检查token是否过期
    if (this.baiduAccessToken && Date.now() < this.tokenExpireTime) {
      return this.baiduAccessToken
    }

    if (!this.baiduConfig) {
      throw new Error('百度配置未设置')
    }

    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.baiduConfig.apiKey}&client_secret=${this.baiduConfig.secretKey}`

    try {
      const response = await fetch(url, { method: 'POST' })
      const data: BaiduTokenResponse = await response.json()

      if (data.error) {
        throw new Error(`获取Token失败: ${data.error_description}`)
      }

      this.baiduAccessToken = data.access_token
      // 提前5分钟过期
      this.tokenExpireTime = Date.now() + (data.expires_in - 300) * 1000

      return data.access_token
    } catch (error) {
      throw new Error('获取百度Access Token失败: ' + error)
    }
  }

  /**
   * 百度语音识别
   */
  private async recognizeWithBaidu(audioBlob: Blob): Promise<string> {
    const token = await this.getBaiduAccessToken()

    // 将音频转为PCM格式的base64
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = this.arrayBufferToBase64(arrayBuffer)

    // 调用百度ASR API (JSON方式)
    const url = `http://vop.baidu.com/server_api`

    const requestBody = {
      format: 'wav', // 浏览器录音默认wav格式
      rate: 16000,
      channel: 1,
      cuid: this.generateCUID(),
      token: token,
      dev_pid: 1537, // 普通话模型
      speech: base64Audio,
      len: arrayBuffer.byteLength
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data: BaiduASRResponse = await response.json()

      if (data.err_no === 0 && data.result && data.result.length > 0) {
        return data.result[0]
      } else {
        throw new Error(`识别失败: ${data.err_msg}`)
      }
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
          sampleRate: 16000
        }
      })

      this.audioChunks = []
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm', // 浏览器支持的格式
      })

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })

        try {
          // 调用百度ASR识别
          const text = await this.recognizeWithBaidu(audioBlob)
          onResult(text, true)
        } catch (error) {
          console.error('百度ASR识别失败:', error)
          onError?.(error)
        }

        // 清理资源
        stream.getTracks().forEach(track => track.stop())
        this.audioChunks = []
      }

      this.mediaRecorder.onerror = (error) => {
        console.error('录音错误:', error)
        onError?.(error)
      }

      // 开始录音
      this.mediaRecorder.start()

      // 百度ASR支持最长60秒，这里设置为55秒自动停止
      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop()
        }
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
      onError?.(event.error)
    }

    this.recognition.start()
  }

  /**
   * 停止语音识别
   */
  stopListening() {
    if (this.useBaidu) {
      // 停止百度录音
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop()
      }
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
