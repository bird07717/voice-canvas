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
            <span>Voice to visual canvas</span>
            <strong>把语音灵感变成可编辑画布</strong>
          </div>
          <div className="preview-canvas">
            <div className="preview-toolbar">
              <span />
              <span />
              <span />
            </div>
            <svg className="preview-drawing" viewBox="0 0 520 330">
              <path
                className="preview-curve"
                d="M56 235C116 170 162 260 222 196S333 120 430 178"
              />
              <rect
                className="preview-shape preview-rect"
                x="76"
                y="88"
                width="110"
                height="76"
                rx="16"
              />
              <circle
                className="preview-shape preview-circle"
                cx="346"
                cy="130"
                r="55"
              />
              <path
                className="preview-shape preview-star"
                d="M260 74l16 35 38 4-28 26 8 37-34-19-34 19 8-37-28-26 38-4 16-35Z"
              />
              <rect
                className="preview-selection"
                x="291"
                y="75"
                width="110"
                height="110"
                rx="8"
              />
              <circle className="preview-handle" cx="291" cy="75" r="5" />
              <circle className="preview-handle" cx="401" cy="75" r="5" />
              <circle className="preview-handle" cx="401" cy="185" r="5" />
              <circle className="preview-handle" cx="291" cy="185" r="5" />
            </svg>
            <div className="preview-command">画一个红色圆</div>
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
