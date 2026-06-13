import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layout,
  Button,
  Card,
  Row,
  Col,
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
  EditOutlined,
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
          <div className="content-header">
            <h2>我的画布</h2>
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
            <Empty
              description="还没有画布，点击新建画布开始创作"
              style={{ marginTop: 100 }}
            />
          ) : (
            <Row gutter={[24, 24]} className="canvas-grid">
              {canvases.map((canvas) => (
                <Col xs={24} sm={12} md={8} lg={6} key={canvas.id}>
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
                            <EditOutlined style={{ fontSize: 48 }} />
                          </div>
                        )}
                      </div>
                    }
                    actions={[
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => handleDeleteCanvas(canvas.id, e)}
                      >
                        删除
                      </Button>,
                    ]}
                  >
                    <Card.Meta
                      title={canvas.title}
                      description={
                        <>
                          <p>创建时间: {new Date(canvas.created_at).toLocaleDateString()}</p>
                          <p>更新时间: {new Date(canvas.updated_at).toLocaleDateString()}</p>
                        </>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
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
