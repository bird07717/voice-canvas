# 百度语音识别集成说明

## 概述

Voice Canvas 已集成百度语音识别（ASR），并将浏览器原生 Web Speech API 作为降级方案。

## 功能特性

### 1. 智能降级策略

- **优先使用百度ASR**：如果配置了百度API Key和Secret Key，将使用百度语音识别
- **自动降级**：如果百度ASR不可用或配置失败，自动降级到浏览器Web Speech API
- **实时提示**：界面会显示当前使用的识别方式（百度ASR / 浏览器识别）

### 2. 百度ASR优势

- ✅ 识别准确率更高
- ✅ 支持普通话、粤语、英语、四川话等多种语言
- ✅ 更好的噪音处理
- ✅ 支持自定义词库（后续可扩展）

### 3. Web Speech API（降级方案）

- ✅ 无需配置，开箱即用
- ✅ 免费使用
- ⚠️ 仅支持Chrome/Edge浏览器
- ⚠️ 识别准确率一般

## 使用方式

### 配置百度ASR

1. **获取API密钥**
   - 访问 [百度AI开放平台](https://console.bce.baidu.com/ai/#/ai/speech/overview/index)
   - 创建应用获取 API Key 和 Secret Key

2. **在应用中配置**
   - 进入画布页面
   - 点击侧边栏"百度ASR"标签
   - 输入 API Key 和 Secret Key
   - 点击"测试连接"验证
   - 点击"保存配置"

3. **开始使用**
   - 切换到"语音控制"标签
   - 点击"开始语音识别"
   - 界面会显示"百度ASR"标签表示正在使用百度识别

### 使用降级方案

如果不配置百度ASR，系统会自动使用浏览器识别：

1. 使用 Chrome 或 Edge 浏览器
2. 允许麦克风权限
3. 点击"开始语音识别"即可
4. 界面会显示"浏览器识别"标签

## 技术实现

### 1. 鉴权流程

```typescript
// 1. 获取 access_token（有效期30天）
POST https://aip.baidubce.com/oauth/2.0/token
参数:
  grant_type=client_credentials
  client_id={API Key}
  client_secret={Secret Key}

// 2. 使用 access_token 调用ASR接口
POST http://vop.baidu.com/server_api
```

### 2. 音频格式

- **采样率**: 16000 Hz
- **声道**: 单声道（mono）
- **格式**: WebM（浏览器录音） → 转换提交给百度
- **最大时长**: 55秒（百度限制60秒）

### 3. 识别流程

```
用户点击开始
  ↓
检查百度配置
  ↓
获取麦克风权限
  ↓
开始录音（MediaRecorder）
  ↓
用户说话或自动停止（55秒）
  ↓
将音频转为Base64
  ↓
调用百度ASR API
  ↓
返回识别文本
  ↓
发送给LLM处理
```

## 当前配置

项目已预置百度API密钥（测试用）：

```typescript
apiKey: 'SRU3kShktNWWRZrw4mANivzE'
secretKey: 'm95tXCJZAtacKdYXAARtCNgtk5bBj8iS'
```

**注意**：生产环境请使用您自己的API密钥！

## API说明

### 获取Access Token

```http
POST https://aip.baidubce.com/oauth/2.0/token
参数:
  grant_type=client_credentials
  client_id={API Key}
  client_secret={Secret Key}

响应:
{
  "access_token": "24.xxx",
  "expires_in": 2592000
}
```

### 语音识别（JSON方式）

```http
POST http://vop.baidu.com/server_api
Content-Type: application/json

{
  "format": "wav",
  "rate": 16000,
  "channel": 1,
  "cuid": "unique_device_id",
  "token": "{access_token}",
  "dev_pid": 1537,
  "speech": "{base64_audio}",
  "len": {audio_byte_length}
}

响应:
{
  "err_no": 0,
  "err_msg": "success.",
  "corpus_no": "xxx",
  "sn": "xxx",
  "result": ["识别的文本"]
}
```

## 支持的识别模型

| dev_pid | 语言 | 说明 |
|---------|------|------|
| 1537 | 普通话 | 默认，有标点 |
| 1737 | 英语 | 无标点 |
| 1637 | 粤语 | 有标点 |
| 1837 | 四川话 | 有标点 |

当前默认使用：**1537（普通话）**

## 错误处理

### 常见错误码

| err_no | 说明 | 处理方式 |
|--------|------|---------|
| 0 | 成功 | - |
| 3300 | 输入参数不正确 | 检查请求参数 |
| 3301 | 音频质量过差 | 重新录音 |
| 3302 | 鉴权失败 | 检查API Key |
| 3303 | 语音服务器后端问题 | 稍后重试 |
| 3304 | 用户的请求QPS超限额 | 降低请求频率 |
| 3305 | 用户的日pv超限额 | 次日重试 |

### 自动降级

如果百度ASR出现以下情况，会自动降级到Web Speech API：

- API Key配置错误
- 网络连接失败
- Token获取失败
- 识别请求失败

## 后续优化方向

1. **支持实时识别**：目前是录音完成后识别，可改为流式识别
2. **自定义词库**：添加画图相关专业词汇
3. **多语言支持**：支持切换识别语言
4. **语音唤醒**：支持"小助手"等唤醒词
5. **噪音消除**：前端音频预处理

## 测试建议

1. **测试百度ASR**
   - 配置API密钥
   - 说"画一个红色的圆形"
   - 观察识别准确率

2. **测试降级**
   - 禁用百度ASR配置
   - 使用相同命令测试
   - 对比两种方案的识别效果

3. **测试长语音**
   - 持续说话超过30秒
   - 验证自动停止机制

## 注意事项

1. **麦克风权限**：首次使用需要授权
2. **HTTPS要求**：生产环境必须使用HTTPS
3. **网络要求**：百度API需要可访问公网
4. **浏览器兼容**：建议使用Chrome 60+或Edge 79+
5. **成本控制**：百度ASR有免费额度，超出后收费

## 相关文件

- `frontend/src/services/voiceService.ts` - 语音识别服务核心逻辑
- `frontend/src/components/VoiceControl/` - 语音控制组件
- `frontend/src/components/BaiduASRSettings/` - 百度ASR配置组件
- `frontend/src/stores/voiceStore.ts` - 语音状态管理

## 参考文档

- [百度语音识别API文档](https://ai.baidu.com/ai-doc/SPEECH/Vk38lxily)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
