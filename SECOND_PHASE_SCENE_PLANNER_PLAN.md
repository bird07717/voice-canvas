# Voice Canvas 第二阶段执行计划：Scene Planner

## 阶段目标

第二阶段目标是让 Voice Canvas 从“语音控制单个图形”升级为“语音生成完整场景”。

用户可以说：

```text
画一个海边日落
画一个公园，有草地、树、太阳和小路
画一张生日贺卡，中间写生日快乐，周围有星星和彩带
画一个夜晚城市，有月亮、高楼和道路
```

系统不应该只创建一个对象，而应该规划出一组对象、布局、层级、颜色和风格，再渐进式绘制到当前画布。

核心体验目标：

```text
一句话场景
-> 立即显示“正在规划场景”
-> LLM 输出 Scene Plan
-> 本地执行器转成多个 Canvas 对象
-> 画布快速出现完整构图
-> 用户继续用语音或鼠标微调
```

## 本阶段不做

为了控制范围，第二阶段暂时不做：

- 不迁移 tldraw。
- 不接入生图模型。
- 不接 GPT-4V / Claude Vision 看图。
- 不做多人协作。
- 不做复杂图层系统。
- 不做真正自由手绘笔刷。
- 不重构整个后端。

本阶段主线是：

```text
语音文本 -> Scene Planner -> Scene Graph -> Canvas Commands -> Konva 渲染
```

## 默认技术决策

如果没有额外说明，本计划默认采用以下方案：

1. **继续使用当前 Konva 画布。**
2. **继续使用当前 OpenAI-compatible LLM 配置。**
3. **场景生成使用后端 LLM，不放到前端。**
4. **快速命令仍由前端本地规则处理。**
5. **只有场景级命令进入 Scene Planner。**
6. **Scene Planner 输出语义化 JSON，而不是直接输出底层 Konva 对象。**
7. **后端新增 scene plan 解析和执行器，复用现有 drawing executor 的图形模板能力。**

## 需要确认的问题

这些问题不会阻塞第一版实现，但会影响体验细节。

1. **场景风格默认是什么？**

建议默认：`cartoon_flat`，即扁平卡通风。原因是当前 Konva 矢量模板更适合卡通图形。

可选：

```text
cartoon_flat
simple_icon
whiteboard
children_drawing
diagram
```

2. **画布是否允许自动清空？**

建议默认：不自动清空。  
如果用户说“重新画一个海边日落”，才清空或新建场景。

3. **场景生成是追加还是替换？**

建议默认：追加。  
用户说“画一个公园”时，在当前画布空白区域或整体画布上生成；如果画布已有内容，提示或追加。

4. **复杂场景是否需要用户确认？**

建议第一版不做确认，直接生成，但状态栏显示“理解为：公园场景”。  
后续可加“预览计划 -> 应用”。

5. **场景对象数量上限是多少？**

建议第一版每个场景 5-12 个对象，避免画布过乱和 LLM 输出太大。

## 开始实施前确认项

正式开始写 Week 1 代码前，建议确认以下默认行为。如果没有特别要求，可以先按推荐值执行。

| 项目 | 推荐值 | 影响 |
| --- | --- | --- |
| 默认风格 | `cartoon_flat` | 决定颜色、边框和对象模板风格 |
| 生成方式 | 追加到当前画布 | 避免一句话误清空已有作品 |
| 清空策略 | 只有“重新画/清空后画”才清空 | 降低误操作风险 |
| 复杂场景确认 | 第一版不确认，直接生成 | 保持语音体验流畅 |
| 对象数量上限 | 5-12 个 | 控制速度、布局和撤销复杂度 |
| 首批模板 | 海边日落、公园、生日贺卡、城市夜景、森林小屋、山水风景、教室 | 覆盖 Demo 和常见测试场景 |

## 成功标准

第二阶段完成时，至少能稳定演示以下流程：

```text
用户：画一个海边日落
系统：生成天空、太阳、海面、沙滩、云、椰子树

用户：左边加一棵树
系统：快速/LLM 添加树

用户：选中太阳
系统：高亮太阳

用户：把它变大一点
系统：太阳放大

用户：把海变成蓝色
系统：海面变蓝
```

验收标准：

- 常见场景一句话能生成 5 个以上相关对象。
- 生成结果有基本布局，而不是全部堆在中心。
- 对象创建后仍可选中、拖拽、语音修改。
- 快速命令不受 Scene Planner 影响。
- 未命中快速命令时，简单场景进入 Scene Planner，而不是旧的单对象 LLM 工具规划。
- 前端类型检查通过。
- 后端语法检查通过。
- `npm run build` 通过。

## 总体架构

### 当前第一阶段链路

```text
语音识别
-> fastCommandMatcher
-> 如果命中：前端直接执行
-> 如果未命中：POST /api/voice/command
-> LLM 工具规划
-> DrawingExecutor
-> commands
-> 前端执行
```

### 第二阶段目标链路

```text
语音识别
-> fastCommandMatcher
-> 如果命中：前端直接执行
-> 如果未命中：
   -> 判断是否是场景级请求
   -> Scene Planner 生成 Scene Plan
   -> Scene Executor 转成 Canvas Commands
   -> 前端执行 commands
```

### 场景级请求示例

应该进入 Scene Planner：

```text
画一个海边日落
画一个公园
画一个生日贺卡
画一个城市夜景
画一幅森林小屋
画一个流程图，描述用户登录
```

不应该进入 Scene Planner：

```text
画一个红色圆
把它变大
选中太阳
导出
撤销
```

这些继续走快速命令或现有工具规划。

## 数据结构设计

### ScenePlan

建议新增后端 schema：

```python
class ScenePlan(BaseModel):
    scene_type: str
    title: str
    style: str = "cartoon_flat"
    background: Optional[SceneBackground] = None
    objects: List[SceneObject]
    layout_notes: Optional[str] = None
    response: str
```

### SceneBackground

```python
class SceneBackground(BaseModel):
    fill: Optional[str] = None
    horizon_y: Optional[float] = None
    ground_fill: Optional[str] = None
```

### SceneObject

```python
class SceneObject(BaseModel):
    id_hint: Optional[str] = None
    kind: str
    role: Literal["background", "midground", "foreground", "decoration", "label"] = "midground"
    position: ScenePosition
    size: SceneSize
    style: SceneStyle = Field(default_factory=SceneStyle)
    label: Optional[str] = None
    description: Optional[str] = None
```

### ScenePosition

```python
class ScenePosition(BaseModel):
    anchor: Literal[
        "center",
        "top",
        "bottom",
        "left",
        "right",
        "top_left",
        "top_right",
        "bottom_left",
        "bottom_right",
        "custom"
    ] = "center"
    x: Optional[float] = None
    y: Optional[float] = None
    layer: int = 0
```

### SceneSize

```python
class SceneSize(BaseModel):
    preset: Literal["tiny", "small", "medium", "large", "huge", "wide", "tall"] = "medium"
    width: Optional[float] = None
    height: Optional[float] = None
```

### SceneStyle

```python
class SceneStyle(BaseModel):
    fill: Optional[str] = None
    stroke: Optional[str] = None
    opacity: Optional[float] = None
    text: Optional[str] = None
```

## 建议新增文件

后端：

```text
backend/app/scene/__init__.py
backend/app/scene/schemas.py
backend/app/scene/planner.py
backend/app/scene/executor.py
backend/app/scene/templates.py
backend/app/scene/intent.py
```

前端：

```text
frontend/src/services/sceneIntent.ts
frontend/src/types/scene.ts
```

测试/文档：

```text
SECOND_PHASE_TEST_CHECKLIST.md
docs/scene_planner.md
```

## Week 1：场景识别与 Scene Plan 基础

### 目标

建立 Scene Planner 的最小闭环：

```text
用户说“画一个海边日落”
-> 后端识别为 scene
-> LLM 输出 ScenePlan
-> 后端转 commands
-> 前端执行
```

### Day 1：定义 Scene Schema 和意图分流

#### 任务

1. 新增 `backend/app/scene/schemas.py`。
2. 定义 `ScenePlan`、`SceneObject`、`ScenePosition`、`SceneSize`、`SceneStyle`。
3. 新增 `backend/app/scene/intent.py`。
4. 实现 `is_scene_request(text: str) -> bool`。

第一版用规则判断，不用 LLM：

```python
SCENE_KEYWORDS = [
    "场景", "一幅", "一张", "海边", "日落", "公园", "森林", "城市",
    "夜景", "生日贺卡", "贺卡", "山水", "房子和树", "天空", "草地"
]
```

同时排除简单命令：

```python
SIMPLE_COMMAND_WORDS = [
    "选中", "删除", "撤销", "重做", "保存", "导出",
    "变大", "变小", "左移", "右移", "上移", "下移"
]
```

#### 验收

- “画一个海边日落”返回 scene。
- “画一个红色圆”不返回 scene。
- “把它变大”不返回 scene。
- “画一个公园，有树和小路”返回 scene。

#### 建议提交

```bash
git add backend/app/scene
git commit -m "添加场景规划数据结构和意图识别"
```

### Day 2：实现 Scene Planner Prompt

#### 任务

1. 新增 `backend/app/scene/planner.py`。
2. 实现 `ScenePlanner.plan(text, canvas_context, llm_config)`。
3. 新增严格 JSON prompt。

Prompt 核心要求：

```text
你是语音绘画系统的场景规划器。
你的任务是把用户的一句话绘画需求拆成语义化场景计划。
不要输出底层 Konva 参数。
只输出严格 JSON。
画布大小为 800x600。
对象数量控制在 5-12 个。
对象要有合理布局和层级。
```

输出示例：

```json
{
  "scene_type": "beach_sunset",
  "title": "海边日落",
  "style": "cartoon_flat",
  "background": {
    "fill": "#FDE68A",
    "horizon_y": 330,
    "ground_fill": "#F6C453"
  },
  "objects": [
    {
      "kind": "sun",
      "role": "background",
      "position": {"anchor": "top_right", "layer": 1},
      "size": {"preset": "large"},
      "style": {"fill": "#F97316"}
    },
    {
      "kind": "river",
      "role": "midground",
      "position": {"anchor": "center", "layer": 2},
      "size": {"preset": "wide"},
      "style": {"fill": "#38BDF8"}
    }
  ],
  "layout_notes": "太阳在右上角，海面在中部，沙滩在底部。",
  "response": "好的，我规划了一个海边日落场景。"
}
```

#### 验收

- Planner 能返回合法 JSON。
- JSON 能通过 Pydantic 校验。
- 非法 JSON 时返回 clarify，不修改画布。

#### 建议提交

```bash
git add backend/app/scene/planner.py
git commit -m "添加场景规划器和结构化提示词"
```

### Day 3：实现 Scene Executor 最小版本

#### 任务

1. 新增 `backend/app/scene/executor.py`。
2. 实现 `SceneExecutor.execute(plan) -> List[DrawCommand]`。
3. 复用现有 `DrawingExecutor` 的模板思想，但先独立实现简单映射。

第一批支持对象：

```text
sun
tree
cloud
house
flower
person
car
mountain
grass
road
river
circle
rect
line
text
star
```

布局规则：

```text
top_left      -> (130, 110)
top_right     -> (670, 110)
bottom_left   -> (130, 490)
bottom_right  -> (670, 490)
center        -> (400, 300)
top           -> (400, 100)
bottom        -> (400, 500)
left          -> (130, 300)
right         -> (670, 300)
custom        -> x/y
```

层级规则：

- 按 `position.layer` 和 `role` 排序。
- background 先画。
- foreground 后画。

#### 验收

- 输入 ScenePlan 后能生成多个 `create` commands。
- commands 可被前端现有 `executeCommands` 执行。
- 对象不会全部堆在中心。

#### 建议提交

```bash
git add backend/app/scene/executor.py
git commit -m "添加场景计划执行器"
```

### Day 4：接入 `/api/voice/command`

#### 任务

1. 修改 `backend/app/services/llm_service.py`。
2. 在 `process_command` 中加入场景分流。

伪代码：

```python
if is_scene_request(text):
    scene_plan = await ScenePlanner(...).plan(...)
    commands = SceneExecutor(canvas_context).execute(scene_plan)
    return {
        "intent": "draw",
        "confidence": 0.9,
        "commands": commands,
        "response": scene_plan.response,
        "reason": "scene_plan"
    }
```

3. 保留旧工具规划作为 fallback。
4. 场景规划失败时不要空白失败，返回 clarify。

#### 验收

- “画一个海边日落”走 Scene Planner。
- “画一个红色圆”仍可被前端快速命令截获。
- “画一棵树”仍可走旧工具规划或快速模板，不被错误当成复杂场景。

#### 建议提交

```bash
git add backend/app/services/llm_service.py backend/app/scene
git commit -m "接入场景规划到语音命令流程"
```

### Day 5：前端状态反馈优化

#### 任务

1. 前端识别到未命中快速命令时，文案从：

```text
AI 正在根据你的指令生成绘图步骤...
```

优化为：

```text
AI 正在规划完整场景...
```

2. 后端 response 包含 scene 信息时，侧边栏显示：

```text
理解为：海边日落场景
执行状态：已生成 7 个对象
```

3. 对场景生成的多个对象，最后一个对象不一定作为 selected；建议选中一个主体对象。

主体对象选择规则：

```text
优先 sun/tree/house/person 等具象对象
其次第一个 foreground 对象
最后第一个对象
```

第一版可以只选最后一个对象，后续优化。

#### 验收

- 用户知道系统是在“规划场景”，不是普通 LLM 慢处理。
- 生成完成后显示对象数量。

#### 建议提交

```bash
git add frontend/src/components/VoiceControl/index.tsx
git commit -m "优化场景生成状态反馈"
```

## Week 2：场景模板库和布局质量

### 目标

让常见场景生成结果更稳定，不完全依赖 LLM 自由发挥。

## Day 6：内置场景模板

新增 `backend/app/scene/templates.py`。

第一批模板：

```text
beach_sunset
park
birthday_card
city_night
forest_house
mountain_landscape
simple_classroom
```

每个模板定义：

```python
{
    "scene_type": "park",
    "default_objects": [...],
    "palette": {...},
    "layout": {...}
}
```

策略：

- LLM 负责识别用户想要的场景。
- 模板负责稳定布局。
- LLM 可以补充对象，但不完全控制坐标。

验收：

- “画一个公园”每次都能稳定生成草地、树、太阳、小路。
- “画一个生日贺卡”能稳定生成文字、星星、彩带、边框。

提交：

```bash
git add backend/app/scene/templates.py
git commit -m "添加常见场景模板库"
```

## Day 7：模板融合逻辑

任务：

1. Scene Planner 返回 `scene_type`。
2. 如果命中模板，先加载模板。
3. 再把用户指定对象合并进去。

示例：

用户：

```text
画一个公园，有秋千和小狗
```

流程：

```text
park 模板 -> 草地、树、小路、太阳
用户补充 -> 秋千、小狗
```

如果 `秋千/小狗` 当前没有模板，先用 `text placeholder` 或简单组合图形。

验收：

- 模板基础对象稳定。
- 用户额外对象不会丢。

提交：

```bash
git add backend/app/scene
git commit -m "支持场景模板和用户对象融合"
```

## Day 8：布局避让

任务：

1. 实现场景对象基本避让。
2. 同一 anchor 下多个对象自动错开。
3. 避免所有对象堆叠。

简单规则：

```python
anchor_slots = {
  "bottom": [(260, 500), (400, 500), (540, 500)],
  "top": [(260, 100), (400, 100), (540, 100)],
  "left": [(120, 220), (120, 350), (120, 480)],
  "right": [(680, 220), (680, 350), (680, 480)]
}
```

验收：

- 多棵树不会完全重叠。
- 多朵云会分散在上方。
- 装饰对象围绕主体分布。

提交：

```bash
git add backend/app/scene/executor.py
git commit -m "优化场景对象布局避让"
```

## Day 9：场景对象命名和选择

任务：

1. commands 中加入 `params.label` 或 `params.kindLabel`。
2. 前端选中标签优先显示 `kindLabel`。
3. 场景对象可通过语音选择：

```text
选中太阳
选中左边的树
选中房子
```

第一版“左边的树”可先选择同类中 x 最小的对象。

需要扩展前端 `fastCommandMatcher`：

- 支持 `左边的树`
- 支持 `右边的云`
- 支持 `中间的房子`

验收：

- 场景生成后能明确选中对象。
- 多个同类对象时可以选择左/右/上/下。

提交：

```bash
git add frontend/src/services/fastCommandMatcher.ts frontend/src/components/CanvasBoard/index.tsx
git commit -m "增强场景对象命名和语音选择"
```

## Day 10：测试和第一轮体验修复

任务：

1. 新增 `SECOND_PHASE_TEST_CHECKLIST.md`。
2. 手动测试 7 个场景模板。
3. 记录失败案例。
4. 修复最常见 5 个问题。

测试场景：

```text
画一个海边日落
画一个公园
画一张生日贺卡
画一个城市夜景
画一个森林小屋
画一个山水风景
画一个教室
```

验收：

- 每个场景至少生成 5 个对象。
- 无明显越界。
- 无大面积重叠。
- 可以继续语音编辑其中一个对象。

提交：

```bash
git add backend/app/scene frontend/src/components/VoiceControl/index.tsx SECOND_PHASE_TEST_CHECKLIST.md
git commit -m "修复场景规划第一轮体验问题"
```

## Week 3：渐进渲染和编辑闭环

### 目标

让场景生成更像“正在画”，并且生成后能自然继续编辑。

## Day 11：渐进执行

任务：

1. 前端执行 commands 时支持分批绘制。
2. 场景命令每 100-200ms 添加一个对象。
3. 状态栏显示：

```text
正在绘制场景：3 / 8
```

实现方式：

```ts
for (const command of commands) {
  await wait(120)
  executeCommand(command)
}
```

注意：

- 快速命令仍立即执行。
- 只有 scene source 的 commands 渐进执行。

验收：

- 用户能看到对象陆续出现。
- 不影响撤销历史。

提交：

```bash
git add frontend/src/components/VoiceControl/index.tsx
git commit -m "添加场景渐进绘制体验"
```

## Day 12：场景级撤销

问题：

如果场景生成 8 个对象，用户说“撤销”，理想上应该撤销整个场景，而不是只撤销最后一个对象。

任务：

1. 给 `recordCommands` 增加 batch id。
2. 场景生成时保存为一个 batch。
3. `undo` 优先按 batch 回退。

简化方案：

- 第一版可以让场景 commands 在一次 `setCanvasObjects` 中提交，形成一个 history step。
- 不逐个 `addObject`。

验收：

- 生成一个场景后说“撤销”，整个场景消失。
- 普通单对象命令仍单步撤销。

提交：

```bash
git add frontend/src/stores/canvasStore.ts frontend/src/components/VoiceControl/index.tsx
git commit -m "支持场景级撤销"
```

## Day 13：场景后续编辑

任务：

1. 用户说“把太阳变大”，本地快速命令优先找 kind=sun。
2. 用户说“把树移到左边”，本地快速命令或 LLM 能定位 tree。
3. 用户说“再加一朵云”，应该追加 cloud，而不是重新生成场景。

需要扩展：

- `fastCommandMatcher` 对 `kind + edit` 的识别。
- `DrawingExecutor` 对常见 kind 的补充。

验收：

- 生成“海边日落”后，可以编辑太阳、云、树。
- 不需要用户手动点选也能通过对象名称修改。

提交：

```bash
git add frontend/src/services/fastCommandMatcher.ts backend/app/drawing/executor.py
git commit -m "增强场景对象后续语音编辑"
```

## Day 14：场景保存和历史记录

任务：

1. `chat_history.command_json` 中记录 scene plan 摘要。
2. 对话历史显示：

```text
执行了 8 个命令
场景：海边日落
```

3. 保存画布时 `canvas_json` 中可选记录：

```json
{
  "objects": [],
  "version": "1.1",
  "scene_meta": {
    "last_scene_type": "beach_sunset",
    "style": "cartoon_flat"
  }
}
```

验收：

- 保存后刷新，场景对象不丢。
- 对话历史能看到场景生成记录。

提交：

```bash
git add backend/app/api/voice.py frontend/src/components/ChatPanel/index.tsx
git commit -m "记录场景生成历史信息"
```

## Day 15：第二轮测试

任务：

1. 完成 `SECOND_PHASE_TEST_CHECKLIST.md`。
2. 跑前端构建：

```bash
cd frontend
npm run build
```

3. 跑后端语法检查：

```bash
python3 - <<'PY'
from pathlib import Path
for p in Path("backend/app").rglob("*.py"):
    compile(p.read_text(encoding="utf-8"), str(p), "exec")
print("backend syntax ok")
PY
```

4. 修复阻塞 Demo 的问题。

提交：

```bash
git add backend/app/scene backend/app/services/llm_service.py backend/app/api/voice.py backend/app/drawing/executor.py frontend/src/components/VoiceControl/index.tsx frontend/src/components/CanvasBoard/index.tsx frontend/src/components/ChatPanel/index.tsx frontend/src/services/fastCommandMatcher.ts frontend/src/stores/canvasStore.ts frontend/src/types/index.ts SECOND_PHASE_TEST_CHECKLIST.md
git commit -m "完成场景规划第二轮测试修复"
```

## Week 4：可选增强和收尾

如果前 3 周进展顺利，Week 4 做增强；如果前面风险较多，Week 4 用于修 bug 和稳定。

## Day 16：简单场景预设按钮

任务：

在语音面板或画布页加几个快捷场景按钮：

```text
海边日落
公园
生日贺卡
城市夜景
森林小屋
```

作用：

- 不替代语音。
- 用于测试和演示。

提交：

```bash
git add frontend/src/components/VoiceControl/index.tsx
git commit -m "添加常用场景快捷入口"
```

## Day 17：场景计划调试面板

任务：

开发模式下显示 Scene Plan JSON 摘要。

用途：

- 调试 LLM 输出。
- 快速发现布局问题。

要求：

- 默认折叠。
- 生产可隐藏。

提交：

```bash
git add frontend/src/components/ChatPanel/index.tsx
git commit -m "添加场景计划调试信息"
```

## Day 18：文档补全

新增：

```text
docs/scene_planner.md
```

内容：

- Scene Planner 架构。
- ScenePlan JSON 格式。
- 支持的 scene types。
- 支持的 object kinds。
- 如何新增模板。
- 如何测试。

提交：

```bash
git add docs/scene_planner.md
git commit -m "补充场景规划技术文档"
```

## Day 19：演示脚本和录制准备

新增或更新：

```text
SECOND_PHASE_DEMO_SCRIPT.md
```

演示脚本：

```text
1. 画一个海边日落
2. 选中太阳
3. 把它变大一点
4. 右边加一朵云
5. 把海变成深蓝色
6. 撤销整个场景
7. 画一张生日贺卡
8. 保存并导出
```

提交：

```bash
git add SECOND_PHASE_DEMO_SCRIPT.md
git commit -m "整理场景规划演示脚本"
```

## Day 20：最终稳定

任务：

1. 跑完整构建。
2. 跑后端语法检查。
3. 跑手动测试清单。
4. 更新 README / PROJECT_OVERVIEW。
5. 标记第二阶段完成。

提交：

```bash
git add README.md PROJECT_OVERVIEW.md SECOND_PHASE_SCENE_PLANNER_PLAN.md SECOND_PHASE_TEST_CHECKLIST.md SECOND_PHASE_DEMO_SCRIPT.md backend/app/scene backend/app/services/llm_service.py backend/app/api/voice.py backend/app/drawing/executor.py frontend/src/components/VoiceControl/index.tsx frontend/src/components/CanvasBoard/index.tsx frontend/src/components/ChatPanel/index.tsx frontend/src/services/fastCommandMatcher.ts frontend/src/stores/canvasStore.ts frontend/src/types/index.ts
git commit -m "完成第二阶段场景规划能力"
```

## 第二阶段测试清单

建议创建 `SECOND_PHASE_TEST_CHECKLIST.md`。

```markdown
# 第二阶段 Scene Planner 测试清单

## 场景生成

- [ ] 说“画一个海边日落”，生成太阳、海面、沙滩、云等对象。
- [ ] 说“画一个公园”，生成草地、树、小路、太阳等对象。
- [ ] 说“画一张生日贺卡”，生成文字、星星、装饰元素。
- [ ] 说“画一个城市夜景”，生成月亮、高楼、道路。
- [ ] 说“画一个森林小屋”，生成房子、树、太阳或云。

## 布局

- [ ] 对象没有全部堆在中心。
- [ ] 背景对象在底层。
- [ ] 前景对象在上层。
- [ ] 多个同类对象有错开。
- [ ] 对象没有明显越界。

## 编辑

- [ ] 生成场景后说“选中太阳”，太阳高亮。
- [ ] 说“把它变大”，太阳变大。
- [ ] 说“把树移到左边”，树移动。
- [ ] 说“把海变成蓝色”，海变色。
- [ ] 鼠标拖动对象后，语音继续编辑正确对象。

## 撤销和保存

- [ ] 生成场景后撤销，整个场景回退。
- [ ] 保存后刷新，场景不丢。
- [ ] 导出 PNG 正常。

## Fallback

- [ ] “画一个红色圆”仍走快速命令。
- [ ] “撤销/保存/导出”仍走快速命令。
- [ ] LLM 输出非法 JSON 时不会修改画布。
- [ ] 未配置 LLM 时给出明确提示。
```

## 主要风险和解决方案

### 风险 1：LLM 输出不稳定

解决：

- 使用严格 Pydantic 校验。
- JSON 解析失败时不修改画布。
- 用模板库稳定常见场景。
- 对对象数量设置上限。

### 风险 2：场景生成太慢

解决：

- 状态区明确显示“正在规划完整场景”。
- 常见场景后续可加本地模板短路。
- 场景计划缓存：相同 prompt 可复用。

### 风险 3：对象太多导致撤销体验差

解决：

- 场景级 batch，一次场景生成作为一个历史 step。

### 风险 4：布局不好看

解决：

- 初期用模板约束布局。
- 后续加入 slot 和避让。
- 不让 LLM 直接控制所有坐标。

### 风险 5：项目复杂度继续膨胀

解决：

- Scene Planner 独立放在 `backend/app/scene`。
- 不把 scene 逻辑混进 `drawing/executor.py`。
- 保留旧工具规划作为 fallback。

## 建议的实现顺序

如果只能做最小版本，优先级如下：

1. Scene schema。
2. Scene intent 判断。
3. Scene Planner prompt。
4. Scene Executor。
5. 接入 `/api/voice/command`。
6. 常见场景模板。
7. 布局避让。
8. 场景级撤销。
9. 对象选择增强。
10. 文档和测试。

## 阶段完成后的下一步

第二阶段完成后，再考虑第三阶段：

```text
视觉模型看画布截图
SVG 复杂对象生成
局部重绘
生图模型增强
tldraw Spike
```

推荐顺序仍然是：

```text
Scene Planner 稳定
-> SVG/复杂对象增强
-> 视觉理解
-> 生图/局部重绘
-> 再评估 tldraw 迁移
```
