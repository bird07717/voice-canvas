import { useState } from 'react'
import { Form, Input, Button, Card, message, Space, Divider } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useVoiceStore } from '@/stores/voiceStore'
import { apiService } from '@/services/api'
import './BaiduASRSettings.css'

const DEFAULT_BAIDU_APP_ID = '123697514'

export default function BaiduASRSettings() {
  const { baiduConfig, setBaiduConfig } = useVoiceStore()
  const [form] = Form.useForm()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTest = async () => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      setTestResult(null)

      await apiService.testBaiduASR({
        api_key: values.apiKey,
        secret_key: values.secretKey,
      })

      setTestResult({
        success: true,
        message: '连接测试成功！百度ASR配置有效'
      })
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `测试失败: ${error.message || '网络错误'}`
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setBaiduConfig({
        appId: values.appId,
        apiKey: values.apiKey,
        secretKey: values.secretKey
      })
      message.success('保存成功！下次使用语音识别将优先使用百度实时ASR')
    } catch (error) {
      message.error('保存失败，请检查输入')
    }
  }

  const handleDisable = () => {
    setBaiduConfig(null)
    form.resetFields()
    message.success('已禁用百度ASR，将使用浏览器识别（降级方案）')
  }

  return (
    <div className="baidu-asr-settings">
      <Card title="百度语音识别配置" size="small">
        <Form
          form={form}
          layout="vertical"
          initialValues={{ appId: DEFAULT_BAIDU_APP_ID, ...(baiduConfig || {}) }}
        >
          <Form.Item
            name="appId"
            label="AppID"
            rules={[{ required: true, message: '请输入AppID' }]}
          >
            <Input
              placeholder="请输入百度应用AppID"
              disabled={!baiduConfig && baiduConfig !== null}
            />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入API Key' }]}
          >
            <Input.TextArea
              placeholder="请输入百度API Key"
              rows={2}
              disabled={!baiduConfig && baiduConfig !== null}
            />
          </Form.Item>

          <Form.Item
            name="secretKey"
            label="Secret Key"
            rules={[{ required: true, message: '请输入Secret Key' }]}
          >
            <Input.TextArea
              placeholder="请输入百度Secret Key"
              rows={2}
              disabled={!baiduConfig && baiduConfig !== null}
            />
          </Form.Item>

          <Space direction="vertical" style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button onClick={handleTest} loading={testing}>
                测试连接
              </Button>
              <Space>
                <Button type="primary" onClick={handleSave}>
                  保存配置
                </Button>
                {baiduConfig && (
                  <Button danger onClick={handleDisable}>
                    禁用
                  </Button>
                )}
              </Space>
            </Space>

            {testResult && (
              <div
                className={`test-result ${testResult.success ? 'success' : 'error'}`}
              >
                {testResult.success ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                )}
                <span style={{ marginLeft: 8 }}>{testResult.message}</span>
              </div>
            )}
          </Space>
        </Form>

        <Divider />

        <div className="baidu-info">
          <h4>说明：</h4>
          <ul>
            <li>配置百度ASR后，将优先使用百度实时语音识别</li>
            <li>如未配置或实时连接失败，将自动降级到浏览器识别</li>
            <li>AppID、API Key和Secret Key可在百度智能云控制台获取</li>
            <li>获取地址：<a href="https://console.bce.baidu.com/ai/#/ai/speech/overview/index" target="_blank" rel="noopener noreferrer">百度AI开放平台</a></li>
          </ul>

          <h4>当前状态：</h4>
          <p>
            {baiduConfig ? (
              <span style={{ color: '#52c41a' }}>✅ 已配置百度ASR</span>
            ) : (
              <span style={{ color: '#faad14' }}>⚠️ 未配置，将使用浏览器识别（降级方案）</span>
            )}
          </p>
        </div>
      </Card>
    </div>
  )
}
