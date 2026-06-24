# Voice Canvas 架构说明

## 架构命名

当前项目不再适合称为简单的分层路由。更准确的名称是：

**分层意图路由与命令执行架构**

核心思想是：语音或文本输入先经过前端编排和确定性快速解释；复杂请求交给后端进行意图路由与规划；所有路径最终收敛为统一的 `DrawCommand` 协议，并由前端画布执行器修改画布状态。

## 总体链路

```text
语音 / 文本输入
  -> ASR 与文本归一化
  -> 前端 Command Orchestrator
       -> Fast Command Interpreter
       -> Backend Intent Router
            -> Local Asset/Object Compiler
            -> Template Scene Compiler
            -> Scene Patch Planner
            -> Open SVG Scene Generator
            -> LLM Tool Planner
  -> Draw Command Protocol
  -> Canvas Command Executor
  -> Canvas Store / History / Konva Renderer
```

## 边界职责

### 前端 Command Orchestrator

当前位置：`frontend/src/components/VoiceControl/index.tsx`

职责：

- 管理语音识别生命周期。
- 对中间识别和最终识别做去重、防抖和流程调度。
- 优先调用前端快速命令解释器。
- 快速命令未命中时调用后端意图路由。
- 管理 UI 状态、聊天消息、歧义确认会话。
- 把最终命令交给 `Canvas Command Executor`。

不应承担：

- 不直接实现画布命令执行细节。
- 不维护完整后端场景模板规则。
- 不直接生成复杂场景或 LLM 工具计划。

### Fast Command Interpreter

当前位置：`frontend/src/services/fastCommandMatcher.ts`

职责：

- 处理高频、确定性、低风险命令。
- 包括撤销、重做、清空、保存、导出、基础几何图形、简单编辑、选择和删除。
- 命中后直接输出 `DrawCommand[]` 或控制动作。

### Backend Intent Router

当前位置：`backend/app/services/llm_router.py`

职责：

- 轻量分类用户请求。
- 返回 route、是否需要 LLM、原因和轻量匹配元数据。
- 不构建完整场景计划。
- 不构建完整对象请求。
- 不执行画布命令。

当前 route：

- `local_object`
- `template_scene`
- `template_scene_patch`
- `open_scene`
- `tool_plan`
- `requires_llm`

### 后端 Planner / Compiler

当前位置：

- `backend/app/services/llm_service.py`
- `backend/app/scene/templates.py`
- `backend/app/scene/patch.py`
- `backend/app/scene/svg_generator.py`
- `backend/app/drawing/executor.py`

职责：

- 根据路由结果构建具体计划。
- 将本地素材、模板场景、Scene Patch、LLM 工具计划或开放 SVG 场景转换为前端可执行命令。
- 后端 Compiler 生成命令，不直接修改前端画布状态。

当前核心 Compiler / Service：

- `DrawingCommandCompiler`
- `SceneCommandCompiler`
- `ScenePatchCommandCompiler`
- `LocalObjectCommandService`
- `SceneCommandService`
- `OpenSvgSceneCommandService`

场景规划有两个输出形态：

- `object_scene`：模板场景和 Scene Patch。输出多个对象命令，保留 `kind`、`sceneRole`、`sceneType` 等语义，支持后续对象级编辑。
- `svg_image`：开放式 SVG 整图。输出一个 image 命令，携带 `rawSvg`，适合自由视觉表达，但不承诺拆分为可独立编辑对象。

### Draw Command Protocol

当前位置：

- 前端类型：`frontend/src/types/index.ts`
- 后端输出：`backend/app/drawing/executor.py`、`backend/app/scene/executor.py`

职责：

- 作为前后端唯一跨边界命令协议。
- 所有快速命令、模板场景、LLM 工具规划和 SVG 场景生成都必须输出该协议。
- 响应层通过 `command_protocol="draw-command-v1"` 标识协议版本。
- 后端 `scene.render_mode` 用于声明场景命令的编辑语义：`object_scene` 表示可对象级编辑，`svg_image` 表示整图 image。

当前核心 action：

- `create`
- `replaceScene`
- `modify`
- `move`
- `moveBy`
- `scale`
- `select`
- `delete`
- `clear`
- `undo`
- `redo`

### Canvas Command Executor

当前位置：`frontend/src/services/canvasCommandExecutor.ts`

职责：

- 统一执行 `DrawCommand[]`。
- 执行前做轻量协议校验。
- 解析 `targetQuery`。
- 处理歧义候选。
- 通过统一入口执行普通命令和场景替换命令。
- 修改 `canvasStore`，并保持历史记录、最近对象、选中对象等状态一致。

不应承担：

- 不调用 ASR。
- 不调用后端。
- 不判断 LLM route。

## 当前已知取舍

- 模板场景会生成多个可编辑对象。
- `open_scene` 会生成整张 SVG image，视觉表达更自由，但对象级编辑能力较弱。
- 前端模板快捷识别和场景按钮消费后端 `/api/voice/scene-manifest`，模板别名以后端为权威来源。
- 旧 `DrawingExecutor` / `SceneExecutor` / `ScenePatchExecutor` 名称仅作为兼容 alias 保留。

## 后续收敛方向

- 将 `VoiceControl` 继续拆薄，只保留 UI 与流程编排。
- 将后端 planner 手写 dict 继续收敛到统一 command builder。
- 将 `replaceScene` 从前端执行模式进一步下沉到后端命令输出。
- 为 `DrawCommand` 增加更严格的前后端 schema 校验。
