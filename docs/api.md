# Voice Canvas API 接口文档

## 基础信息

- Base URL: `http://localhost:8000`
- 认证方式: JWT Bearer Token
- 内容类型: `application/json`

## 认证相关

### 登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}
```

**响应:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 登出
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

## 画布管理

### 获取画布列表
```http
GET /api/canvases
Authorization: Bearer <token>
```

**响应:**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "title": "我的画布",
    "canvas_json": {
      "objects": [...],
      "version": "1.0"
    },
    "thumbnail_url": null,
    "created_at": "2024-01-01T00:00:00",
    "updated_at": "2024-01-01T00:00:00"
  }
]
```

### 创建画布
```http
POST /api/canvases
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "新画布",
  "canvas_json": {
    "objects": [],
    "version": "1.0"
  }
}
```

### 更新画布
```http
PUT /api/canvases/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "更新标题",
  "canvas_json": {
    "objects": [...],
    "version": "1.0"
  }
}
```

### 删除画布
```http
DELETE /api/canvases/{id}
Authorization: Bearer <token>
```

## 语音命令

### 处理语音命令
```http
POST /api/voice/command
Authorization: Bearer <token>
Content-Type: application/json

{
  "canvas_id": 1,
  "text": "画一个红色的圆",
  "llm_config_id": 1  // 可选
}
```

**响应:**
```json
{
  "commands": [
    {
      "action": "create",
      "type": "circle",
      "id": "obj_1",
      "params": {
        "x": 400,
        "y": 300,
        "radius": 50,
        "fill": "red",
        "stroke": "black",
        "strokeWidth": 2
      }
    }
  ],
  "response": "好的，我画了一个红色的圆形",
  "chat_history": [...]
}
```

### 获取对话历史
```http
GET /api/voice/chat/{canvas_id}/history
Authorization: Bearer <token>
```

## LLM 配置管理

### 获取 LLM 配置列表
```http
GET /api/llm/configs
Authorization: Bearer <token>
```

**响应:**
```json
[
  {
    "id": 1,
    "user_id": 1,
    "name": "OpenAI GPT-4",
    "base_url": "https://api.openai.com/v1",
    "api_key": "sk-...",
    "model_name": "gpt-4",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00"
  }
]
```

### 添加 LLM 配置
```http
POST /api/llm/configs
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "OpenAI GPT-3.5",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "model_name": "gpt-3.5-turbo"
}
```

### 更新 LLM 配置
```http
PUT /api/llm/configs/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新名称",
  "api_key": "sk-new-key"
}
```

### 删除 LLM 配置
```http
DELETE /api/llm/configs/{id}
Authorization: Bearer <token>
```

### 激活 LLM 配置
```http
POST /api/llm/configs/{id}/activate
Authorization: Bearer <token>
```

### 测试 LLM 连接
```http
POST /api/llm/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-...",
  "model_name": "gpt-3.5-turbo"
}
```

**响应:**
```json
{
  "success": true,
  "message": "Connection successful"
}
```

## 绘图命令格式

### 命令结构
```typescript
interface DrawCommand {
  action: 'create' | 'modify' | 'move' | 'delete' | 'clear' | 'undo'
  type?: string
  id?: string
  target?: string
  params?: object
  children?: object[]
}
```

### 创建图形
```json
{
  "action": "create",
  "type": "circle",
  "id": "obj_1",
  "params": {
    "x": 400,
    "y": 300,
    "radius": 50,
    "fill": "red",
    "stroke": "black",
    "strokeWidth": 2
  }
}
```

### 修改图形
```json
{
  "action": "modify",
  "target": "obj_1",
  "params": {
    "fill": "blue"
  }
}
```

### 移动图形
```json
{
  "action": "move",
  "target": "obj_1",
  "params": {
    "x": 200,
    "y": 150
  }
}
```

### 删除图形
```json
{
  "action": "delete",
  "target": "obj_1"
}
```

### 清空画布
```json
{
  "action": "clear"
}
```

### 撤销
```json
{
  "action": "undo"
}
```

## 错误响应

所有错误响应格式:
```json
{
  "detail": "错误信息"
}
```

常见状态码:
- `200` - 成功
- `201` - 创建成功
- `204` - 删除成功（无内容）
- `400` - 请求参数错误
- `401` - 未授权
- `404` - 资源不存在
- `500` - 服务器错误
