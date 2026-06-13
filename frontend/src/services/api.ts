import axios, { AxiosInstance, AxiosError } from 'axios'
import { message } from 'antd'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 请求拦截器：添加token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器：处理错误
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token过期，清除认证信息
          this.clearAuth()
          window.location.href = '/login'
          message.error('登录已过期，请重新登录')
        } else if (error.response?.status === 500) {
          message.error('服务器错误，请稍后重试')
        } else if (error.message === 'Network Error') {
          message.error('网络错误，请检查网络连接')
        }
        return Promise.reject(error)
      }
    )
  }

  private getToken(): string | null {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      const parsed = JSON.parse(authStorage)
      return parsed.state?.token || null
    }
    return null
  }

  private clearAuth() {
    localStorage.removeItem('auth-storage')
  }

  // 认证相关
  async login(username: string, password: string) {
    const response = await this.client.post('/api/auth/login', {
      username,
      password,
    })
    return response.data
  }

  async logout() {
    const response = await this.client.post('/api/auth/logout')
    return response.data
  }

  // 画布相关
  async getCanvases() {
    const response = await this.client.get('/api/canvases')
    return response.data
  }

  async getCanvas(id: number) {
    const response = await this.client.get(`/api/canvases/${id}`)
    return response.data
  }

  async createCanvas(data: { title?: string; canvas_json: any }) {
    const response = await this.client.post('/api/canvases', data)
    return response.data
  }

  async updateCanvas(id: number, data: { title?: string; canvas_json?: any }) {
    const response = await this.client.put(`/api/canvases/${id}`, data)
    return response.data
  }

  async deleteCanvas(id: number) {
    const response = await this.client.delete(`/api/canvases/${id}`)
    return response.data
  }

  // 语音命令相关
  async processVoiceCommand(data: {
    canvas_id: number
    text: string
    llm_config_id?: number
  }) {
    const response = await this.client.post('/api/voice/command', data)
    return response.data
  }

  async getChatHistory(canvasId: number) {
    const response = await this.client.get(`/api/voice/chat/${canvasId}/history`)
    return response.data
  }

  // LLM配置相关
  async getLLMConfigs() {
    const response = await this.client.get('/api/llm/configs')
    return response.data
  }

  async createLLMConfig(data: {
    name: string
    base_url: string
    api_key: string
    model_name: string
  }) {
    const response = await this.client.post('/api/llm/configs', data)
    return response.data
  }

  async updateLLMConfig(
    id: number,
    data: Partial<{
      name: string
      base_url: string
      api_key: string
      model_name: string
    }>
  ) {
    const response = await this.client.put(`/api/llm/configs/${id}`, data)
    return response.data
  }

  async deleteLLMConfig(id: number) {
    const response = await this.client.delete(`/api/llm/configs/${id}`)
    return response.data
  }

  async activateLLMConfig(id: number) {
    const response = await this.client.post(`/api/llm/configs/${id}/activate`)
    return response.data
  }

  async testLLMConnection(data: {
    base_url: string
    api_key: string
    model_name: string
  }) {
    const response = await this.client.post('/api/llm/test', data)
    return response.data
  }
}

export const apiService = new ApiService()
