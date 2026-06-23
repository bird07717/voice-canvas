from __future__ import annotations

import asyncio
import html
import json
import logging
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any, Dict, Optional

from openai import AsyncOpenAI

from app.models.llm_config import LLMConfig


logger = logging.getLogger(__name__)

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
SVG_GENERATION_TIMEOUT_SECONDS = 30.0
SVG_MAX_TOKENS = 2600


@dataclass(frozen=True)
class SvgSceneResult:
    scene_type: str
    title: str
    svg: str
    response: str
    style: str = "svg"
    source: str = "llm_svg_scene"
    layout_notes: Optional[str] = None


class SvgSceneGeneratorError(Exception):
    pass


class SvgSceneGenerator:
    SYSTEM_PROMPT = """你是语音绘画系统的第三层 SVG 画面生成器。
前两层已经处理了快速几何命令和固定场景模板。
你只负责把用户的开放式绘画需求，直接写成一整张可渲染的 SVG 画面。

只输出一个完整的 <svg>...</svg>，不要 JSON，不要 Markdown，不要解释。
第一字符必须是 <，最后一段必须是 </svg>。
画布固定为 800x600，viewBox 必须是 "0 0 800 600"。
尽量使用单引号属性值。
不要使用 script、foreignObject、iframe、image、video、audio、link、style 标签。
不要引用外部资源，不要写事件属性。
可以使用 rect、circle、ellipse、line、polygon、polyline、path、text、defs、linearGradient、radialGradient、clipPath、mask。

要求：
- 画面要完整，有背景、主体、前景和必要装饰。
- SVG 控制在 40 个图形元素以内，优先使用简洁几何组合，必须完整闭合。
- 优先生成稳定、短小、可解析的 SVG，不要追求复杂细节。
- 如果用户要求赛博朋克、图书馆、咖啡馆、房间、教室、生日贺卡、海边、森林等，直接围绕该主题创作。
- 文字要直接写进 SVG 里。
- 场景要像一整张作品，而不是对象清单。
"""

    def __init__(self) -> None:
        pass

    async def generate(
        self,
        text: str,
        canvas_context: Optional[Dict[str, Any]],
        llm_config: LLMConfig,
        timeout_seconds: float = SVG_GENERATION_TIMEOUT_SECONDS,
    ) -> SvgSceneResult:
        try:
            svg = await asyncio.wait_for(
                self._generate_svg(text, canvas_context, llm_config, timeout_seconds),
                timeout=timeout_seconds + 5.0,
            )
            return self._build_result(text, svg, source="llm_svg_scene")
        except Exception as exc:
            logger.warning("SVG scene generation failed, using fallback: %s", exc)
            return self.fallback(text, str(exc))

    async def _generate_svg(
        self,
        text: str,
        canvas_context: Optional[Dict[str, Any]],
        llm_config: LLMConfig,
        timeout_seconds: float,
    ) -> str:
        client = AsyncOpenAI(
            api_key=llm_config.api_key,
            base_url=llm_config.base_url,
            timeout=timeout_seconds,
        )

        response = await client.chat.completions.create(
            model=llm_config.model_name,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "system", "content": self._format_canvas_context(canvas_context)},
                {"role": "user", "content": self._format_user_prompt(text)},
            ],
            temperature=0.35,
            max_tokens=SVG_MAX_TOKENS,
            timeout=timeout_seconds,
        )

        choice = response.choices[0]
        content = self._extract_response_text(choice.message)
        try:
            return self._sanitize_svg(self._extract_svg(content))
        except SvgSceneGeneratorError as exc:
            finish_reason = getattr(choice, "finish_reason", None)
            raise SvgSceneGeneratorError(f"{exc}; finish_reason={finish_reason}") from exc

    def _extract_response_text(self, message: Any) -> str:
        content = str(getattr(message, "content", "") or "").strip()
        if content:
            return content

        dumped = message.model_dump() if hasattr(message, "model_dump") else {}
        for key in ("reasoning_content", "reasoning"):
            value = dumped.get(key) or getattr(message, key, None)
            if value:
                return str(value).strip()

        raise SvgSceneGeneratorError("模型返回空内容")

    def fallback(self, text: str, reason: str = "") -> SvgSceneResult:
        scene_type = self._scene_type_from_text(text)
        title = self._title_from_text(text)
        svg = self._fallback_svg(scene_type, title)
        return self._build_result(
            text,
            svg,
            source="llm_svg_scene_fallback",
            reason=reason,
            scene_type=scene_type,
            title=title,
        )

    def _build_result(
        self,
        text: str,
        svg: str,
        source: str,
        reason: str = "",
        scene_type: Optional[str] = None,
        title: Optional[str] = None,
    ) -> SvgSceneResult:
        resolved_title = title or self._title_from_text(text)
        resolved_scene_type = scene_type or self._scene_type_from_text(text)
        response = f"好的，我生成了{resolved_title}。"
        layout_notes = "直接 SVG 场景生成"
        if reason:
            layout_notes = f"{layout_notes}。{reason[:180]}"

        return SvgSceneResult(
            scene_type=resolved_scene_type,
            title=resolved_title,
            svg=svg,
            response=response,
            style="svg",
            source=source,
            layout_notes=layout_notes,
        )

    def _extract_svg(self, content: str) -> str:
        normalized = str(content or "").strip()
        for candidate in self._content_candidates(normalized):
            svg = self._find_svg_fragment(candidate)
            if svg:
                return svg

        snippet = normalized[:240].replace("\n", " ")
        raise SvgSceneGeneratorError(f"模型没有返回完整的 SVG 根节点，输出摘要: {snippet}")

    def _content_candidates(self, content: str) -> list[str]:
        candidates = []

        try:
            parsed = json.loads(content)
        except Exception:
            parsed = None

        if isinstance(parsed, str):
            candidates.append(parsed)
        elif isinstance(parsed, dict):
            for key in ("svg", "rawSvg", "content", "result", "data"):
                value = parsed.get(key)
                if isinstance(value, str):
                    candidates.append(value)
        elif isinstance(parsed, list):
            candidates.extend(item for item in parsed if isinstance(item, str))

        for match in re.finditer(r"```(?:svg|xml)?\s*([\s\S]*?)```", content, flags=re.IGNORECASE):
            candidates.append(match.group(1).strip())

        candidates.append(content)
        candidates.extend(html.unescape(candidate) for candidate in list(candidates))
        return [candidate.strip() for candidate in candidates if candidate and candidate.strip()]

    def _find_svg_fragment(self, content: str) -> Optional[str]:
        start_match = re.search(r"<\s*svg(?=[\s>/])", content, flags=re.IGNORECASE)
        end_matches = list(re.finditer(r"</\s*svg\s*>", content, flags=re.IGNORECASE))
        if not start_match or not end_matches:
            return None

        end_match = end_matches[-1]
        if end_match.end() <= start_match.start():
            return None

        fragment = content[start_match.start():end_match.end()]
        if '\\"' in fragment:
            fragment = fragment.replace('\\"', '"')
        return fragment

    def _sanitize_svg(self, svg: str) -> str:
        try:
            root = ET.fromstring(svg)
        except ET.ParseError as exc:
            raise SvgSceneGeneratorError(f"SVG 解析失败: {exc}") from exc

        if self._canonical_tag(root.tag) != "svg":
            raise SvgSceneGeneratorError("SVG 根节点不是 <svg>")

        clean_root = self._sanitize_node(root)
        if clean_root is None:
            raise SvgSceneGeneratorError("SVG 为空")

        clean_root.set("width", "800")
        clean_root.set("height", "600")
        clean_root.set("viewBox", "0 0 800 600")
        clean_root.set("preserveAspectRatio", "none")
        return ET.tostring(clean_root, encoding="unicode")

    def _sanitize_node(self, node: ET.Element) -> Optional[ET.Element]:
        tag = self._canonical_tag(node.tag)
        sanitized_children = []
        for child in list(node):
            clean_child = self._sanitize_node(child)
            if clean_child is not None:
                sanitized_children.append(clean_child)

        if tag not in self._allowed_tags():
            if sanitized_children:
                container = ET.Element(f"{{{SVG_NS}}}g")
                for child in sanitized_children:
                    container.append(child)
                return container
            return None

        clean = ET.Element(f"{{{SVG_NS}}}{tag}")
        for attr, value in node.attrib.items():
            sanitized = self._sanitize_attr(tag, attr, value)
            if sanitized is not None:
                clean.set(self._normalize_attr_name(attr), sanitized)

        if tag in {"text", "title", "desc", "tspan"} and node.text:
            clean.text = node.text
        elif tag == "svg" and node.text and node.text.strip():
            clean.text = node.text

        for child in sanitized_children:
            clean.append(child)

        return clean

    def _sanitize_attr(self, tag: str, attr: str, value: str) -> Optional[str]:
        name = self._normalize_attr_name(attr)
        value = str(value)
        lowered = value.lower()

        if name.startswith("on"):
            return None
        if name in {"href", "xlink:href"}:
            return None
        if name == "style":
            return None
        if "javascript:" in lowered or "expression(" in lowered:
            return None
        if "url(" in lowered and not lowered.startswith("url(#"):
            return None

        allowed = self._allowed_attributes(tag)
        if name in allowed or name.startswith("data-"):
            return value
        return None

    def _allowed_tags(self) -> set[str]:
        return {
            "svg",
            "g",
            "defs",
            "title",
            "desc",
            "rect",
            "circle",
            "ellipse",
            "line",
            "polygon",
            "polyline",
            "path",
            "text",
            "tspan",
            "clipPath",
            "mask",
            "linearGradient",
            "radialGradient",
            "stop",
        }

    def _allowed_attributes(self, tag: str) -> set[str]:
        common = {
            "id",
            "class",
            "transform",
            "fill",
            "fill-opacity",
            "fill-rule",
            "stroke",
            "stroke-opacity",
            "stroke-width",
            "stroke-linecap",
            "stroke-linejoin",
            "stroke-dasharray",
            "stroke-dashoffset",
            "opacity",
            "clip-path",
            "mask",
            "filter",
            "vector-effect",
            "data-role",
            "data-kind",
            "data-id",
            "data-label",
        }
        if tag in {"svg", "g", "defs"}:
            return common | {"xmlns", "width", "height", "viewBox", "preserveAspectRatio", "overflow"}
        if tag in {"rect", "circle", "ellipse", "line", "polygon", "polyline", "path"}:
            return common | {
                "x",
                "y",
                "x1",
                "y1",
                "x2",
                "y2",
                "cx",
                "cy",
                "r",
                "rx",
                "ry",
                "width",
                "height",
                "points",
                "d",
            }
        if tag in {"text", "tspan"}:
            return common | {
                "x",
                "y",
                "dx",
                "dy",
                "font-family",
                "font-size",
                "font-weight",
                "text-anchor",
                "dominant-baseline",
                "letter-spacing",
                "word-spacing",
            }
        if tag in {"clipPath", "mask"}:
            return common | {"x", "y", "width", "height", "clipPathUnits", "maskUnits", "maskContentUnits"}
        if tag in {"linearGradient", "radialGradient"}:
            return common | {"x1", "y1", "x2", "y2", "cx", "cy", "r", "fx", "fy", "gradientUnits"}
        if tag == "stop":
            return common | {"offset", "stop-color", "stop-opacity"}
        return common

    def _normalize_attr_name(self, attr: str) -> str:
        if "}" in attr:
            attr = attr.split("}", 1)[1]
        return attr

    def _local_name(self, tag: str) -> str:
        if "}" in tag:
            return tag.split("}", 1)[1]
        return tag

    def _canonical_tag(self, tag: str) -> str:
        local = self._local_name(tag)
        aliases = {name.lower(): name for name in self._allowed_tags()}
        return aliases.get(local.lower(), local)

    def _format_user_prompt(self, text: str) -> str:
        return "\n".join([
            f"用户绘画需求：{text}",
            "请现在直接输出 SVG。",
            "SVG 要简洁、完整、可解析，不要超过 40 个图形元素。",
            "尽量控制在 2600 tokens 以内。",
            "不要写“好的”、不要解释、不要代码围栏。",
            "输出必须从 <svg 开始，以 </svg> 结束。",
        ])

    def _format_canvas_context(self, canvas_context: Optional[Dict[str, Any]]) -> str:
        if not canvas_context:
            return "当前画布上下文：无。"

        objects = canvas_context.get("objects") or []
        recent = [
            {
                "id": obj.get("id"),
                "type": obj.get("type"),
                "kind": obj.get("kind"),
            }
            for obj in objects[-10:]
        ]
        return "\n".join([
            "当前画布上下文：",
            f"对象数量={len(objects)}",
            f"selectedObjectId={canvas_context.get('selectedObjectId')}",
            f"最近对象={recent}",
        ])

    def _scene_type_from_text(self, text: str) -> str:
        raw = "".join(str(text or "").split()).lower()
        if any(word in raw for word in ("赛博朋克", "霓虹", "未来感", "科幻")):
            return "cyberpunk_room"
        if any(word in raw for word in ("图书馆", "书店", "书架", "书柜")):
            return "library"
        if any(word in raw for word in ("咖啡馆", "咖啡", "餐厅", "茶座")):
            return "cafe"
        if any(word in raw for word in ("教室", "课堂", "黑板", "老师")):
            return "classroom"
        if any(word in raw for word in ("生日贺卡", "贺卡", "生日快乐", "生日")):
            return "birthday_card"
        if any(word in raw for word in ("海边", "沙滩", "日落", "海洋")):
            return "beach_sunset"
        if any(word in raw for word in ("森林", "公园", "花园", "草地", "树")):
            return "nature_scene"
        if any(word in raw for word in ("城市", "夜景", "街道", "高楼")):
            return "city_night"
        if any(word in raw for word in ("房间", "书房", "卧室", "办公室", "工作室")):
            return "room"
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
            "请画一个",
            "请画一幅",
            "画一个",
            "画一幅",
            "画个",
            "生成一个",
            "生成一幅",
            "创建一个",
            "制作一个",
            "来一个",
            "来个",
            "做一个",
            "做个",
            "加一个",
            "加个",
            "加一只",
            "加一条",
            "加一辆",
            "添加一个",
            "添加个",
            "添加一只",
            "添加一条",
            "添加一辆",
            "添加",
            "画",
            "设计一个",
            "设计一幅",
        ):
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):]
                break
        return normalized[:18] or "开放场景"

    def _fallback_svg(self, scene_type: str, title: str) -> str:
        title_text = html.escape(title)
        common_head = f"""<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600' preserveAspectRatio='none' data-scene-type='{scene_type}' data-scene-title='{title_text}'>
  <defs>
    <linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#e8f3ff'/>
      <stop offset='100%' stop-color='#cbd5e1'/>
    </linearGradient>
  </defs>
  <rect width='800' height='600' fill='url(#bg)'/>
"""
        tail = "</svg>"

        if scene_type == "cyberpunk_room":
            body = f"""
  <defs>
    <linearGradient id='night' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#0f172a'/>
      <stop offset='100%' stop-color='#312e81'/>
    </linearGradient>
    <linearGradient id='neon' x1='0' y1='0' x2='1' y2='0'>
      <stop offset='0%' stop-color='#22d3ee'/>
      <stop offset='100%' stop-color='#f472b6'/>
    </linearGradient>
  </defs>
  <rect width='800' height='600' fill='url(#night)'/>
  <rect y='392' width='800' height='208' fill='#111827'/>
  <g opacity='0.28' stroke='#38bdf8' stroke-width='1'>
    <path d='M0 430H800M0 470H800M0 510H800M0 550H800'/>
    <path d='M90 392V600M210 392V600M330 392V600M450 392V600M570 392V600M690 392V600'/>
  </g>
  <rect x='108' y='132' width='228' height='150' rx='16' fill='#0f172a' stroke='url(#neon)' stroke-width='3'/>
  <rect x='138' y='162' width='168' height='82' rx='10' fill='#020617' stroke='#22d3ee' stroke-width='2'/>
  <rect x='172' y='418' width='200' height='32' rx='10' fill='#22d3ee'/>
  <rect x='184' y='316' width='180' height='80' rx='10' fill='#0f172a' stroke='#f472b6' stroke-width='2'/>
  <rect x='410' y='160' width='190' height='160' rx='14' fill='#111827' stroke='#67e8f9' stroke-width='3'/>
  <rect x='432' y='184' width='146' height='104' rx='8' fill='#0f172a' stroke='#22d3ee' stroke-width='2'/>
  <rect x='514' y='424' width='168' height='28' rx='10' fill='#f472b6'/>
  <circle cx='638' cy='124' r='42' fill='#f472b6' opacity='0.35'/>
  <text x='400' y='76' fill='#7dd3fc' font-size='34' font-weight='700' text-anchor='middle' letter-spacing='2'>{title_text}</text>
"""
            return common_head + body + tail

        if scene_type == "library":
            body = f"""
  <defs>
    <linearGradient id='warm' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#fff7ed'/>
      <stop offset='100%' stop-color='#f5d0a9'/>
    </linearGradient>
  </defs>
  <rect width='800' height='600' fill='url(#warm)'/>
  <rect y='424' width='800' height='176' fill='#c08457'/>
  <rect x='92' y='122' width='168' height='236' rx='10' fill='#7c2d12'/>
  <rect x='98' y='132' width='156' height='216' fill='#431407'/>
  <rect x='140' y='150' width='18' height='176' fill='#f8fafc'/>
  <rect x='188' y='150' width='18' height='176' fill='#f8fafc'/>
  <rect x='402' y='122' width='168' height='236' rx='10' fill='#7c2d12'/>
  <rect x='408' y='132' width='156' height='216' fill='#431407'/>
  <rect x='450' y='150' width='18' height='176' fill='#f8fafc'/>
  <rect x='498' y='150' width='18' height='176' fill='#f8fafc'/>
  <rect x='286' y='352' width='228' height='80' rx='14' fill='#a16207'/>
  <rect x='306' y='326' width='188' height='28' rx='10' fill='#f8fafc'/>
  <circle cx='638' cy='116' r='42' fill='#fde68a'/>
  <rect x='620' y='180' width='94' height='168' rx='12' fill='#fef3c7' stroke='#d97706' stroke-width='3'/>
  <text x='400' y='76' fill='#78350f' font-size='34' font-weight='700' text-anchor='middle'>{title_text}</text>
"""
            return common_head + body + tail

        if scene_type == "cafe":
            body = f"""
  <defs>
    <linearGradient id='latte' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#fff7ed'/>
      <stop offset='100%' stop-color='#fed7aa'/>
    </linearGradient>
  </defs>
  <rect width='800' height='600' fill='url(#latte)'/>
  <rect y='430' width='800' height='170' fill='#d97706'/>
  <rect x='72' y='124' width='176' height='150' rx='18' fill='#fff7ed' stroke='#ea580c' stroke-width='3'/>
  <path d='M72 170H248' stroke='#fdba74' stroke-width='3'/>
  <circle cx='118' cy='408' r='72' fill='#7c2d12'/>
  <rect x='104' y='332' width='28' height='132' fill='#7c2d12'/>
  <rect x='286' y='354' width='140' height='22' rx='8' fill='#a16207'/>
  <ellipse cx='356' cy='334' rx='62' ry='24' fill='#fed7aa' stroke='#b45309' stroke-width='3'/>
  <rect x='320' y='330' width='72' height='8' fill='#b45309'/>
  <rect x='466' y='144' width='184' height='130' rx='14' fill='#fff7ed' stroke='#ea580c' stroke-width='3'/>
  <path d='M466 208H650' stroke='#fdba74' stroke-width='3'/>
  <circle cx='566' cy='396' r='20' fill='#fff7ed' stroke='#b45309' stroke-width='3'/>
  <rect x='544' y='386' width='44' height='18' rx='4' fill='#d97706'/>
  <text x='400' y='76' fill='#9a3412' font-size='34' font-weight='700' text-anchor='middle'>{title_text}</text>
"""
            return common_head + body + tail

        if scene_type == "birthday_card":
            body = f"""
  <defs>
    <linearGradient id='party' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#fff1f2'/>
      <stop offset='100%' stop-color='#fecdd3'/>
    </linearGradient>
  </defs>
  <rect width='800' height='600' fill='url(#party)'/>
  <rect x='52' y='52' width='696' height='496' rx='24' fill='#ffffff' stroke='#fb7185' stroke-width='6'/>
  <circle cx='164' cy='170' r='34' fill='#fb7185'/>
  <circle cx='240' cy='130' r='28' fill='#f59e0b'/>
  <circle cx='606' cy='142' r='30' fill='#8b5cf6'/>
  <rect x='290' y='244' width='220' height='120' rx='18' fill='#fda4af'/>
  <rect x='348' y='198' width='104' height='52' rx='12' fill='#fde68a'/>
  <text x='400' y='286' fill='#9f1239' font-size='34' font-weight='700' text-anchor='middle'>生日快乐</text>
  <text x='400' y='332' fill='#be123c' font-size='18' text-anchor='middle'>Happy Birthday</text>
  <text x='400' y='76' fill='#9f1239' font-size='32' font-weight='700' text-anchor='middle'>{title_text}</text>
"""
            return common_head + body + tail

        if scene_type == "beach_sunset":
            body = f"""
  <defs>
    <linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#fde68a'/>
      <stop offset='100%' stop-color='#fb7185'/>
    </linearGradient>
    <linearGradient id='sea' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#38bdf8'/>
      <stop offset='100%' stop-color='#0f766e'/>
    </linearGradient>
  </defs>
  <rect width='800' height='600' fill='url(#sky)'/>
  <circle cx='640' cy='144' r='56' fill='#fff7ed' opacity='0.95'/>
  <rect y='360' width='800' height='240' fill='url(#sea)'/>
  <path d='M0 408C100 388 180 430 280 410C380 390 468 430 560 412C640 396 720 412 800 402V600H0Z' fill='#0f172a' opacity='0.18'/>
  <text x='400' y='76' fill='#78350f' font-size='34' font-weight='700' text-anchor='middle'>{title_text}</text>
"""
            return common_head + body + tail

        if scene_type == "nature_scene":
            body = f"""
  <defs>
    <linearGradient id='nature' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0%' stop-color='#dbeafe'/>
      <stop offset='100%' stop-color='#bbf7d0'/>
    </linearGradient>
  </defs>
  <rect width='800' height='600' fill='url(#nature)'/>
  <circle cx='648' cy='122' r='46' fill='#fde68a'/>
  <ellipse cx='180' cy='190' rx='72' ry='28' fill='#ffffff'/>
  <ellipse cx='250' cy='170' rx='86' ry='34' fill='#ffffff'/>
  <ellipse cx='496' cy='188' rx='74' ry='28' fill='#ffffff'/>
  <ellipse cx='566' cy='170' rx='90' ry='36' fill='#ffffff'/>
  <path d='M0 450C130 410 220 476 350 448C468 422 560 464 680 442C730 432 770 436 800 446V600H0Z' fill='#86efac'/>
  <rect x='132' y='296' width='28' height='130' fill='#92400e'/>
  <path d='M146 284C108 292 96 332 104 352C124 334 156 334 184 352C188 322 176 292 146 284Z' fill='#15803d'/>
  <rect x='580' y='286' width='28' height='126' fill='#92400e'/>
  <path d='M594 274C560 282 546 320 556 342C572 326 610 326 628 342C632 312 620 280 594 274Z' fill='#15803d'/>
  <text x='400' y='76' fill='#14532d' font-size='34' font-weight='700' text-anchor='middle'>{title_text}</text>
"""
            return common_head + body + tail

        body = f"""
  <rect y='356' width='800' height='244' fill='#e2e8f0'/>
  <rect x='84' y='132' width='160' height='156' rx='14' fill='#ffffff' stroke='#60a5fa' stroke-width='3'/>
  <rect x='320' y='164' width='202' height='92' rx='14' fill='#e0f2fe' stroke='#38bdf8' stroke-width='3'/>
  <rect x='306' y='362' width='212' height='82' rx='18' fill='#cbd5e1'/>
  <rect x='600' y='122' width='104' height='178' rx='14' fill='#f8fafc' stroke='#94a3b8' stroke-width='3'/>
  <rect x='630' y='156' width='44' height='110' rx='8' fill='#dbeafe'/>
  <circle cx='652' cy='398' r='34' fill='#fef3c7'/>
  <text x='400' y='82' fill='#1e293b' font-size='34' font-weight='700' text-anchor='middle'>{title_text}</text>
"""
        return common_head + body + tail
