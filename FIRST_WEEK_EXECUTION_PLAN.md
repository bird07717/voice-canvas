# Voice Canvas 第一周执行计划

## 总目标

第一周不做大重构，不迁移 tldraw，不接入生图模型。目标是把当前项目从“语音命令 demo”提升为“有即时反馈、可快速操作、可手动微调的语音画布工具”。

核心体验闭环：

```text
用户说话
-> 实时看到识别文本
-> 常用命令快速匹配并立即执行
-> 复杂命令才进入 LLM
-> 系统明确显示理解和执行状态
-> 创建后对象自动选中，可拖拽、可继续语音修改
```

## 开发原则

- 保留当前 Konva 画板，不迁移画布底座。
- 优先做前端交互和本地快速命令，尽量减少后端改动。
- 快速命令命中时不调用 LLM。
- 快速命令未命中时继续沿用现有 `/api/voice/command`。
- 每天结束必须提交一次 git commit，提交信息使用中文，格式为：

```bash
git add .
git commit -m "中文描述修改功能"
```

示例：

```bash
git add .
git commit -m "添加语音状态反馈面板"
```

## Day 1：语音状态反馈骨架

### 目标

让用户清楚知道系统当前处于什么阶段，避免“说完以后盯着空白画布等待”。

### 建议改动文件

- `frontend/src/stores/voiceStore.ts`
- `frontend/src/components/VoiceControl/index.tsx`
- `frontend/src/components/VoiceControl/VoiceControl.css`
- 可选新增：`frontend/src/types/voice.ts`

### 任务步骤

1. 扩展语音状态枚举。

当前状态较粗：

```ts
type VoiceStatus = 'idle' | 'listening' | 'processing' | 'drawing'
```

建议改成：

```ts
type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'recognizing'
  | 'matched'
  | 'thinking'
  | 'drawing'
  | 'done'
  | 'error'
```

2. 在 `voiceStore` 增加状态字段。

建议新增：

```ts
recognizedText: string
interpretedText: string
executionMessage: string
errorMessage: string
lastCommandSource: 'fast' | 'llm' | null
```

3. 改造 `VoiceControl` 面板。

固定展示四块信息：

```text
当前状态：正在听
识别文本：画一个红色圆
理解为：创建红色圆形
执行结果：已绘制红色圆形
```

4. 将关键阶段写入状态面板，而不是只用 `message.success` / `message.error`。

建议状态流：

```text
点击开始 -> listening
收到临时识别文本 -> recognizing
收到最终识别文本 -> thinking 或 matched
执行命令 -> drawing
执行完成 -> done
失败 -> error
```

5. 增加“取消/重说”按钮。

第一周只需要做到：

- 停止当前语音识别。
- 清空当前识别文本和理解文本。
- 状态回到 `idle` 或 `listening`。

### 验收标准

- 点击开始后，立刻显示“正在听...”。
- 识别到文本后，面板实时更新。
- 进入 LLM 请求时显示“正在理解...”。
- 执行绘图时显示“正在绘制...”。
- 完成后显示“已完成：xxx”。
- 出错时有固定错误区域，不只依赖 toast。

### 当天提交

```bash
git add .
git commit -m "添加语音状态反馈面板"
```

## Day 2：快速命令匹配层

### 目标

让 20 个左右的高频命令不走 LLM，做到低延迟立即响应。

### 建议新增文件

- `frontend/src/services/fastCommandMatcher.ts`

### 建议改动文件

- `frontend/src/components/VoiceControl/index.tsx`
- `frontend/src/types/index.ts`
- `frontend/src/stores/canvasStore.ts`

### 任务步骤

1. 新增快速命令匹配模块。

建议接口：

```ts
export type FastCommandResult = {
  matched: boolean
  interpretation?: string
  commands?: DrawCommand[]
  message?: string
}

export function matchFastCommand(
  text: string,
  context: CanvasCommandContext
): FastCommandResult
```

2. 支持第一批创建命令。

```text
画圆
画一个圆
画红色圆
画蓝色矩形
画线
画星星
写文字：XXX
写上 XXX
```

默认参数：

```text
圆：x=400, y=300, radius=50
矩形：x=340, y=260, width=120, height=80
线：points=[300,300,500,300]
星星：x=400, y=300, innerRadius=25, outerRadius=55
文字：x=330, y=280, fontSize=28
```

3. 支持第一批控制命令。

```text
清空画布
撤销
重做
删除它
保存
导出
```

注意：

- `保存`、`导出` 可以先不进后端 command，而是在 `VoiceControl` 中调用当前页面已有保存/导出逻辑，或先设计事件回调。
- 如果第一天时间不够，Day 2 先支持 `清空`、`撤销`、`重做`、`删除它`。

4. 支持第一批编辑命令。

```text
把它变红
把它变蓝
把它变绿
把它变大
把它变小
左移一点
右移一点
上移一点
下移一点
```

默认编辑参数：

```text
变大：scale_delta=1.2 或直接放大 radius/width/height
变小：scale_delta=0.8
左移一点：dx=-40
右移一点：dx=40
上移一点：dy=-40
下移一点：dy=40
```

5. 在 `handleVoiceCommand` 前插入快速匹配。

流程：

```text
最终识别文本
-> matchFastCommand
-> matched=true：设置状态 matched/drawing/done，执行本地命令
-> matched=false：设置状态 thinking，走原 LLM
```

### 验收标准

- “画一个红色圆”不调用后端，立即绘制。
- “撤销”“清空画布”不调用后端，立即执行。
- “把它变大”作用于最近创建或选中对象。
- 未命中的复杂命令继续走 LLM。
- 状态面板显示“快速匹配：创建红色圆形”。

### 当天提交

```bash
git add .
git commit -m "添加常用语音快速命令匹配"
```

## Day 3：乐观渲染与最近对象高亮

### 目标

让画布立即有反馈，并让“它”有明确视觉锚点。

### 建议改动文件

- `frontend/src/stores/canvasStore.ts`
- `frontend/src/components/CanvasBoard/index.tsx`
- `frontend/src/components/VoiceControl/index.tsx`
- 可选：`frontend/src/components/CanvasBoard/CanvasBoard.css`

### 任务步骤

1. 创建对象后自动选中。

修改 `addObject`：

```ts
set((state) => ({
  canvasObjects: [...state.canvasObjects, object],
  lastCreatedObjectId: object.id,
  lastModifiedObjectId: object.id,
  selectedObjectId: object.id,
}))
```

2. 修改对象后保持选中。

修改 `updateObject`：

```ts
lastModifiedObjectId: id,
selectedObjectId: id,
```

3. 删除对象后清理选中状态。

如果删除的是当前选中对象：

```ts
selectedObjectId: null
```

4. 在 `CanvasBoard` 中增加选中/最近对象高亮。

Konva 可用方案：

- 对基础图形增加额外描边。
- 或渲染一个半透明 bounding box。
- 第一周推荐简单实现：选中对象描边变成蓝色，`strokeWidth` 增加。

注意不要永久修改对象数据，只在渲染时叠加视觉效果。

5. 支持点击对象选中。

给对象增加：

```tsx
onClick={() => setSelectedObjectId(obj.id)}
onTap={() => setSelectedObjectId(obj.id)}
```

6. 对复杂 LLM 命令给出乐观状态。

第一周不需要真的画草稿，只要状态区显示：

```text
理解中：正在生成复杂图形...
```

### 验收标准

- 快速创建对象后，对象自动高亮。
- 点击画布对象可以选中。
- 用户说“把它变大”，修改选中或最近对象。
- 删除选中对象后，高亮消失。
- 复杂命令等待期间有明确状态，不是空白等待。

### 当天提交

```bash
git add .
git commit -m "添加对象自动选中和高亮反馈"
```

## Day 4：拖拽回写与手动微调

### 目标

承认并支持“手 + 眼 + 语音”的多模态交互。用户拖动物体后，数据状态必须同步。

### 建议改动文件

- `frontend/src/components/CanvasBoard/index.tsx`
- `frontend/src/stores/canvasStore.ts`

### 任务步骤

1. 给 `CanvasBoard` 引入 `updateObject` 和 `setSelectedObjectId`。

```ts
const {
  canvasObjects,
  setStageRef,
  updateObject,
  setSelectedObjectId,
} = useCanvasStore()
```

2. 给基础对象添加拖拽结束回调。

对于 `circle`、`rect`、`text`、`star`：

```tsx
onDragEnd={(event) => {
  updateObject(obj.id, {
    x: event.target.x(),
    y: event.target.y(),
  })
  setSelectedObjectId(obj.id)
}}
```

3. 处理 `line` / `polygon`。

线条没有简单的 `x/y` 参数时，可以在第一周采用较简单方案：

- 拖拽时允许 Konva 临时移动。
- `onDragEnd` 后把节点偏移量合并回 `points`。
- 然后把节点 `x/y` 重置为 0。

伪逻辑：

```ts
const dx = event.target.x()
const dy = event.target.y()
const nextPoints = obj.params.points.map((point, index) =>
  index % 2 === 0 ? point + dx : point + dy
)
updateObject(obj.id, { points: nextPoints, x: 0, y: 0 })
```

4. 处理 `group`。

第一周可以先将 group 拖动转为对整个 group 的 `x/y` 更新，或复用已有 `updateGroupObject` 对 legacy offset 的处理。

建议：

```tsx
onDragEnd={(event) => {
  updateObject(obj.id, {
    x: event.target.x(),
    y: event.target.y(),
  })
  setSelectedObjectId(obj.id)
}}
```

后续再做更精细的子元素坐标归并。

5. 防止拖拽造成历史记录过多。

只在 `onDragEnd` 调用 `updateObject`，不要在 `onDragMove` 写状态。

6. 手动选中后语音继续编辑。

确保 `buildCanvasContext()` 会带上最新 `selectedObjectId`。

### 验收标准

- 拖动圆形后保存，刷新后位置不丢。
- 拖动矩形后说“变成蓝色”，修改的是刚拖动对象。
- 点击对象后说“删除它”，删除的是选中对象。
- 拖拽不会造成明显卡顿。

### 当天提交

```bash
git add .
git commit -m "添加画布拖拽回写和手动选中"
```

## Day 5：补齐控制命令与体验收口

### 目标

完成基础工作流闭环：创建、修改、移动、撤销、重做、保存、导出、失败反馈。

### 建议改动文件

- `frontend/src/components/VoiceControl/index.tsx`
- `frontend/src/pages/Canvas/index.tsx`
- `frontend/src/services/fastCommandMatcher.ts`
- `frontend/src/stores/voiceStore.ts`
- `frontend/src/stores/canvasStore.ts`

### 任务步骤

1. 补齐快速控制命令。

支持：

```text
保存
导出
重做
取消
停止听
继续听
```

2. 设计 `VoiceControl` 与页面级动作的连接方式。

当前保存和导出逻辑在 `Canvas` 页面里。可选方案：

方案 A：把 `handleSave` / `handleExport` 通过 props 传给 `VoiceControl`。

```tsx
<VoiceControl onSave={handleSave} onExport={handleExport} />
```

方案 B：把保存/导出能力放进 canvas store 或单独 action store。

第一周推荐方案 A，改动最小。

3. 前端执行器补齐 `redo`。

当前快速命令和后端命令都可能出现：

```json
{"action": "redo"}
```

需要在 `executeCommands` 中支持：

```ts
case 'redo':
  redo()
  break
```

4. 增加失败反馈文案。

推荐文案：

```text
没听清，请再说一次。
这个命令我还不会，我会交给 AI 理解。
没有可修改的对象，请先选中或创建一个对象。
当前没有可撤销的操作。
保存失败，请稍后再试。
导出失败，请确认画布已加载。
```

5. 梳理 toast 与固定状态区的分工。

建议：

- 固定状态区显示过程和最终结果。
- toast 只用于重要成功/失败，例如保存成功、导出成功、权限错误。

6. 新增第一周测试清单。

新增文件：

```text
FIRST_WEEK_TEST_CHECKLIST.md
```

测试内容见本文最后一节。

### 验收标准

- 语音“保存”可以保存当前画布。
- 语音“导出”可以导出 PNG。
- 语音“重做”可用。
- 语音“取消/停止听”可用。
- 快速命令失败时不会静默。
- LLM 慢的时候有状态提示。

### 当天提交

```bash
git add .
git commit -m "补齐语音控制命令和失败反馈"
```

## Day 6：测试、修 bug、体验调参

### 目标

不加新大功能，集中验证第一周闭环，修掉阻塞演示的问题。

### 建议任务

1. 安装前端依赖并跑构建。

```bash
cd frontend
npm install
npm run build
```

2. 后端语法检查。

```bash
cd ..
python3 - <<'PY'
from pathlib import Path
for p in Path("backend/app").rglob("*.py"):
    compile(p.read_text(encoding="utf-8"), str(p), "exec")
print("backend syntax ok")
PY
```

3. 启动项目。

```bash
./start.sh
```

4. 浏览器手动测试核心 Demo。

```text
开始语音
说：画一个红色圆
说：把它变大一点
鼠标拖到左边
说：变成蓝色
说：撤销
说：重做
说：保存
说：导出
```

5. 调整快速命令的正则。

重点处理口语变体：

```text
画个圆
帮我画个圆
来一个红色圆
把这个变大一点
往左挪一点
删掉它
```

6. 检查状态文案是否过多。

原则：

- 每个阶段有反馈。
- 不刷屏。
- 不用 toast 淹没用户。

### 验收标准

- 前端能 build。
- 后端语法检查通过。
- 最小 Demo 能连续演示。
- 快速命令命中率覆盖常见表达。

### 当天提交

```bash
git add .
git commit -m "修复第一周语音交互体验问题"
```

## Day 7：整理文档与演示脚本

### 目标

形成可复盘、可演示、可继续迭代的第一周成果。

### 建议新增或更新文件

- `FIRST_WEEK_TEST_CHECKLIST.md`
- `PROJECT_OVERVIEW.md`
- `README.md`
- 可选：`docs/voice_interaction.md`

### 任务步骤

1. 完成测试清单。

至少包含：

```text
快速创建命令
快速编辑命令
快速控制命令
LLM fallback
拖拽回写
选中对象语音编辑
保存导出
错误状态
```

2. 写一个 2 分钟演示脚本。

示例：

```text
1. 打开画布，点击开始语音
2. 说“画一个红色圆”
3. 展示对象立即出现并高亮
4. 说“把它变大一点”
5. 拖动圆到左侧
6. 说“变成蓝色”
7. 说“撤销”
8. 说“保存”
9. 说“导出”
```

3. 在 README 或项目文档中说明新的交互模型。

建议描述：

```text
Voice Canvas 现在采用快速命令 + LLM 理解的双层语音交互：
常见命令本地立即执行，复杂创作请求交给 LLM 规划。
```

4. 记录下一阶段计划。

下一阶段建议：

```text
Scene Planner
场景级语音创作
对象关系和布局理解
tldraw Spike
视觉模型实验
```

### 验收标准

- 有完整测试清单。
- 有演示脚本。
- 文档说明第一周新增能力。
- 下一阶段任务清晰。

### 当天提交

```bash
git add .
git commit -m "整理第一周语音画布体验文档"
```

## 第一周测试清单建议

建议创建 `FIRST_WEEK_TEST_CHECKLIST.md`，内容如下。

```markdown
# 第一周测试清单

## 快速创建

- [ ] 说“画一个红色圆”，立即创建红色圆。
- [ ] 说“画一个蓝色矩形”，立即创建蓝色矩形。
- [ ] 说“画一条线”，立即创建横线。
- [ ] 说“画一个星星”，立即创建星星。
- [ ] 说“写文字：你好”，立即创建文字。

## 快速编辑

- [ ] 创建对象后说“把它变大”，对象放大。
- [ ] 创建对象后说“把它变小”，对象缩小。
- [ ] 创建对象后说“把它变蓝”，对象变蓝。
- [ ] 创建对象后说“左移一点”，对象左移。
- [ ] 创建对象后说“右移一点”，对象右移。

## 选中与拖拽

- [ ] 创建对象后自动高亮。
- [ ] 点击对象后对象高亮。
- [ ] 拖动对象后保存并刷新，位置不丢。
- [ ] 拖动对象后说“变成绿色”，修改的是刚拖动对象。

## 控制命令

- [ ] 说“撤销”，撤销上一步。
- [ ] 说“重做”，恢复上一步。
- [ ] 说“清空画布”，清空对象。
- [ ] 说“保存”，保存画布。
- [ ] 说“导出”，导出 PNG。

## LLM fallback

- [ ] 说“画一个海边日落”，未命中快速命令时进入 LLM。
- [ ] LLM 请求期间显示“正在理解...”。
- [ ] LLM 返回后显示执行结果。

## 错误反馈

- [ ] 没有对象时说“把它变大”，提示需要先创建或选中对象。
- [ ] 语音识别失败时显示错误状态。
- [ ] LLM 失败时显示错误状态。
```

## 最小演示目标

第一周结束时，必须能顺滑演示：

```text
开始语音
说：画一个红色圆
圆立即出现并高亮

说：把它变大一点
圆立即变大

用鼠标拖到左边
说：变成蓝色
左边那个圆变蓝

说：撤销
颜色恢复

说：保存
显示保存成功

说：导出
下载 PNG
```

## 第一周结束后的复盘问题

- 用户是否还能感到明显等待？
- 快速命令是否覆盖了 80% 的基础操作？
- 用户是否清楚系统当前在听、在理解、还是在绘制？
- “它”是否有明确视觉锚点？
- 手动拖拽和语音编辑是否能自然衔接？
- 当前 Konva 画板是否还能支撑第二阶段 Scene Planner？

