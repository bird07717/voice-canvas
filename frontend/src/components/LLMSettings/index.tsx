import { useState, useEffect } from 'react'
import {
  Form,
  Input,
  Button,
  List,
  Card,
  Modal,
  message,
  Space,
  Tag,
  Popconfirm,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useLLMStore } from '@/stores/llmStore'
import { apiService } from '@/services/api'
import './LLMSettings.css'

export default function LLMSettings() {
  const { configs, setConfigs } = useLLMStore()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingConfig, setEditingConfig] = useState<any>(null)
  const [form] = Form.useForm()
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const data = await apiService.getLLMConfigs()
      setConfigs(data)
    } catch (error) {
      message.error('加载配置失败')
    }
  }

  const handleAdd = () => {
    setEditingConfig(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (config: any) => {
    setEditingConfig(config)
    form.setFieldsValue(config)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await apiService.deleteLLMConfig(id)
      message.success('删除成功')
      loadConfigs()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleActivate = async (id: number) => {
    try {
      await apiService.activateLLMConfig(id)
      message.success('激活成功')
      loadConfigs()
    } catch (error) {
      message.error('激活失败')
    }
  }

  const handleTest = async () => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      const result = await apiService.testLLMConnection({
        base_url: values.base_url,
        api_key: values.api_key,
        model_name: values.model_name,
      })

      if (result.success) {
        message.success('连接测试成功')
      } else {
        message.error('连接测试失败：' + result.message)
      }
    } catch (error: any) {
      message.error('测试失败：' + (error.message || '未知错误'))
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (editingConfig) {
        await apiService.updateLLMConfig(editingConfig.id, values)
        message.success('更新成功')
      } else {
        await apiService.createLLMConfig(values)
        message.success('添加成功')
      }

      setModalVisible(false)
      loadConfigs()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  return (
    <div className="llm-settings">
      <div className="settings-header">
        <h3>LLM 模型配置</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          size="small"
        >
          添加
        </Button>
      </div>

      <List
        dataSource={configs}
        renderItem={(config) => (
          <Card
            className={`config-card ${config.is_active ? 'active' : ''}`}
            size="small"
          >
            <div className="config-header">
              <div className="config-name">
                {config.name}
                {config.is_active && (
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    激活
                  </Tag>
                )}
              </div>
              <Space size="small">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  size="small"
                  onClick={() => handleEdit(config)}
                />
                <Popconfirm
                  title="确定删除？"
                  onConfirm={() => handleDelete(config.id)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
              </Space>
            </div>
            <div className="config-info">
              <p>模型: {config.model_name}</p>
              <p>URL: {config.base_url}</p>
            </div>
            {!config.is_active && (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleActivate(config.id)}
              >
                设为激活
              </Button>
            )}
          </Card>
        )}
      />

      <Modal
        title={editingConfig ? '编辑配置' : '添加配置'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="test" onClick={handleTest} loading={testing}>
            测试连接
          </Button>,
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit}>
            确定
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如：OpenAI GPT-4" />
          </Form.Item>

          <Form.Item
            name="base_url"
            label="Base URL"
            rules={[{ required: true, message: '请输入Base URL' }]}
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>

          <Form.Item
            name="api_key"
            label="API Key"
            rules={[{ required: true, message: '请输入API Key' }]}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          <Form.Item
            name="model_name"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
            initialValue="gpt-3.5-turbo"
          >
            <Input placeholder="gpt-3.5-turbo" />
          </Form.Item>
        </Form>
      </Modal>

      <div className="llm-tips">
        <h4>说明：</h4>
        <ul>
          <li>仅支持 OpenAI 格式的 API</li>
          <li>可配置多个模型，但同时只能激活一个</li>
          <li>激活的模型将用于语音命令处理</li>
        </ul>
      </div>
    </div>
  )
}
