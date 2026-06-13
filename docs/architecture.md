# Voice Canvas 架构文档

## 系统架构

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │ HTTP/WebSocket
       │
┌──────▼──────────────┐
│   FastAPI Backend   │
│  ┌──────────────┐   │
│  │  API Routes  │   │
│  ├──────────────┤   │
│  │   Services   │   │
│  │  - LLM       │   │
│  │  - Auth      │   │
│  └──────────────┘   │
└──────┬──────────────┘
       │
┌──────▼──────┐
│ PostgreSQL  │
└─────────────┘
       │
┌──────▼────────┐
│  OpenAI API   │
│ (or compatible)│
└───────────────┘
```

## 数据流

### 语音命令处理流程

```
1. 用户语音
   ↓
2. 浏览器语音识别 (Web Speech API / 百度ASR)
   ↓
3. 文本 → Frontend
   ↓
4. POST /api/voice/command
   ↓
5. Backend → LLM Service
   ↓
6. OpenAI API (理解命令)
   ↓
7. JSON命令 ← Backend
   ↓
8. Frontend执行绘图命令
   ↓
9. Konva Canvas 渲染
```

## 命令格式设计

### LLM返回格式

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
  "response": "好的，我画了一个红色的圆形"
}
```

### 支持的命令类型

1. **create** - 创建新对象
2. **modify** - 修改对象属性
3. **move** - 移动对象位置
4. **delete** - 删除对象
5. **clear** - 清空画布
6. **undo** - 撤销操作

### 支持的图形类型

- **基础图形**: circle, rect, line, text, star, triangle
- **组合图形**: house, animal, tree, person (使用 group)

## 数据库设计

详见 `backend/init.sql`

核心表：
- `users` - 用户信息
- `canvases` - 画布数据
- `chat_history` - 对话历史
- `llm_configs` - LLM配置

## 安全考虑

1. **认证**: JWT token
2. **授权**: 用户只能访问自己的画布
3. **API Key保护**: 存储在数据库，不暴露给前端
4. **SQL注入防护**: 使用ORM参数化查询
5. **CORS**: 配置允许的源

## 性能优化

1. **数据库索引**: 用户ID、画布ID等
2. **异步IO**: FastAPI + asyncpg
3. **前端状态管理**: Zustand 轻量级
4. **Canvas性能**: Konva 对象复用

## 扩展性

1. **水平扩展**: 无状态后端，可部署多实例
2. **存储扩展**: 可添加对象存储（S3）用于图片
3. **缓存层**: 可添加Redis缓存热数据
4. **消息队列**: 可添加异步任务处理

## 监控与日志

- FastAPI 自动生成 OpenAPI 文档
- 请求日志记录
- 错误追踪
- 数据库查询日志
