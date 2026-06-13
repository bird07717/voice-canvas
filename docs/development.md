# Voice Canvas 开发指南

## 开发环境设置

### 1. 安装依赖

#### 后端开发环境
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 前端开发环境
```bash
cd frontend
npm install
```

### 2. 数据库设置

#### 方式一：使用 Docker（推荐）
```bash
docker-compose up -d postgres
```

#### 方式二：本地 PostgreSQL
```bash
# 创建数据库
createdb voice_canvas

# 导入初始化脚本
psql voice_canvas < backend/init.sql
```

### 3. 环境变量配置

复制并编辑 `.env` 文件：
```bash
cp .env.example .env
```

必须配置的环境变量：
```env
# 数据库
DATABASE_URL=postgresql+asyncpg://admin:postgres123@localhost:5432/voice_canvas

# JWT密钥（生产环境请更换）
SECRET_KEY=your-secret-key-change-in-production

# CORS（开发环境）
CORS_ORIGINS=http://localhost:3000
```

### 4. 启动开发服务器

#### 后端
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 前端
```bash
cd frontend
npm run dev
```

访问：
- 前端: http://localhost:3000
- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs

## 项目结构说明

### 后端结构

```
backend/
├── app/
│   ├── api/              # API 路由
│   │   ├── auth.py      # 认证相关
│   │   ├── canvas.py    # 画布管理
│   │   ├── voice.py     # 语音命令
│   │   └── llm.py       # LLM配置
│   ├── models/          # SQLAlchemy 模型
│   ├── schemas/         # Pydantic schemas
│   ├── services/        # 业务逻辑
│   │   └── llm_service.py  # LLM服务
│   ├── core/            # 核心配置
│   │   ├── config.py    # 配置
│   │   ├── database.py  # 数据库
│   │   ├── security.py  # 安全
│   │   └── deps.py      # 依赖注入
│   └── main.py          # FastAPI 应用入口
```

### 前端结构

```
frontend/src/
├── pages/               # 页面组件
│   ├── Login/          # 登录页
│   ├── Home/           # 首页
│   └── Canvas/         # 画布页
├── components/          # UI 组件
│   ├── CanvasBoard/    # 画布组件
│   ├── VoiceControl/   # 语音控制
│   ├── ChatPanel/      # 对话面板
│   ├── LLMSettings/    # LLM设置
│   └── StatusBar/      # 状态栏
├── stores/             # Zustand 状态管理
│   ├── authStore.ts    # 认证状态
│   ├── canvasStore.ts  # 画布状态
│   ├── voiceStore.ts   # 语音状态
│   └── llmStore.ts     # LLM状态
├── services/           # API 服务
│   ├── api.ts         # HTTP 客户端
│   └── voiceService.ts # 语音识别
└── types/             # TypeScript 类型定义
```

## 开发工作流

### 添加新的 API 接口

1. **定义 Schema** (`backend/app/schemas/`)
```python
class MyRequest(BaseModel):
    field: str

class MyResponse(BaseModel):
    result: str
```

2. **创建路由** (`backend/app/api/`)
```python
@router.post("/my-endpoint", response_model=MyResponse)
async def my_endpoint(
    request: MyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 业务逻辑
    return MyResponse(result="success")
```

3. **注册路由** (`backend/app/main.py`)
```python
from app.api import my_routes
app.include_router(my_routes.router)
```

4. **前端调用** (`frontend/src/services/api.ts`)
```typescript
async myEndpoint(data: MyRequest) {
  const response = await this.client.post('/api/my-endpoint', data)
  return response.data
}
```

### 添加新的画布图形

1. **更新 LLM Prompt** (`backend/app/services/llm_service.py`)
   - 在 `SYSTEM_PROMPT` 中添加新图形的描述和参数

2. **前端渲染** (`frontend/src/components/CanvasBoard/index.tsx`)
```tsx
case 'my-shape':
  return <MyShape {...commonProps} />
```

### 数据库迁移

使用 Alembic（可选）：
```bash
cd backend
alembic init alembic
alembic revision --autogenerate -m "Add new table"
alembic upgrade head
```

或直接修改 `init.sql` 并重建数据库。

## 常见开发任务

### 添加新的语音命令

1. 更新 LLM System Prompt
2. 测试命令理解
3. 实现前端渲染逻辑

### 优化 LLM Prompt

编辑 `backend/app/services/llm_service.py` 中的 `SYSTEM_PROMPT`

### 修改数据库结构

1. 修改 `backend/app/models/`
2. 更新 `backend/init.sql`
3. 重建数据库或运行迁移

### 添加新页面

1. 创建页面组件 `frontend/src/pages/MyPage/`
2. 在 `App.tsx` 中添加路由
3. 添加导航链接

## 调试技巧

### 后端调试

1. **查看日志**
```bash
docker-compose logs -f backend
```

2. **进入容器**
```bash
docker exec -it voice_canvas_backend bash
```

3. **使用 Python debugger**
```python
import pdb; pdb.set_trace()
```

### 前端调试

1. **浏览器开发工具**
   - Network: 查看 API 请求
   - Console: 查看日志
   - React DevTools: 查看组件状态

2. **Zustand DevTools**
```typescript
// 在 store 中启用
devtools: true
```

### 数据库调试

```bash
# 进入 PostgreSQL
docker exec -it voice_canvas_postgres psql -U admin -d voice_canvas

# 查询
SELECT * FROM users;
SELECT * FROM canvases;
SELECT * FROM llm_configs;
```

## 测试

### 后端测试

```bash
cd backend
pytest
```

### 前端测试

```bash
cd frontend
npm test
```

## 代码规范

### Python (后端)

- 遵循 PEP 8
- 使用类型注解
- 使用 `black` 格式化

```bash
pip install black
black app/
```

### TypeScript (前端)

- 使用 ESLint
- 严格类型检查

```bash
npm run lint
```

## 性能优化

### 后端

1. 使用数据库索引
2. 异步操作
3. 连接池配置

### 前端

1. React.memo 优化组件
2. 懒加载路由
3. Canvas 性能优化（避免频繁重绘）

## 部署

### Docker 生产环境

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 环境变量配置

生产环境必须修改：
- `SECRET_KEY`: 使用强随机密钥
- `DATABASE_URL`: 生产数据库地址
- `CORS_ORIGINS`: 生产域名

## 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查 PostgreSQL 是否启动
   - 验证 DATABASE_URL 配置

2. **前端请求失败**
   - 检查后端是否运行
   - 验证 CORS 配置

3. **LLM 调用失败**
   - 检查 API Key 是否有效
   - 验证 Base URL 配置
   - 查看后端日志

4. **语音识别不工作**
   - 检查浏览器支持（Chrome/Edge）
   - 允许麦克风权限
   - HTTPS 环境（生产环境必需）

## 资源链接

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [React 文档](https://react.dev/)
- [Konva 文档](https://konvajs.org/)
- [Ant Design 文档](https://ant.design/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
