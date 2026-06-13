import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import { apiService } from '@/services/api'
import './Login.css'

interface LoginForm {
  username: string
  password: string
}

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: LoginForm) => {
    setLoading(true)
    try {
      const response = await apiService.login(values.username, values.password)
      setAuth(response.access_token, values.username)
      message.success('登录成功')
      navigate('/home')
    } catch (error: any) {
      message.error(error.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-atmosphere" aria-hidden="true" />
      <div className="login-content">
        <div className="login-product-preview" aria-hidden="true">
          <div className="preview-copy">
            <span>Voice controlled drawing</span>
            <strong>说出想法，画布自动绘制</strong>
          </div>
          <div className="preview-canvas">
            <div className="preview-toolbar">
              <span />
              <span />
              <span />
            </div>
            <div className="preview-bubbles">
              <div className="preview-bubble preview-bubble-user">
                语音：画一座小房子和树
              </div>
              <div className="preview-bubble preview-bubble-ai">
                正在绘制到画布
              </div>
            </div>
            <svg className="preview-drawing" viewBox="0 0 520 330">
              <path
                className="preview-sky-line"
                d="M72 236C138 214 196 222 258 238S384 256 456 230"
              />
              <circle
                className="preview-sun"
                cx="398"
                cy="78"
                r="34"
              />
              <path
                className="preview-cloud"
                d="M112 96h74c14 0 25-10 25-23 0-12-10-22-23-22-5 0-10 1-14 4-8-14-22-22-39-22-24 0-44 19-44 42 0 8 2 15 6 21h15Z"
              />
              <path
                className="preview-house-roof"
                d="M176 172l70-58 70 58Z"
              />
              <rect
                className="preview-house-wall"
                x="194"
                y="172"
                width="104"
                height="78"
                rx="8"
              />
              <rect
                className="preview-door"
                x="236"
                y="204"
                width="26"
                height="46"
                rx="5"
              />
              <rect
                className="preview-window"
                x="206"
                y="187"
                width="24"
                height="20"
                rx="5"
              />
              <rect
                className="preview-tree-trunk"
                x="370"
                y="188"
                width="24"
                height="62"
                rx="6"
              />
              <circle
                className="preview-tree-crown"
                cx="382"
                cy="164"
                r="44"
              />
              <circle
                className="preview-tree-crown preview-tree-crown-light"
                cx="416"
                cy="178"
                r="30"
              />
              <path
                className="preview-brush-path"
                d="M88 272c62-30 126-34 190-12 60 21 112 16 158-16"
              />
            </svg>
            <div className="preview-wave">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
        <div className="login-shell">
          <Card className="login-card" bordered={false}>
            <div className="login-brand">
              <div className="login-logo" aria-hidden="true">
                <svg viewBox="0 0 64 64" role="img">
                  <path
                    d="M25 13a7 7 0 0 1 14 0v13a7 7 0 0 1-14 0V13Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 24a14 14 0 0 0 28 0M32 38v7M22 51h20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M39 44 51 32c2.4-2.4 6 1.2 3.6 3.6L42.5 47.7 36 50.5 39 44Z"
                    fill="rgba(255,255,255,0.18)"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M13 45c4.5-5.6 10-5.6 14.5 0s10 5.6 14.5 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h1>Voice Canvas</h1>
              <p className="login-subtitle">AI 语音控制绘画</p>
            </div>

            <Form
              name="login"
              initialValues={{ username: 'admin', password: '123456' }}
              onFinish={onFinish}
              autoComplete="off"
            >
              <Form.Item
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="用户名 admin"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码 123456"
                  size="large"
                />
              </Form.Item>

              <Form.Item className="login-submit-item">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  size="large"
                >
                  登录
                </Button>
              </Form.Item>
            </Form>
          </Card>
          <div className="login-hint">
            默认账号 admin / 默认密码 123456
          </div>
        </div>
      </div>
    </div>
  )
}
