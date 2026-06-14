import json
import logging
from typing import Any, Dict, Optional

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
对象数量控制在 6-14 个。
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
- 不要创建少于 6 个对象，除非用户明确要求极简。
- 不要创建超过 14 个对象。
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
        if "办公室" in raw:
            return "office"
        if "咖啡馆" in raw:
            return "cafe"
        return "open_scene"

    def _title_from_text(self, text: str) -> str:
        normalized = "".join(str(text or "").split())
        for prefix in ("请帮我画一个", "请帮我画一幅", "帮我画一个", "帮我画一幅", "画一个", "画一幅", "画个", "生成一个", "创建一个", "来一个", "来个", "做一个", "做个", "画"):
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
            max_tokens=3200,
        )

        content = response.choices[0].message.content or ""
        try:
            result = self._coerce_scene_plan_payload(self._extract_json(content), text)
            plan = ScenePlan.model_validate(result)
        except json.JSONDecodeError as exc:
            logger.warning("ScenePlanner JSON parse failed: %s; content=%s", exc, content[:1000])
            raise ScenePlanningError(
                "我没能可靠规划这个场景，请换一种说法再试一次。",
                "Scene Planner 返回内容不是有效 JSON",
            ) from exc
        except ValidationError as exc:
            logger.warning("ScenePlanner validation failed, attempting repair: %s; content=%s", exc, content[:1000])
            plan = await self._repair_plan(text, content, str(exc), llm_config)

        if not plan.objects:
            raise ScenePlanningError(
                "我没有规划出可绘制的场景对象，请再说得具体一点。",
                "ScenePlan objects 为空",
            )

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
            max_tokens=3200,
        )

        content = response.choices[0].message.content or ""
        try:
            result = self._coerce_scene_plan_payload(self._extract_json(content), text)
            return ScenePlan.model_validate(result)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise ScenePlanningError(
                "我规划出的场景结构不完整，请再描述一次你想画的场景。",
                f"ScenePlan 修复后仍校验失败: {str(exc)[:800]}",
            ) from exc
