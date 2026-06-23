# 智能路由架构重构可执行计划

## 1. 目标

本计划用于重构当前项目的智能路由架构，使路由决策层只负责轻量级分类，不再提前构建场景计划、对象请求或执行命令。

目标架构：

```text
语音文本
  -> 噪音清洗 / 归一化
  -> 第一层 A：前端快速命令
       控制、基础图形、简单编辑、选择、高亮确认
  -> 第一层 B：确定性 SVG / 模板对象快速创建
       猫、狗、电脑、杯子、沙发
  -> 第二层：固定场景模板 + Scene Patch
       公园、生日贺卡、城市夜景
  -> 第三层：LLM
       复杂编辑、开放式未知对象、复杂场景生成
```

重构后应满足：

- 路由层 `llm_router.py` 只返回轻量 `LLMRouteDecision`。
- 执行层 `llm_service.py` 根据路由结果按需构建 `ScenePlan`、`SimpleObjectRequest` 和命令。
- 固定场景命中仍保持本地快速生成。
- Scene Patch 判断保留在路由层，以便准确标记 `requires_llm`。
- SVG 素材匹配允许在路由层发生，但必须避免重复扫文件系统。
- Tool Plan 失败后不再二次回退调用 SVG 场景 LLM。
- LLM 超时更短、更可控，避免用户长时间等待。

## 2. 已确认设计决策

### 决策 1：简单对象匹配只返回轻量元数据

路由层不解析完整位置、颜色、尺寸，也不返回完整 `SimpleObjectRequest`。

推荐返回字段：

```python
matched_object_kind: str | None
matched_object_label: str | None
matched_object_source: Literal["svg_asset", "template_object"] | None
matched_asset_id: str | None
```

位置、尺寸、颜色、描述等执行参数在 `llm_service.py` 中按需构建。

### 决策 2：Scene Patch 判断保留在路由层

`has_scene_patch_hint()` 继续由路由层调用。

原因：

- 路由结果需要准确区分 `template_scene` 和 `template_scene_patch`。
- `requires_llm` 应在路由阶段即可确定。
- 执行层不应重新猜测是否需要 LLM。

### 决策 3：AssetResolver 可在路由层调用，但必须缓存

允许路由层判断 SVG 素材是否存在。

必须同步优化：

- `AssetResolver.list_assets()` 不应每次请求都重新 `rglob("*.svg")`。
- 增加实例级或模块级缓存。
- 如果缓存实现复杂，至少在一次 `classify_llm_route()` 中复用同一个 resolver。

### 决策 4：LLM 超时调整

建议值：

```python
SVG_GENERATION_TIMEOUT_SECONDS = 30.0
TOOL_PLANNING_TIMEOUT_SECONDS = 20.0
SVG_MAX_TOKENS = 2600
TOOL_PLANNING_MAX_TOKENS = 1200
```

说明：

- 30 秒仍未返回的 SVG 生成，对交互式画布来说应视为失败并降级。
- Tool Plan 是结构化 JSON 规划，不应占用过长时间。
- 测试连接超时可继续保留 30 秒。

### 决策 5：移除 Tool Plan 的 SVG fallback

删除或停用：

```python
_tool_plan_needs_svg_fallback()
```

以及 Tool Plan 失败后调用：

```python
SvgSceneGenerator().generate(...)
```

新的行为：

- Tool Plan 返回不可执行计划时，返回 `clarify`。
- 不在执行层临时改路由。
- 开放式绘画请求只应由 `open_scene` 路由进入 SVG 生成。

## 3. 当前问题定位

### 3.1 路由层提前构建重对象

当前文件：

- `backend/app/services/llm_router.py`

当前问题：

```python
template_scene_plan = build_template_scene_plan(text)
simple_object_request = build_simple_object_request(text)
```

问题影响：

- 路由决策和执行构建耦合。
- 难以判断性能瓶颈属于匹配、构建还是执行。
- 测试会依赖重对象字段，阻碍重构。
- 后续优化只能围绕错误边界打补丁。

### 3.2 执行层依赖路由层重对象

当前文件：

- `backend/app/services/llm_service.py`

当前问题：

```python
template_scene_plan = decision.template_scene_plan
object_request = decision.simple_object_request
```

问题影响：

- `llm_service.py` 不能独立决定何时构建对象。
- `classify_llm_route()` 无法保持轻量。
- `LLMRouteDecision` 被迫携带执行层数据。

### 3.3 AssetResolver 可能重复扫文件系统

当前文件：

- `backend/app/assets/resolver.py`

当前问题：

```python
for file_path in sorted(root.rglob("*.svg")):
```

问题影响：

- 简单对象路由可能反复扫描 SVG 素材目录。
- 当素材库增长后，第一层 B 会变慢。
- 这比场景模板的字符串匹配更可能成为长期瓶颈。

### 3.4 Tool Plan fallback 造成双 LLM 调用

当前文件：

- `backend/app/services/llm_service.py`

当前问题：

```python
if self._tool_plan_needs_svg_fallback(plan, normalized):
    svg_scene = await SvgSceneGenerator().generate(...)
```

问题影响：

- 一次用户请求可能触发 Tool Plan 和 SVG Scene 两次 LLM 调用。
- 延迟不可控。
- 路由语义不稳定：本来是 `tool_plan`，执行时又改走 `open_scene`。

## 4. 实施阶段

## Phase 0：建立基线

目标：在修改前确认当前测试和关键行为。

执行命令：

```bash
cd backend
python -m pytest tests/test_llm_router.py tests/test_scene_templates.py tests/test_llm_service_svg_scene.py tests/test_svg_scene_generator.py
```

如果项目未安装 pytest：

```bash
cd backend
python -m unittest discover tests
```

记录：

- 当前失败测试数量。
- 当前失败原因。
- 当前未提交改动，尤其是 `svg_generator.py`、`llm_service.py`、`start.sh`。

验收：

- 明确哪些失败是重构前已有问题。
- 不回退用户或其他工具已有改动。

## Phase 1：重定义 LLMRouteDecision

目标：删除路由结果中的重对象字段。

修改文件：

- `backend/app/services/llm_router.py`

删除字段：

```python
template_scene_plan: Optional[ScenePlan] = None
simple_object_request: Optional[SimpleObjectRequest] = None
```

新增轻量字段：

```python
matched_scene_type: Optional[str] = None
matched_scene_title: Optional[str] = None
matched_object_kind: Optional[str] = None
matched_object_label: Optional[str] = None
matched_object_source: Optional[str] = None
matched_asset_id: Optional[str] = None
```

同步清理 imports：

- 移除 `SimpleObjectRequest`。
- 移除 `ScenePlan`。
- 不再从 router 中导入会构建完整对象的函数。

验收：

- `LLMRouteDecision` 中不再存在 `template_scene_plan`。
- `LLMRouteDecision` 中不再存在 `simple_object_request`。
- 类型定义能表达 template scene、template scene patch、local object、open scene、tool plan、requires llm。

## Phase 2：拆分场景模板匹配和构建

目标：路由阶段只匹配 `scene_type`，执行阶段再构建 `ScenePlan`。

修改文件：

- `backend/app/scene/templates.py`
- `backend/app/services/llm_router.py`
- `backend/app/services/llm_service.py`

### 2.1 新增按类型构建函数

在 `templates.py` 中新增：

```python
def build_template_scene_plan_by_type(scene_type: str) -> Optional[ScenePlan]:
    normalized_type = normalize_scene_type(scene_type)
    if not get_scene_template(normalized_type):
        return None

    title = SCENE_TITLES.get(normalized_type, normalized_type)
    plan = ScenePlan(
        scene_type=normalized_type,
        title=title,
        style="cartoon_flat",
        objects=[],
        response=f"好的，我用模板快速生成了{title}场景。",
    )
    return apply_scene_template(plan)
```

注意：

- 现有 `build_template_scene_plan(text)` 保留，用于兼容 `test_scene_templates.py` 或其他直接调用方。
- `build_template_scene_plan(text)` 内部可以改为先 `match_template_scene_type(text)`，再调用 `build_template_scene_plan_by_type(scene_type)`。

### 2.2 路由层只匹配 scene_type

在 `llm_router.py` 中：

```python
scene_type = match_template_scene_type(text)
```

不再调用：

```python
build_template_scene_plan(text)
```

Scene Patch 判断需要 title：

```python
scene_title = get_scene_title(scene_type)
needs_patch = has_scene_patch_hint(text, scene_title, scene_type)
```

如果没有现成函数，新增：

```python
def get_scene_title(scene_type: str) -> str:
    normalized_type = normalize_scene_type(scene_type)
    return SCENE_TITLES.get(normalized_type, normalized_type)
```

验收：

- `classify_llm_route("画一个公园")` 返回 `matched_scene_type == "park"`。
- `classify_llm_route("画一个生日贺卡，写妈妈生日快乐")` 返回 `route == "template_scene_patch"`。
- 路由层没有构建 `ScenePlan`。

## Phase 3：拆分简单对象匹配和构建

目标：路由层只返回简单对象匹配元数据，执行层按需构建完整 `SimpleObjectRequest`。

修改文件：

- `backend/app/drawing/object_request.py`
- `backend/app/services/llm_router.py`
- `backend/app/services/llm_service.py`

### 3.1 新增轻量匹配结果

在 `object_request.py` 中新增：

```python
@dataclass(frozen=True)
class SimpleObjectMatch:
    kind: str
    source: str
    label: str
    asset_id: Optional[str] = None
```

新增函数：

```python
def match_simple_object(
    text: str,
    asset_resolver: Optional[AssetResolver] = None,
) -> Optional[SimpleObjectMatch]:
    ...
```

实现要求：

- 复用 `is_simple_object_text(text)`。
- 复用 `extract_object_phrase(text)`。
- 允许使用 `AssetResolver` 查素材。
- 如果命中 SVG asset，返回 `kind`、`source="svg_asset"`、`label`、`asset_id`。
- 如果命中模板对象，返回 `kind`、`source="template_object"`、`label`。
- 不构建 `CreateObjectArgs`。
- 不解析 position、size、style。

### 3.2 保留 build_simple_object_request

`build_simple_object_request(text)` 继续存在，并可内部复用 `match_simple_object(text)`。

执行层需要完整请求时调用：

```python
object_request = build_simple_object_request(text)
```

或者新增更确定的重建函数：

```python
def build_simple_object_request_from_match(
    text: str,
    match: SimpleObjectMatch,
    asset_resolver: Optional[AssetResolver] = None,
) -> Optional[SimpleObjectRequest]:
    ...
```

推荐使用第二种，避免路由命中和执行重建出现分歧。

验收：

- `classify_llm_route("画一只小猫")` 返回 `route == "local_object"`。
- 返回 `matched_object_source == "svg_asset"`。
- 返回 `matched_asset_id`。
- 路由层不返回 `SimpleObjectRequest`。

## Phase 4：AssetResolver 缓存

目标：避免每次对象路由都扫 SVG 目录。

修改文件：

- `backend/app/assets/resolver.py`

推荐实现：

```python
class AssetResolver:
    _assets_cache: Optional[List[SVGAsset]] = None
    _cache_roots_key: Optional[tuple[str, ...]] = None

    def list_assets(self) -> List[SVGAsset]:
        roots_key = tuple(str(root.resolve()) for root in self.roots if root.exists())
        if self.__class__._assets_cache is not None and self.__class__._cache_roots_key == roots_key:
            return self.__class__._assets_cache

        assets = self._scan_assets()
        self.__class__._assets_cache = assets
        self.__class__._cache_roots_key = roots_key
        return assets
```

注意：

- 如果担心开发时新增素材后缓存不刷新，可新增：

```python
@classmethod
def clear_cache(cls) -> None:
    cls._assets_cache = None
    cls._cache_roots_key = None
```

- 测试中如果修改素材目录，调用 `AssetResolver.clear_cache()`。

验收：

- `resolve()` 和 `resolve_text()` 行为不变。
- 多次调用 `list_assets()` 不重复扫描目录。
- 前端素材 manifest 未受影响。

## Phase 5：执行层按需构建

目标：`llm_service.py` 不再读取路由重对象字段，而是根据轻量字段构建。

修改文件：

- `backend/app/services/llm_service.py`

### 5.1 Template Scene 执行

旧逻辑：

```python
template_scene_plan = decision.template_scene_plan
```

新逻辑：

```python
if decision.route in {"template_scene", "template_scene_patch"} and decision.matched_scene_type:
    template_scene_plan = build_template_scene_plan_by_type(decision.matched_scene_type)
    if not template_scene_plan:
        return clarify(...)
```

后续：

```python
commands = SceneExecutor(canvas_context).execute(template_scene_plan)
```

### 5.2 Local Object 执行

旧逻辑：

```python
if decision.route == "local_object" and decision.simple_object_request:
    object_request = decision.simple_object_request
```

新逻辑：

```python
if decision.route == "local_object":
    object_request = build_simple_object_request_from_match(text, decision.to_object_match())
    if not object_request:
        return clarify(...)
```

如果不新增 `to_object_match()`，直接使用 decision 字段组装。

验收：

- `llm_service.py` 不再访问 `decision.template_scene_plan`。
- `llm_service.py` 不再访问 `decision.simple_object_request`。
- 本地对象创建返回结构保持兼容：

```json
"local_object": {
  "source": "...",
  "label": "...",
  "asset_id": "...",
  "kind": "..."
}
```

## Phase 6：移除 Tool Plan SVG fallback

目标：让 `tool_plan` 路由失败时稳定返回追问，不再隐式切到 SVG Scene。

修改文件：

- `backend/app/services/llm_service.py`

删除调用：

```python
if self._tool_plan_needs_svg_fallback(plan, normalized):
    svg_scene = await SvgSceneGenerator().generate(...)
```

处理方式：

```python
if not normalized.get("commands"):
    return {
        "intent": "clarify",
        "confidence": 0.0,
        "commands": [],
        "response": "我没能生成可靠的可执行绘图步骤，请换一种更具体的说法。",
        "reason": "LLM tool plan produced no executable commands",
        "llm_route": "tool_plan",
        "llm_used": True,
        "routing_reason": decision.reason,
    }
```

可选：

- 删除 `_tool_plan_needs_svg_fallback()`。
- 如果暂时不删，确保没有调用方。

验收：

- `tool_plan` 不再调用 `SvgSceneGenerator().generate()`。
- 开放式绘画仍只通过 `decision.route == "open_scene"` 调用 SVG 生成。

## Phase 7：调整 LLM 超时

目标：降低交互等待时间，提高失败可控性。

修改文件：

- `backend/app/scene/svg_generator.py`
- `backend/app/services/llm_service.py`

建议修改：

```python
SVG_GENERATION_TIMEOUT_SECONDS = 30.0
TOOL_PLANNING_TIMEOUT_SECONDS = 20.0
```

保留：

```python
SVG_MAX_TOKENS = 2600
TOOL_PLANNING_MAX_TOKENS = 1200
```

验收：

- SVG 生成 OpenAI client timeout 和 request timeout 使用 30 秒。
- Tool Plan client timeout 和 request timeout 使用 20 秒。
- 测试连接仍可使用 30 秒。

## Phase 8：测试更新

目标：让测试验证新架构，而不是旧重对象字段。

修改文件：

- `backend/tests/test_llm_router.py`
- `backend/tests/test_scene_templates.py`
- `backend/tests/test_llm_service_svg_scene.py`
- `backend/tests/test_svg_scene_generator.py`

### 8.1 Router 测试更新

旧断言：

```python
self.assertIsNotNone(decision.template_scene_plan)
self.assertEqual(decision.template_scene_plan.scene_type, "park")
```

新断言：

```python
self.assertEqual(decision.matched_scene_type, "park")
self.assertEqual(decision.matched_scene_title, "公园")
```

旧断言：

```python
self.assertIsNotNone(decision.simple_object_request)
```

新断言：

```python
self.assertEqual(decision.matched_object_source, "svg_asset")
self.assertIsNotNone(decision.matched_asset_id)
```

### 8.2 新增测试：路由层不构建重对象

可使用 monkeypatch 或 unittest mock：

```python
with patch("app.services.llm_router.build_template_scene_plan") as mocked:
    classify_llm_route("画一个公园")
    mocked.assert_not_called()
```

如果 router 不再 import 该函数，则测试改为检查字段不存在：

```python
self.assertFalse(hasattr(decision, "template_scene_plan"))
self.assertFalse(hasattr(decision, "simple_object_request"))
```

### 8.3 新增测试：Tool Plan 不 fallback

目标：

- 模拟 Tool Plan 返回空 commands。
- 断言 `SvgSceneGenerator.generate` 未被调用。
- 断言返回 `intent == "clarify"`。

## Phase 9：验证命令

后端测试：

```bash
cd backend
python -m pytest tests/test_llm_router.py
python -m pytest tests/test_scene_templates.py
python -m pytest tests/test_llm_service_svg_scene.py
python -m pytest tests/test_svg_scene_generator.py
python -m pytest
```

如果没有 pytest：

```bash
cd backend
python -m unittest discover tests
```

前端类型检查：

```bash
cd frontend
npm run build
```

手动回归用例：

```text
画一个公园
画一个生日贺卡，写妈妈生日快乐
画一只小猫
画一台电脑
画一艘帆船
画一个机器人
画一幅赛博朋克书房，有猫和电脑
把天空变紫
```

预期：

- 公园：`template_scene`，不使用 LLM。
- 生日贺卡加文字：有 LLM 配置时 `template_scene_patch`，无配置时本地模板并提示附加描述未应用。
- 小猫 / 电脑：`local_object`，不使用 LLM。
- 帆船：`local_object` 或本地模板对象，不使用 LLM。
- 机器人：`open_scene`，使用 LLM SVG 场景。
- 赛博朋克书房：`open_scene`，使用 LLM SVG 场景。
- 把天空变紫：`tool_plan`，使用 LLM 工具规划。

## 5. 代码完成标准

必须全部满足：

- `LLMRouteDecision` 不携带 `ScenePlan`。
- `LLMRouteDecision` 不携带 `SimpleObjectRequest`。
- `classify_llm_route()` 不调用 `build_template_scene_plan()`。
- `classify_llm_route()` 不调用 `build_simple_object_request()`。
- `llm_service.py` 按需构建 `ScenePlan`。
- `llm_service.py` 按需构建 `SimpleObjectRequest`。
- `AssetResolver` 不在连续请求中重复扫描素材目录。
- `tool_plan` 不再 fallback 到 SVG scene generation。
- 超时常量更新为 SVG 30 秒、Tool Plan 20 秒。
- 现有测试更新并通过。

## 6. 风险与处理

### 风险 1：轻量对象匹配和执行重建结果不一致

处理：

- 新增 `build_simple_object_request_from_match()`。
- 执行层用路由阶段的 match 元数据重建，而不是重新自由匹配。

### 风险 2：AssetResolver 缓存导致新增素材不生效

处理：

- 提供 `AssetResolver.clear_cache()`。
- 开发环境新增素材后重启服务或调用清缓存。
- 测试中显式清缓存。

### 风险 3：Scene Patch 误判

处理：

- 保留 `has_scene_patch_hint()` 的现有逻辑。
- 先不扩大 patch words。
- 新增针对生日贺卡、城市夜景、公园等模板的测试。

### 风险 4：移除 fallback 后部分请求从“慢但有结果”变成“追问”

处理：

- 这是预期取舍：稳定性优先于隐式双 LLM 调用。
- 如果未来需要 fallback，应回到路由层重新设计，而不是执行层临时改路。

### 风险 5：现有工作区已有未提交改动

处理：

- 修改前先 `git status --short`。
- 不回退 `svg_generator.py`、`llm_service.py`、`start.sh` 中已有改动。
- 每个阶段后检查 diff，确认只包含当前阶段预期修改。

## 7. 建议提交拆分

推荐拆成 4 个提交：

1. `refactor: make llm route decisions lightweight`
2. `refactor: build scene and object requests in execution layer`
3. `perf: cache svg asset resolver and shorten llm timeouts`
4. `fix: remove tool-plan svg fallback`

如果希望降低 review 压力，也可以按 Phase 1-8 分成更多小提交。

## 8. 后续可选优化

这些不属于本次必须完成范围：

- 场景模板匹配加入关键词预筛选。
- 场景模板别名改为 trie 或编译后的 matcher。
- 给路由阶段增加耗时日志。
- 给每个 route 输出 trace id，方便前端调试。
- Scene Patch 改为“先返回基础模板，再异步增强”的双阶段体验。
- 前端第一层 A 快速命令和后端路由输出统一 trace schema。

