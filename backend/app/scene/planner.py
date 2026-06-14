import json
import logging
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
from pydantic import ValidationError

from app.models.llm_config import LLMConfig
from app.scene.schemas import ScenePlan
from app.assets.resolver import AssetResolver


logger = logging.getLogger(__name__)


class ScenePlanningError(Exception):
    def __init__(self, message: str, reason: str):
        super().__init__(message)
        self.message = message
        self.reason = reason


class ScenePlanner:
    SYSTEM_PROMPT = """你是语音绘画系统的第三层开放场景规划器。
前两层已经处理了快速几何命令和固定场景模板。你只负责更开放、更有组合性的场景描述。
你的任务是把用户的一句话绘画需求拆成语义化场景计划，不要输出底层 Konva 参数。
只输出严格 JSON，不要 Markdown，不要代码块。
画布大小为 800x600。
对象数量控制在 5-10 个。
对象要有合理布局和层级。

输出 JSON 必须符合这个结构：
{
  "scene_type": "英文场景类型，如 rainy_cafe/cyberpunk_workspace/pet_party",
  "title": "中文场景标题",
  "style": "cartoon_flat",
  "background": {
    "fill": "背景颜色，可选",
    "horizon_y": 330,
    "ground_fill": "地面颜色，可选"
  },
  "objects": [
    {
      "id_hint": "可选的语义id",
      "kind": "对象语义。优先使用 SVG 素材目录里的 kind；基础图形可用 circle/rect/line/text/star/polygon",
      "render_strategy": "basic|template|svg",
      "role": "background|midground|foreground|decoration|label",
      "position": {
        "anchor": "center|top|bottom|left|right|top_left|top_right|bottom_left|bottom_right|custom",
        "x": 400,
        "y": 300,
        "layer": 1
      },
      "size": {
        "preset": "tiny|small|medium|large|huge|wide|tall",
        "width": 120,
        "height": 80
      },
      "style": {
        "fill": "#F97316",
        "stroke": "#000000",
        "opacity": 1,
        "text": "文字内容"
      },
      "label": "中文对象名",
      "description": "简短视觉描述"
    }
  ],
  "layout_notes": "简短说明布局",
  "response": "给用户的简短中文回复"
}

规则：
- 必须返回单个 JSON object。
- 不要创建少于 5 个对象，除非用户明确要求极简。
- 不要创建超过 10 个对象。
- 只输出语义化对象，不要输出 Konva shape 参数或 children。
- 默认 style 使用 cartoon_flat。
- 优先使用 SVG 素材，render_strategy 设为 "svg"，kind 使用素材目录中的英文 kind。
- 大块背景、地面、墙面、水面、文字和简单装饰用 basic，避免把背景错误匹配成图标。
- 对于素材目录没有的具体物体，也可以输出 render_strategy="svg" 并在 description 里描述外观，系统会自动回退。
- position.anchor 优先使用语义锚点，只有精确布局需要 custom x/y。
- background 和远景对象 layer 较小，前景对象 layer 较大。
- 如果用户要求贺卡或海报，文字对象 kind 使用 text，style.text 填入文字。
- 不要直接复述固定模板；要体现用户的开放描述和差异化对象。
"""

    EXAMPLE = {
        "scene_type": "beach_sunset",
        "title": "海边日落",
        "style": "cartoon_flat",
        "background": {
            "fill": "#FDE68A",
            "horizon_y": 330,
            "ground_fill": "#F6C453",
        },
        "objects": [
            {
                "kind": "sun",
                "role": "background",
                "position": {"anchor": "top_right", "layer": 1},
                "size": {"preset": "large"},
                "style": {"fill": "#F97316"},
                "label": "太阳",
            },
            {
                "kind": "river",
                "role": "midground",
                "position": {"anchor": "center", "layer": 2},
                "size": {"preset": "wide"},
                "style": {"fill": "#38BDF8"},
                "label": "海面",
            },
        ],
        "layout_notes": "太阳在右上角，海面在中部，沙滩在底部。",
        "response": "好的，我规划了一个海边日落场景。",
    }

    def _extract_json(self, content: str) -> Dict[str, Any]:
        normalized = str(content or "").strip()
        if normalized.startswith("```"):
            lines = normalized.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            normalized = "\n".join(lines).strip()

        try:
            parsed = json.loads(normalized)
        except json.JSONDecodeError:
            object_start = normalized.find("{")
            array_start = normalized.find("[")
            candidates = [start for start in (object_start, array_start) if start >= 0]
            if not candidates:
                raise

            start = min(candidates)
            closing = "}" if normalized[start] == "{" else "]"
            end = normalized.rfind(closing)
            if end <= start:
                raise
            parsed = json.loads(normalized[start:end + 1])

        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list):
            return {"objects": parsed}
        raise json.JSONDecodeError("ScenePlanner response is not a JSON object", content, 0)

    def _coerce_scene_plan_payload(self, payload: Dict[str, Any], text: str) -> Dict[str, Any]:
        if isinstance(payload.get("scene"), dict):
            nested = dict(payload["scene"])
            nested.update({key: value for key, value in payload.items() if key not in {"scene"}})
            payload = nested

        objects = (
            payload.get("objects")
            or payload.get("items")
            or payload.get("elements")
            or payload.get("scene_objects")
        )

        coerced = dict(payload)
        if isinstance(objects, list):
            coerced["objects"] = [
                self._coerce_scene_object(obj, index)
                for index, obj in enumerate(objects)
                if isinstance(obj, dict)
            ]

        coerced.setdefault("scene_type", self._scene_type_from_text(text))
        coerced.setdefault("title", self._title_from_text(text))
        coerced.setdefault("style", "cartoon_flat")
        coerced.setdefault("source", "llm_open_scene")
        coerced.setdefault("response", f"好的，我规划了{coerced['title']}场景。")
        return coerced

    def _coerce_scene_object(self, obj: Dict[str, Any], index: int) -> Dict[str, Any]:
        coerced = dict(obj)
        coerced["kind"] = str(
            coerced.get("kind")
            or coerced.get("type")
            or coerced.get("name")
            or coerced.get("object")
            or "rect"
        )

        if "render_strategy" not in coerced and "renderStrategy" in coerced:
            coerced["render_strategy"] = coerced.get("renderStrategy")

        position = coerced.get("position")
        if not isinstance(position, dict):
            position = {}
        if "anchor" not in position:
            position["anchor"] = "custom" if position.get("x") is not None and position.get("y") is not None else "center"
        position.setdefault("layer", index + 1)
        coerced["position"] = position

        size = coerced.get("size")
        if not isinstance(size, dict):
            size = {}
        size.setdefault("preset", "medium")
        coerced["size"] = size

        style = coerced.get("style")
        if not isinstance(style, dict):
            style = {}
        if "fontSize" in style and "font_size" not in style:
            style["font_size"] = style["fontSize"]
        if "verticalAlign" in style and "vertical_align" not in style:
            style["vertical_align"] = style["verticalAlign"]
        coerced["style"] = style

        if "label" not in coerced:
            coerced["label"] = coerced.get("title") or coerced["kind"]
        return coerced

    def _scene_type_from_text(self, text: str) -> str:
        raw = "".join(str(text or "").split()).lower()
        if "赛博朋克" in raw:
            return "cyberpunk_room"
        if "书房" in raw:
            return "study_room"
        if "图书馆" in raw:
            return "library"
        if "办公室" in raw:
            return "office"
        if "咖啡馆" in raw:
            return "cafe"
        if "书店" in raw:
            return "bookstore"
        return "open_scene"

    def _title_from_text(self, text: str) -> str:
        normalized = "".join(str(text or "").split())
        for prefix in (
            "请帮我画一个",
            "请帮我画一幅",
            "请帮我设计一个",
            "请帮我设计一幅",
            "请帮我生成一个",
            "请帮我创建一个",
            "请帮我制作一个",
            "请帮我做一个",
            "帮我画一个",
            "帮我画一幅",
            "帮我设计一个",
            "帮我设计一幅",
            "帮我生成一个",
            "帮我创建一个",
            "帮我制作一个",
            "帮我做一个",
            "请设计一个",
            "请设计一幅",
            "请生成一个",
            "请生成一幅",
            "请创建一个",
            "请制作一个",
            "请做一个",
            "请来一个",
            "请来个",
            "请画一个",
            "请画一幅",
            "画一个",
            "画一幅",
            "画个",
            "设计一个",
            "设计一幅",
            "生成一个",
            "生成一幅",
            "创建一个",
            "制作一个",
            "来一个",
            "来个",
            "做一个",
            "做个",
            "画",
        ):
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):]
                break
        return normalized[:16] or "开放场景"

    def _format_canvas_context(self, canvas_context: Optional[Dict[str, Any]]) -> str:
        if not canvas_context:
            return "当前画布上下文：无。"

        objects = canvas_context.get("objects") or []
        object_count = len(objects)
        selected = canvas_context.get("selectedObjectId")
        recent = [
            {
                "id": obj.get("id"),
                "type": obj.get("type"),
                "kind": obj.get("kind"),
                "x": obj.get("x"),
                "y": obj.get("y"),
            }
            for obj in objects[-10:]
        ]

        return "\n".join([
            "当前画布上下文：",
            f"对象数量={object_count}",
            f"selectedObjectId={selected}",
            f"最近对象={json.dumps(recent, ensure_ascii=False)}",
        ])

    def _parse_plan_content(self, content: str, text: str) -> ScenePlan:
        result = self._coerce_scene_plan_payload(self._extract_json(content), text)
        return ScenePlan.model_validate(result)

    def _fallback_object(
        self,
        kind: str,
        label: str,
        role: str,
        layer: int,
        x: float,
        y: float,
        width: float,
        height: float,
        render_strategy: str = "svg",
        fill: Optional[str] = None,
        text: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        style: Dict[str, Any] = {}
        if fill:
            style["fill"] = fill
        if text:
            style.update({
                "text": text,
                "font_size": 24,
                "align": "center",
                "vertical_align": "middle",
            })

        return {
            "kind": kind,
            "render_strategy": render_strategy,
            "role": role,
            "position": {"anchor": "custom", "x": x, "y": y, "layer": layer},
            "size": {"preset": "medium", "width": width, "height": height},
            "style": style,
            "label": label,
            "description": description or label,
        }

    def _fallback_scene_palette(self, raw: str) -> Dict[str, Any]:
        if any(word in raw for word in ("赛博", "霓虹", "夜景", "夜晚", "暗黑")):
            return {"fill": "#111827", "horizon_y": 390, "ground_fill": "#1F2937"}
        if any(word in raw for word in ("海底", "水下", "海洋")):
            return {"fill": "#0F766E", "horizon_y": 405, "ground_fill": "#115E59"}
        if any(word in raw for word in ("太空", "宇宙", "星球")):
            return {"fill": "#0B1026", "horizon_y": 430, "ground_fill": "#151A36"}
        if any(word in raw for word in ("森林", "公园", "花园", "草地", "庭院")):
            return {"fill": "#BAE6FD", "horizon_y": 365, "ground_fill": "#86EFAC"}
        return {"fill": "#E0F2FE", "horizon_y": 395, "ground_fill": "#CBD5E1"}

    def fallback_plan(self, text: str, reason: str = "") -> ScenePlan:
        raw = "".join(str(text or "").split())
        title = self._title_from_text(text)
        scene_type = self._scene_type_from_text(text)
        background = self._fallback_scene_palette(raw)
        objects: List[Dict[str, Any]] = []

        is_cyber = any(word in raw for word in ("赛博", "霓虹", "未来感", "科幻"))
        is_indoor = any(word in raw for word in ("书房", "房间", "室内", "卧室", "办公室", "工作室", "图书馆", "书店", "咖啡馆", "餐厅"))
        is_cafe = any(word in raw for word in ("咖啡", "餐厅", "茶", "杯"))
        is_city = any(word in raw for word in ("城市", "街道", "赛博", "未来", "高楼", "广场", "小镇"))
        is_nature = any(word in raw for word in ("森林", "公园", "花园", "草地", "庭院", "山", "海边", "湖", "河"))
        is_space = any(word in raw for word in ("太空", "宇宙", "星球", "月球"))
        is_underwater = any(word in raw for word in ("海底", "水下", "海洋"))

        if is_underwater:
            objects.extend([
                self._fallback_object("water_surface", "水面", "background", 1, 400, 150, 560, 100, description="层叠的蓝绿色水面"),
                self._fallback_object("fish", "鱼", "foreground", 4, 250, 310, 95, 70, description="水下游动的小鱼"),
                self._fallback_object("fish", "鱼群", "foreground", 5, 560, 250, 80, 60, description="远处的小鱼"),
                self._fallback_object("building", "海底城市", "midground", 3, 390, 395, 240, 190, description="被海水包围的城市建筑"),
                self._fallback_object("plant_potted", "海草装饰", "foreground", 6, 120, 470, 95, 130, description="像海草一样摇曳的植物"),
            ])
        elif is_space:
            objects.extend([
                self._fallback_object("moon", "月亮", "background", 1, 640, 125, 120, 120),
                self._fallback_object("star", "星星", "decoration", 2, 165, 110, 55, 55, "basic", fill="#FDE68A"),
                self._fallback_object("star", "星星", "decoration", 2, 500, 95, 45, 45, "basic", fill="#FDE68A"),
                self._fallback_object("circle", "星球", "midground", 3, 315, 330, 140, 140, "basic", fill="#7DD3FC"),
                self._fallback_object("text", "标题", "label", 5, 400, 505, 360, 56, "basic", fill="#E0F2FE", text=title),
            ])
        elif is_city and not is_indoor:
            objects.extend([
                self._fallback_object("building", "高楼", "midground", 2, 220, 340, 150, 245),
                self._fallback_object("building_office", "办公楼", "midground", 2, 450, 325, 170, 270),
                self._fallback_object("road_straight", "道路", "foreground", 4, 400, 510, 560, 120),
                self._fallback_object("street_light", "路灯", "foreground", 5, 650, 370, 85, 210),
                self._fallback_object("car_sedan", "汽车", "foreground", 6, 300, 500, 145, 85),
            ])
        elif is_nature and not is_indoor:
            objects.extend([
                self._fallback_object("sun", "太阳", "background", 1, 650, 115, 115, 115),
                self._fallback_object("cloud", "云", "background", 1, 230, 115, 150, 80),
                self._fallback_object("tree_deciduous", "树", "midground", 3, 175, 380, 150, 230),
                self._fallback_object("tree_pine", "松树", "midground", 3, 585, 385, 135, 235),
                self._fallback_object("grass_patch", "草地", "foreground", 5, 400, 515, 420, 110),
                self._fallback_object("flower_patch", "花丛", "foreground", 6, 285, 490, 145, 90),
            ])
        else:
            objects.extend([
                self._fallback_object("window", "窗户", "background", 1, 620, 165, 130, 120),
                self._fallback_object("picture_frame", "墙面装饰", "background", 1, 190, 165, 110, 95),
                self._fallback_object("table_desk" if not is_cafe else "table_dining", "桌子", "midground", 3, 405, 405, 300, 150),
                self._fallback_object("chair_dining", "椅子", "midground", 3, 245, 430, 120, 145),
                self._fallback_object("lamp_desk" if not is_cafe else "lamp_floor", "灯", "foreground", 5, 560, 335, 95, 145),
                self._fallback_object("plant_potted", "绿植", "foreground", 5, 125, 435, 90, 135),
            ])
            if is_cafe:
                objects.append(self._fallback_object("cup_coffee", "咖啡杯", "foreground", 6, 410, 335, 70, 70))
            elif "猫" in raw:
                objects.append(self._fallback_object("cat", "小猫", "foreground", 6, 540, 470, 95, 85))
            else:
                objects.append(self._fallback_object("bookshelf", "书架", "midground", 2, 285, 260, 150, 230))

        if is_cyber:
            background = {"fill": "#111827", "horizon_y": 390, "ground_fill": "#1F2937"}
            objects.append(
                self._fallback_object(
                    "text",
                    "霓虹标题",
                    "label",
                    7,
                    400,
                    90,
                    360,
                    64,
                    "basic",
                    fill="#22D3EE",
                    text=title[:12],
                    description="霓虹发光文字招牌",
                )
            )
            objects.append(
                self._fallback_object(
                    "rect",
                    "霓虹光带",
                    "decoration",
                    6,
                    400,
                    465,
                    520,
                    16,
                    "basic",
                    fill="#EC4899",
                    description="横向霓虹灯带",
                )
            )

        plan_payload = {
            "scene_type": scene_type,
            "title": title,
            "style": "cartoon_flat",
            "source": "llm_open_scene_fallback",
            "background": background,
            "objects": objects[:10],
            "layout_notes": f"LLM 场景规划不可用时的素材兜底。{reason[:180]}",
            "response": f"好的，我先按你的描述生成了{title}。",
        }
        return ScenePlan.model_validate(plan_payload)

    async def _repair_or_fallback(
        self,
        text: str,
        invalid_content: str,
        error: str,
        llm_config: LLMConfig,
    ) -> ScenePlan:
        try:
            return await self._repair_plan(text, invalid_content, error, llm_config)
        except ScenePlanningError as exc:
            logger.warning("ScenePlanner repair failed, using fallback plan: %s", exc.reason)
            return self.fallback_plan(text, exc.reason)
        except Exception as exc:
            logger.warning("ScenePlanner repair crashed, using fallback plan: %s", exc)
            return self.fallback_plan(text, str(exc))

    async def plan(
        self,
        text: str,
        canvas_context: Optional[Dict[str, Any]],
        llm_config: LLMConfig,
        asset_resolver: Optional[AssetResolver] = None,
    ) -> ScenePlan:
        resolver = asset_resolver or AssetResolver()
        client = AsyncOpenAI(
            api_key=llm_config.api_key,
            base_url=llm_config.base_url,
            timeout=75.0,
        )
        svg_catalog = resolver.catalog_summary()

        response = await client.chat.completions.create(
            model=llm_config.model_name,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "system", "content": f"可用 SVG 素材目录：\n{svg_catalog}"},
                {
                    "role": "system",
                    "content": f"参考输出示例：{json.dumps(self.EXAMPLE, ensure_ascii=False)}",
                },
                {"role": "system", "content": self._format_canvas_context(canvas_context)},
                {"role": "user", "content": text},
            ],
            temperature=0.45,
            max_tokens=3600,
            timeout=75.0,
        )

        content = response.choices[0].message.content or ""
        try:
            plan = self._parse_plan_content(content, text)
        except json.JSONDecodeError as exc:
            logger.warning("ScenePlanner JSON parse failed, attempting repair: %s; content=%s", exc, content[:1000])
            plan = await self._repair_or_fallback(text, content, str(exc), llm_config)
        except ValidationError as exc:
            logger.warning("ScenePlanner validation failed, attempting repair: %s; content=%s", exc, content[:1000])
            plan = await self._repair_or_fallback(text, content, str(exc), llm_config)

        if not plan.objects:
            logger.warning("ScenePlanner returned empty objects, using fallback plan")
            return self.fallback_plan(text, "ScenePlan objects 为空")

        return plan

    async def _repair_plan(
        self,
        text: str,
        invalid_content: str,
        error: str,
        llm_config: LLMConfig,
    ) -> ScenePlan:
        client = AsyncOpenAI(
            api_key=llm_config.api_key,
            base_url=llm_config.base_url,
            timeout=75.0,
        )

        response = await client.chat.completions.create(
            model=llm_config.model_name,
            messages=[
                {"role": "system", "content": "你是 JSON 修复器。只返回一个符合 ScenePlan 结构的严格 JSON object，不要 Markdown。"},
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "system", "content": f"校验错误：{error[:1200]}"},
                {"role": "system", "content": f"上一版无效输出：{invalid_content[:4000]}"},
                {"role": "user", "content": text},
            ],
            temperature=0.0,
            max_tokens=3600,
            timeout=75.0,
        )

        content = response.choices[0].message.content or ""
        try:
            return self._parse_plan_content(content, text)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ScenePlanningError(
                "我规划出的场景结构不完整，请再描述一次你想画的场景。",
                f"ScenePlan 修复后仍校验失败: {str(exc)[:800]}",
            ) from exc
