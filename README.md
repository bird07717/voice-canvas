# 🎨 Voice Canvas：基于分层意图路由与命令执行架构的 AI 语音绘图工具

> 七牛云 × XEngineer 暑期实训营 第 4 批次<br>
> 题目二：AI 语音绘图工具

Voice Canvas 是一个面向自然语言语音交互的 AI 绘图系统。用户可以直接通过语音控制画布，例如“画一个红色圆形”“把左边的树变大一点”“生成一个海边日落场景”。系统会将语音识别结果转化为结构化绘图意图，再通过本地规则、场景模板和大模型工具规划完成绘图。

![React](https://img.shields.io/badge/Frontend-React%2018-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178c6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169e1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Deploy-Docker-2496ed?logo=docker&logoColor=white)

## 📹 演示视频 ：哔哩哔哩：https://www.bilibili.com/video/BV1iTJK6hE95/

## ✨ 项目特点

- 🧠 **分层意图路由与命令执行架构**：前端快速解释、后端意图路由、规划器和统一命令执行器协同处理。
- 🛠️ **Function Calling 工具规划**：将自然语言转化为受控工具调用，而不是让模型直接操作画布。
- 🎯 **语义选择器系统**：支持“它”“刚才那个”“左边的树”“最大的气球”等上下文选择。
- 🔦 **高亮选择与歧义处理**：存在多个候选目标时，系统可以提示用户进一步确认。
- ⚙️ **Planner / Compiler / Executor 体系**：后端负责规划和命令编译，前端 `Canvas Command Executor` 统一执行画布命令。
- 🛡️ **降级容错设计**：百度 ASR 不可用时降级到 Web Speech API；简单命令不依赖 LLM。
- 🖼️ **场景级创作**：支持公园、海边日落、生日贺卡、城市夜景等完整场景生成。
- 🧩 **双场景形态**：模板场景由多个可编辑对象组成；开放式 SVG 场景作为一张整图 image 放入画布。

## 🏆 核心创新与原创部分

### 1. 分层意图路由与命令执行架构

Voice Canvas 的核心设计不是把所有语音请求都交给大模型，而是把自然语言输入逐步收敛为统一的 `DrawCommand`。前端负责快速解释和流程编排，后端负责意图路由与命令规划，最终由前端画布命令执行器统一修改画布状态。

```mermaid
flowchart TD
    A["用户语音输入"] --> B["语音识别"]
    B --> B1["百度 ASR"]
    B1 -->|失败或未配置| B2["降级：Web Speech API"]
    B1 -->|识别成功| B3["噪音与无关信息剥离"]
    B2 --> B3
    B3 --> C["前端 Command Orchestrator"]

    C -->|命中高频命令| D["Fast Command Interpreter"]
    C -->|未命中| E["Backend Intent Router"]

    E -->|本地素材对象| O["Local Asset/Object Compiler"]
    E -->|命中固定场景| F["Template Scene Compiler"]
    E -->|模板 + 额外描述| G["Scene Patch Planner"]
    E -->|开放式整图| S["Open SVG Scene Generator"]
    E -->|复杂编辑| H["LLM Tool Planner"]

    D --> I["Draw Commands"]
    O --> I
    F --> I
    G --> I
    S --> I
    H --> I

    I --> J["Canvas Command Executor"]
    J --> K["Canvas Store"]
    K --> L["Konva 画布渲染"]
```

前端 `Command Orchestrator` 负责语音识别流程、快速命令优先匹配、后端调用、歧义确认和 UI 状态管理。

语音识别阶段会先尝试百度 ASR，在服务不可用、未配置或识别失败时降级到浏览器 Web Speech API；识别文本进入理解链路前，会先剥离口头噪音、重复词和与绘图无关的信息，降低误触发风险。

`Fast Command Interpreter` 负责撤销、重做、保存、导出、基础图形创建、常见改色和移动等高频确定性操作。

`Backend Intent Router` 负责轻量分类：本地素材对象、固定模板场景、Scene Patch、开放式 SVG 整图和 LLM 工具规划。

`Canvas Command Executor` 是前端唯一的画布命令执行边界，所有路径都输出统一的 `DrawCommand[]` 后再修改画布。

场景输出有两个明确形态：模板场景和 Scene Patch 输出 `render_mode=object_scene`，适合对象级继续编辑；开放式 SVG 输出 `render_mode=svg_image`，适合自由视觉表达，但在画布上是一个整体 image。前端场景快捷按钮和模板快捷识别消费后端 `/api/voice/scene-manifest`，避免前后端各维护一套模板别名。

### 2. Function Calling / Command Calling 工具协议

本项目将 Function Calling / Command Calling 的思想贯穿整个指令链路：无论是本地快速命令、模板场景，还是 LLM 增强理解，最终都会收敛为统一、受控、可执行的绘图命令。

核心工具包括：

- `create_object`：创建对象。
- `edit_object`：编辑对象。
- `delete_object`：删除对象。
- `control_canvas`：控制画布，例如撤销、重做、清空。
- `ask_clarification`：信息不足时追问。
- `ignore_input`：忽略无关输入或语音噪声。

示例：

```json
{
  "calls": [
    {
      "tool": "create_object",
      "confidence": 0.95,
      "arguments": {
        "kind": "tree",
        "render_strategy": "template",
        "position": { "anchor": "left" },
        "size": { "preset": "medium" },
        "style": { "fill": "green" }
      }
    }
  ],
  "response": "好的，我画了一棵树。",
  "reasoning": "用户提出明确绘图请求"
}
```

这种设计的价值是：

- 限制模型输出范围。
- 便于 Pydantic 校验。
- 便于统一转换为前端绘图命令。
- 降低模型幻觉对画布的影响。
- 方便后续扩展新的绘图工具。

### 3. 语义选择器系统

语义选择器是项目的重要原创模块。它解决的是语音绘图中最常见的问题：用户不会总是说对象 ID，而是会说“它”“左边那个”“最大的气球”“刚才画的树”。

系统会根据以下信息建立对象语义档案：

- 对象 ID。
- 图形类型。
- `kind` / `label`。
- SVG 素材别名。
- 场景角色。
- 空间位置。
- 面积大小。
- 当前选中对象。
- 最近创建或修改对象。

选择器会根据语义、上下文和空间位置进行评分。如果出现多个候选目标，系统不会直接误操作，而是进入歧义确认流程，并在前端高亮候选对象。

相关模块：

- `frontend/src/services/objectResolver.ts`
- `frontend/src/services/semanticRegistry.ts`
- `backend/app/drawing/target_resolver.py`

### 4. Planner / Compiler / Executor 执行体系

项目将“理解”“命令编译”和“画布执行”拆开，形成一套 Planner / Compiler / Executor 体系。

后端 Planner / Compiler：

- `DrawingCommandCompiler`：把 LLM 工具计划编译为标准绘图命令。
- `SceneCommandCompiler`：把场景模板编译为一组可编辑对象命令。
- `ScenePatchCommandCompiler`：把用户额外描述作为补丁编译为场景修改命令。
- `SvgSceneGenerator`：处理开放式 SVG 场景生成。

前端执行器：

- `Canvas Command Executor`：统一执行 `DrawCommand[]`，是画布状态修改的主要边界。
- `TransformEngine`：负责对象移动、缩放、边界约束。
- `Canvas Store`：维护对象状态、历史记录、选中对象和最近对象。
- `CanvasBoard`：负责 Konva 画布渲染和手动拖拽交互。

这种拆分让 LLM 只负责规划，真正的画布修改由可控执行器完成。

### 5. 场景规划系统

项目支持场景级语音创作。用户可以说“画一个公园”“画一个生日贺卡”，系统会生成多个具有层级、位置、样式和语义标签的对象。

已支持的场景模板包括：

- 海边日落。
- 公园。
- 生日贺卡。
- 城市夜景。
- 森林小屋。
- 山水风景。
- 教室。
- 温馨客厅。
- 桌面工作区。
- 节日派对。

模板场景不是单张图片，而是一组可继续编辑的对象。例如生成公园后，用户仍然可以说“把右边的树变大”“删除中间的长椅”。开放式 SVG 场景用于模板覆盖不到的自由创作，画布上是一张整图 image，后续更适合整体移动、缩放或替换。

### 6. 降级容错设计

项目内置两类主要降级策略。

语音识别降级：

```text
百度实时 ASR
    ↓ 失败或未配置
浏览器 Web Speech API
```

命令理解降级：

```text
本地快速命令
    ↓ 未命中
后端本地对象 / 场景模板
    ↓ 未命中
开放式 SVG 整图 / LLM 工具规划
```

这种设计保证了简单命令响应快，常见场景稳定，复杂请求才使用 LLM。

更完整的当前架构边界见 [`ARCHITECTURE.md`](./ARCHITECTURE.md)。

## 🧭 系统架构

```mermaid
flowchart LR
    U["用户"] --> V["VoiceService"]

    V --> ASR["百度 ASR / Web Speech API"]
    ASR --> Clean["噪音与无关信息剥离"]
    Clean --> Orchestrator["Command Orchestrator"]

    Orchestrator --> FCM["Fast Command Interpreter"]
    FCM -->|快速命令| Commands["Draw Commands"]
    Orchestrator -->|复杂命令| API["FastAPI Backend"]

    API --> Router["Intent Router"]
    Router --> Local["Local Asset/Object Compiler"]
    Router --> Template["Template Scene Compiler"]
    Router --> Patch["Scene Patch Planner"]
    Router --> Tool["LLM Tool Planner"]
    Router --> SVG["SVG Scene Generator"]

    Local --> Commands
    Template --> Commands
    Patch --> Commands
    Tool --> Commands
    SVG --> Commands

    Commands --> CanvasExec["Canvas Command Executor"]
    CanvasExec --> Store["Canvas Store"]
    Store --> Konva["React Konva Canvas"]
    Store --> DB["PostgreSQL"]
```

## 🧱 技术栈

### 原创架构与核心模块

| 模块 | 说明 |
| --- | --- |
| 分层意图路由与命令执行 | 根据命令复杂度选择前端快速解释、后端本地规划、模板规划或 LLM 路径，并统一执行 DrawCommand |
| Function Calling 工具协议 | 将自然语言收敛为受控工具调用 |
| 语义选择器 | 解析“它”“左边的树”“最大的气球”等目标 |
| 高亮选择与歧义确认 | 多候选目标时避免误操作 |
| Scene Planner | 根据自然语言生成可编辑场景对象 |
| Scene Patch | 在模板场景上应用额外描述 |
| Canvas Command Executor | 前端统一执行 DrawCommand，修改 Canvas Store |
| DrawingCommandCompiler | 后端将工具计划转换为绘图命令 |
| TransformEngine | 处理对象移动、缩放、边界约束 |
| SVG Asset Resolver | 根据 kind、alias、keyword 匹配 SVG 素材 |

### 前端第三方框架与库

| 技术 | 用途 |
| --- | --- |
| React 18 | 前端 UI 框架 |
| TypeScript | 类型系统 |
| Vite | 开发服务器与构建工具 |
| Ant Design | UI 组件库 |
| `@ant-design/icons` | 图标库 |
| Konva | Canvas 绘图库 |
| React Konva | Konva 的 React 绑定 |
| Zustand | 状态管理 |
| Axios | HTTP 请求 |
| React Router DOM | 前端路由 |

### 后端第三方框架与库

| 技术 | 用途 |
| --- | --- |
| Python 3.11 | 后端运行环境 |
| FastAPI | Web API 框架 |
| Uvicorn | ASGI 服务 |
| SQLAlchemy | ORM |
| asyncpg | PostgreSQL 异步驱动 |
| Alembic | 数据库迁移 |
| Pydantic | 数据校验 |
| Pydantic Settings | 配置管理 |
| python-jose | JWT 处理 |
| passlib[bcrypt] | 密码哈希 |
| OpenAI Python SDK | OpenAI 兼容 LLM 调用 |
| httpx | HTTP 客户端 |
| python-dotenv | 环境变量加载 |

### 外部服务

| 服务 | 说明 |
| --- | --- |
| 百度实时语音识别 API | 主要 ASR 服务 |
| 浏览器 Web Speech API | 语音识别降级方案 |
| OpenAI 兼容 LLM API | 大模型理解与工具规划 |
| PostgreSQL 15 | 数据持久化 |
| Docker / Docker Compose | 本地容器化部署 |

> `frontend/public/svg-assets` 中的 SVG 素材属于外部或独立素材资源，最终展示或提交时建议按素材来源补充许可说明。

## 📁 项目目录结构

```text
Voice_canvas/
├── backend/
│   ├── app/
│   │   ├── api/                 # FastAPI 路由
│   │   ├── assets/              # SVG 素材解析器
│   │   ├── core/                # 配置、数据库、安全依赖
│   │   ├── drawing/             # Function Calling 工具、选择器、执行器
│   │   ├── models/              # SQLAlchemy 数据模型
│   │   ├── scene/               # 场景模板、Scene Patch、SVG 场景生成
│   │   ├── schemas/             # Pydantic 数据结构
│   │   ├── services/            # LLM 服务与后端意图路由器
│   │   └── main.py              # FastAPI 入口
│   ├── tests/                   # 后端测试
│   ├── init.sql                 # 数据库初始化
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── public/
│   │   └── svg-assets/          # SVG 素材库
│   ├── scripts/                 # 验证脚本
│   ├── src/
│   │   ├── components/          # 画布、语音、状态栏、设置面板
│   │   ├── pages/               # 页面
│   │   ├── services/            # 语音、快速命令、选择器、变换引擎
│   │   ├── stores/              # Zustand 状态管理
│   │   └── types/               # TypeScript 类型
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── start.sh
└── README.md
```

## 🚀 快速开始

### 环境要求

- Docker 20.10+
- Docker Compose 2.0+

### 启动项目

```bash
cd /home/bird/Projects/Voice_canvas
chmod +x start.sh
./start.sh
```

启动后访问：

- 前端：http://localhost:3000
- 后端：http://localhost:8000
- API 文档：http://localhost:8000/docs

默认账号：

- 用户名：`admin`
- 密码：`123456`

## 🧪 使用示例

基础图形：

```text
画一个红色圆形
画一个蓝色矩形
写上文字 Hello
画一颗星星
```

对象编辑：

```text
把它变成蓝色
把左边的树变大一点
删除最大的气球
选中右边那朵云
```

场景创作：

```text
画一个公园
画一个海边日落
画一张生日贺卡，中间写生日快乐
画一个城市夜景
```

画布控制：

```text
撤销
重做
保存
导出
清空画布
```

## 📡 API 概览

主要接口按模块拆分：

- `/api/auth`：注册、登录、当前用户。
- `/api/canvas`：画布创建、读取、更新、删除。
- `/api/voice`：语音相关接口。
- `/api/llm/configs`：LLM 配置管理。
- `/api/llm/test`：测试 OpenAI 兼容模型连接。

完整 OpenAPI 文档可在启动后访问：

```text
http://localhost:8000/docs
```

## ✅ 测试与验证

后端测试：

```bash
cd backend
pytest
```

前端对象选择器验证：

```bash
cd frontend
npm run verify:resolver
```

前端构建检查：

```bash
cd frontend
npm run build
```

## 🧾 项目价值总结

Voice Canvas 的重点不是简单地“接入一个大模型画图”，而是围绕语音绘图构建了一套可解释、可控、可降级的工程化系统。

项目的主要价值体现在：

- 用分层意图路由减少对 LLM 的过度依赖。
- 用 Function Calling 把自然语言转化为可校验的工具计划。
- 用语义选择器解决语音交互中的目标引用问题。
- 用执行引擎体系隔离模型规划和画布执行。
- 用场景模板保证常见复杂场景的稳定生成。
- 用降级机制保证比赛演示时的可用性和鲁棒性。

## 🔭 后续可扩展方向

- 增加更多场景模板。
- 扩展更多 Function Calling 工具。
- 支持多轮场景编辑。
- 增强多目标选择和批量操作。
- 增加更多素材来源和素材版权标注。
- 支持画布分享和多人协作。

## 📄 许可

MIT License
