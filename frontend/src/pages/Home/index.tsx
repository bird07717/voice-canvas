import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layout,
  Button,
  Card,
  message,
  Modal,
  Empty,
  Spin,
  Tabs,
} from 'antd'
import {
  PlusOutlined,
  LogoutOutlined,
  SettingOutlined,
  DeleteOutlined,
  AudioOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/authStore'
import { apiService } from '@/services/api'
import { CanvasData } from '@/types'
import LLMSettings from '@/components/LLMSettings'
import BaiduASRSettings from '@/components/BaiduASRSettings'
import './Home.css'

const { Header, Content } = Layout

export default function Home() {
  const navigate = useNavigate()
  const { username, clearAuth } = useAuthStore()
  const [canvases, setCanvases] = useState<CanvasData[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsVisible, setSettingsVisible] = useState(false)

  useEffect(() => {
    loadCanvases()
  }, [])

  const loadCanvases = async () => {
    try {
      const data = await apiService.getCanvases()
      setCanvases(data)
    } catch (error) {
      message.error('加载画布列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      onOk: async () => {
        try {
          await apiService.logout()
          clearAuth()
          navigate('/login')
        } catch (error) {
          clearAuth()
          navigate('/login')
        }
      },
    })
  }

  const handleCreateCanvas = async () => {
    try {
      const newCanvas = await apiService.createCanvas({
        title: '新画布',
        canvas_json: { objects: [], version: '1.0' },
      })
      message.success('创建成功')
      navigate(`/canvas/${newCanvas.id}`)
    } catch (error) {
      message.error('创建失败')
    }
  }

  const handleDeleteCanvas = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个画布吗？',
      onOk: async () => {
        try {
          await apiService.deleteCanvas(id)
          message.success('删除成功')
          loadCanvases()
        } catch (error) {
          message.error('删除失败')
        }
      },
    })
  }

  return (
    <Layout className="home-layout">
      <Header className="home-header">
        <div className="header-left">
          <div className="home-logo" aria-hidden="true">
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
        </div>
        <div className="header-right">
          <span className="username">欢迎，{username}</span>
          <Button icon={<SettingOutlined />} onClick={() => setSettingsVisible(true)}>
            设置
          </Button>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出
          </Button>
        </div>
      </Header>

      <Layout>
        <Content className="home-content">
          <div className="home-workbench">
            <div className="workbench-ambient" aria-hidden="true">
              <svg className="ambient-sketch" viewBox="0 0 460 280">
                <path
                  className="ambient-gridline"
                  d="M24 54H436M24 102H436M24 150H436M24 198H436M24 246H436"
                />
                <path
                  className="ambient-gridline"
                  d="M70 24V256M122 24V256M174 24V256M226 24V256M278 24V256M330 24V256M382 24V256"
                />
                <path
                  className="ambient-wave"
                  d="M58 214c54-25 112-28 174-8 62 20 118 16 168-20"
                />
                <path
                  className="ambient-cloud"
                  d="M94 86h58c10 0 18-7 18-16s-8-16-18-16c-4 0-7 1-10 3-6-10-16-16-28-16-17 0-31 13-31 29 0 6 1 11 4 16h7Z"
                />
                <path className="ambient-roof" d="M178 154l48-39 48 39Z" />
                <rect className="ambient-house" x="191" y="154" width="70" height="54" rx="8" />
                <circle className="ambient-sun" cx="354" cy="72" r="21" />
                <rect className="ambient-trunk" x="326" y="156" width="16" height="48" rx="5" />
                <circle className="ambient-tree" cx="334" cy="135" r="31" />
                <circle className="ambient-tree ambient-tree-light" cx="362" cy="143" r="22" />
              </svg>
              <div className="ambient-voice">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="content-header">
              <div>
                <h2>我的画布</h2>
                <p>选择一个画布，开始用语音控制绘画。</p>
              </div>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateCanvas}
                size="large"
              >
                新建画布
              </Button>
            </div>

            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : canvases.length === 0 ? (
              <div className="empty-workbench">
                <Empty description="还没有画布" />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateCanvas}
                >
                  创建第一张画布
                </Button>
              </div>
            ) : (
              <div className="canvas-grid">
                {canvases.map((canvas) => (
                  <Card
                    hoverable
                    className="canvas-card"
                    onClick={() => navigate(`/canvas/${canvas.id}`)}
                    cover={
                      <div className="canvas-thumbnail">
                        {canvas.thumbnail_url ? (
                          <img src={canvas.thumbnail_url} alt={canvas.title} />
                        ) : (
                          <div className="thumbnail-placeholder">
                            <div className="thumbnail-toolbar">
                              <span />
                              <span />
                              <span />
                            </div>
                            <div className="thumbnail-voice">
                              <AudioOutlined />
                              <span>语音绘画</span>
                            </div>
                            <svg viewBox="0 0 320 190" className="thumbnail-art">
                              <circle cx="246" cy="52" r="20" className="thumb-sun" />
                              <path
                                d="M54 74h58c10 0 18-7 18-16s-8-16-18-16c-4 0-7 1-10 3-6-10-16-16-28-16-17 0-31 13-31 29 0 6 1 11 4 16h7Z"
                                className="thumb-cloud"
                              />
                              <path d="M88 120l44-36 44 36Z" className="thumb-roof" />
                              <rect x="100" y="120" width="64" height="48" rx="6" className="thumb-wall" />
                              <rect x="126" y="140" width="16" height="28" rx="4" className="thumb-door" />
                              <rect x="218" y="124" width="14" height="42" rx="4" className="thumb-trunk" />
                              <circle cx="225" cy="108" r="28" className="thumb-tree" />
                              <circle cx="249" cy="116" r="20" className="thumb-tree-light" />
                              <path
                                d="M52 174c46-20 94-21 144-6 42 13 78 8 108-12"
                                className="thumb-path"
                              />
                            </svg>
                          </div>
                        )}
                        <Button
                          type="text"
                          danger
                          className="canvas-delete-btn"
                          icon={<DeleteOutlined />}
                          onClick={(e) => handleDeleteCanvas(canvas.id, e)}
                          title="删除画布"
                        />
                      </div>
                    }
                  >
                    <div className="canvas-card-body">
                      <div>
                        <h3>{canvas.title}</h3>
                        <p>更新于 {new Date(canvas.updated_at).toLocaleDateString()}</p>
                      </div>
                      <span className="canvas-tag">语音绘画</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Content>
      </Layout>

      {/* 设置抽屉 */}
      <Modal
        title="系统设置"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Tabs
          items={[
            {
              key: 'llm',
              label: 'LLM模型配置',
              children: <LLMSettings />,
            },
            {
              key: 'baidu',
              label: '百度语音识别',
              children: <BaiduASRSettings />,
            },
          ]}
        />
      </Modal>
    </Layout>
  )
}
