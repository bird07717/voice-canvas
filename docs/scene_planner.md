# Scene Planner 技术文档

## 架构

Scene Planner 负责把一句场景级语音请求转换成语义化场景计划，再由本地执行器转换成现有 Canvas commands。

链路：

```text
语音文本
-> fastCommandMatcher
-> 未命中快速命令
-> backend is_scene_request
-> ScenePlanner 生成 ScenePlan
-> 模板融合
-> SceneExecutor 生成 create commands
-> 前端渐进绘制
```

快速命令仍在前端本地执行。只有“画一个海边日落”“画一个公园”这类场景级请求进入 Scene Planner。

## ScenePlan JSON

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
      "style": {"fill": "#F97316"},
      "label": "太阳"
    }
  ],
  "layout_notes": "太阳在右上角，海面在中部，沙滩在底部。",
  "response": "好的，我规划了一个海边日落场景。"
}
```

核心 schema 位于 `backend/app/scene/schemas.py`。

## 支持的 Scene Types

首批内置模板位于 `backend/app/scene/templates.py`：

- `beach_sunset`
- `park`
- `birthday_card`
- `city_night`
- `forest_house`
- `mountain_landscape`
- `simple_classroom`

## 支持的 Object Kinds

Scene Executor 第一版支持：

- 模板对象：`sun`、`tree`、`cloud`、`house`、`flower`、`person`、`car`、`mountain`、`grass`、`road`、`river`
- 基础对象：`circle`、`rect`、`line`、`text`、`star`、`polygon`

未知对象会降级为文本占位，避免画布空白失败。

## 如何新增模板

1. 在 `SCENE_TEMPLATES` 中新增一个 key。
2. 设置 `scene_type`、`default_objects`、`palette`、`layout`。
3. 每个对象至少包含 `kind`、`role`、`position`、`size`、`style`、`label`。
4. 如需中文或别名命中，在 `SCENE_TYPE_ALIASES` 中添加映射。
5. 用容器内命令验证模板能生成 commands：

```bash
docker compose exec -T backend python -c "from app.scene.schemas import ScenePlan; from app.scene.templates import apply_scene_template; from app.scene.executor import SceneExecutor; p=apply_scene_template(ScenePlan(scene_type='park', title='公园', objects=[{'kind':'placeholder'}])); print(len(SceneExecutor().execute(p)))"
```

## 如何测试

前端：

```bash
cd frontend
npm run build
```

后端语法：

```bash
python3 - <<'PY'
from pathlib import Path
for p in Path("backend/app").rglob("*.py"):
    compile(p.read_text(encoding="utf-8"), str(p), "exec")
print("backend syntax ok")
PY
```

模板冒烟：

```bash
docker compose exec -T backend python - <<'PY'
from app.scene.schemas import ScenePlan
from app.scene.templates import apply_scene_template
from app.scene.executor import SceneExecutor

for scene_type in [
    "beach_sunset",
    "park",
    "birthday_card",
    "city_night",
    "forest_house",
    "mountain_landscape",
    "simple_classroom",
]:
    plan = apply_scene_template(ScenePlan(scene_type=scene_type, title=scene_type, objects=[{"kind": "placeholder"}]))
    commands = SceneExecutor().execute(plan)
    print(scene_type, len(commands))
    assert len(commands) >= 5
PY
```
