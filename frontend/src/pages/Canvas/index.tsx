import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Layout,
  Button,
  Select,
  message,
  Modal,
  Input,
  Spin,
} from 'antd'
import {
  ArrowLeftOutlined,
  ExportOutlined,
  SaveOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons'
import { useCanvasStore } from '@/stores/canvasStore'
import { useLLMStore } from '@/stores/llmStore'
import { apiService } from '@/services/api'
import CanvasBoard from '@/components/CanvasBoard'
import VoiceControl from '@/components/VoiceControl'
import ChatPanel from '@/components/ChatPanel'
import StatusBar from '@/components/StatusBar'
import './Canvas.css'

const { Header } = Layout

export default function Canvas() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [canvasTitle, setCanvasTitle] = useState('新画布')
  const [loading, setLoading] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const {
    currentCanvasId,
    setCurrentCanvasId,
    loadCanvasJson,
    canvasObjects,
    undo,
    redo,
    stageRef,
  } = useCanvasStore()

  const { configs, activeConfig, setConfigs } = useLLMStore()

  useEffect(() => {
    if (id) {
      loadCanvas(parseInt(id))
      loadLLMConfigs()
    }
  }, [id])

  useEffect(() => {
    // 监听画布变化
    if (canvasObjects.length > 0 || currentCanvasId) {
      setHasUnsavedChanges(true)
    }
  }, [canvasObjects])

  const loadCanvas = async (canvasId: number) => {
    try {
      const canvas = await apiService.getCanvas(canvasId)
      setCurrentCanvasId(canvasId)
      setCanvasTitle(canvas.title)
      loadCanvasJson(canvas.canvas_json)
    } catch (error) {
      message.error('加载画布失败')
    } finally {
      setLoading(false)
    }
  }

  const loadLLMConfigs = async () => {
    try {
      const configs = await apiService.getLLMConfigs()
      setConfigs(configs)
    } catch (error) {
      console.error('加载LLM配置失败', error)
    }
  }

  const handleSave = async () => {
    if (!currentCanvasId) return false

    try {
      await apiService.updateCanvas(currentCanvasId, {
        title: canvasTitle,
        canvas_json: {
          objects: canvasObjects,
          version: '1.0',
        },
      })
      message.success('保存成功')
      setHasUnsavedChanges(false)
      return true
    } catch (error) {
      message.error('保存失败')
      return false
    }
  }

  const handleExport = () => {
    if (!stageRef) return false

    try {
      const dataURL = stageRef.toDataURL({ pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `${canvasTitle}.png`
      link.href = dataURL
      link.click()
      message.success('导出成功')
      return true
    } catch (error) {
      message.error('导出失败')
      return false
    }
  }

  const handleBack = () => {
    if (hasUnsavedChanges) {
      Modal.confirm({
        title: '未保存的更改',
        content: '您有未保存的更改，是否保存？',
        okText: '保存',
        cancelText: '不保存',
        onOk: async () => {
          await handleSave()
          navigate('/home')
        },
        onCancel: () => {
          navigate('/home')
        },
      })
    } else {
      navigate('/home')
    }
  }

  const handleModelChange = async (configId: number) => {
    try {
      await apiService.activateLLMConfig(configId)
      await loadLLMConfigs()
      message.success('切换模型成功')
    } catch (error) {
      message.error('切换模型失败')
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <Layout className="canvas-page">
      <Header className="canvas-header">
        <div className="header-left">
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Input
            className="canvas-title"
            value={canvasTitle}
            onChange={(e) => setCanvasTitle(e.target.value)}
            bordered={false}
            style={{ width: 200 }}
          />
        </div>
        <div className="header-right">
          <Select
            className="model-selector"
            value={activeConfig?.id}
            onChange={handleModelChange}
            placeholder="选择模型"
            style={{ minWidth: 200 }}
            options={configs.map((c) => ({
              label: `${c.name} (${c.model_name})`,
              value: c.id,
            }))}
          />
          <Button icon={<UndoOutlined />} onClick={undo}>
            撤销
          </Button>
          <Button icon={<RedoOutlined />} onClick={redo}>
            重做
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSave} type="primary">
            保存
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出PNG
          </Button>
        </div>
      </Header>

      <div className="canvas-main">
        <div className="canvas-sidebar">
          <VoiceControl onSave={handleSave} onExport={handleExport} />
        </div>

        <div className="canvas-center">
          <div className="canvas-area">
            <CanvasBoard />
          </div>
          <StatusBar />
        </div>

        <ChatPanel />
      </div>
    </Layout>
  )
}
