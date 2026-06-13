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
                语音：画一个红色圆
              </div>
              <div className="preview-bubble preview-bubble-ai">
                正在绘制到画布
              </div>
            </div>
            <svg className="preview-drawing" viewBox="0 0 520 330">
              <path
                className="preview-curve"
                d="M74 238C134 176 198 245 258 190S348 144 440 204"
              />
              <rect
                className="preview-shape preview-rect"
                x="88"
                y="118"
                width="92"
                height="64"
                rx="16"
              />
              <circle
                className="preview-shape preview-circle"
                cx="390"
                cy="158"
                r="48"
              />
              <path
                className="preview-shape preview-star"
                d="M248 104l11 25 28 3-21 19 6 27-24-14-24 14 6-27-21-19 28-3 11-25Z"
              />
              <rect
                className="preview-selection"
                x="342"
                y="110"
                width="92"
                height="92"
                rx="8"
              />
              <circle className="preview-handle" cx="342" cy="110" r="4.5" />
              <circle className="preview-handle" cx="434" cy="110" r="4.5" />
              <circle className="preview-handle" cx="434" cy="202" r="4.5" />
              <circle className="preview-handle" cx="342" cy="202" r="4.5" />
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
                    d="M25 12a7 7 0 0 1 14 0v14a7 7 0 0 1-14 0V12Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 24a14 14 0 0 0 28 0M32 38v7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M22 46h20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M17 53c8-8 17-8 25-1 3 2.6 6 2.5 9-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="51"
                    cy="51.5"
                    r="3.8"
                    fill="rgba(255,255,255,0.28)"
                    stroke="currentColor"
                    strokeWidth="2.4"
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
