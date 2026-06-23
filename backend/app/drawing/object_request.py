from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from app.assets.resolver import AssetResolver, SVGAsset
from app.drawing.executor import TEMPLATE_KINDS
from app.drawing.schemas import CreateObjectArgs, PositionSpec, SizeSpec, StyleSpec
from app.drawing.target_resolver import BASE_KIND_PROFILES, KIND_ALIASES


REQUEST_PREFIXES = (
    "麻烦你",
    "麻烦",
    "请你",
    "请帮我",
    "帮我",
    "给我",
    "我想要",
    "我想",
    "想要",
    "请",
)

DRAW_PREFIXES = (
    "画一个",
    "画一只",
    "画一条",
    "画一辆",
    "画一台",
    "画一棵",
    "画一朵",
    "画一颗",
    "画一盏",
    "画一把",
    "画一座",
    "画一片",
    "画个",
    "画",
    "绘制",
    "生成一个",
    "生成",
    "创建一个",
    "创建",
    "来一个",
    "来个",
    "做一个",
    "做个",
    "加一个",
    "加个",
    "加一只",
    "加一条",
    "加一辆",
    "加一台",
    "加一棵",
    "加一朵",
    "加一颗",
    "加",
    "添加一个",
    "添加个",
    "添加一只",
    "添加一条",
    "添加一辆",
    "添加一台",
    "添加一棵",
    "添加",
)

BLOCKED_PREFIXES = (
    "选中",
    "选择",
    "删除",
    "删掉",
    "清空",
    "撤销",
    "重做",
    "保存",
    "导出",
    "把",
    "将",
    "让",
    "改",
    "换",
    "变",
    "移动",
    "移到",
    "移去",
    "挪到",
    "放到",
    "放在",
    "去掉",
    "移除",
)

SCENE_HINTS = (
    "场景",
    "画面",
    "插画",
    "风景",
    "海报",
    "卡片",
    "壁纸",
    "封面",
    "一幅",
    "房间",
    "室内",
    "书房",
    "卧室",
    "厨房",
    "办公室",
    "工作室",
    "实验室",
    "咖啡馆",
    "餐厅",
    "商店",
    "公园",
    "海边",
    "日落",
    "森林",
    "城市",
    "夜景",
    "山水",
    "教室",
    "客厅",
    "派对",
    "节日",
    "赛博朋克",
    "未来感",
    "科幻",
)

COMPLEX_HINTS = (
    "和",
    "以及",
    "里面",
    "中间有",
    "背景",
    "前景",
    "旁边",
    "窗边",
    "桌上",
    "坐在",
    "站在",
    "躺在",
    "拿着",
    "戴",
    "穿",
    "带着",
    "包含",
)

COUNT_PREFIXES = (
    "一个",
    "一只",
    "一条",
    "一辆",
    "一台",
    "一张",
    "一棵",
    "一朵",
    "一颗",
    "一盏",
    "一把",
    "一座",
    "一片",
    "个",
    "只",
    "条",
    "辆",
    "台",
    "张",
    "棵",
    "朵",
    "颗",
    "盏",
    "把",
    "座",
    "片",
)

COLOR_ALIASES = (
    ("红色", "red"),
    ("红", "red"),
    ("蓝色", "blue"),
    ("蓝", "blue"),
    ("绿色", "green"),
    ("绿", "green"),
    ("黄色", "yellow"),
    ("黄", "yellow"),
    ("黑色", "black"),
    ("黑", "black"),
    ("白色", "white"),
    ("白", "white"),
    ("橙色", "orange"),
    ("橙", "orange"),
    ("紫色", "purple"),
    ("紫", "purple"),
    ("粉色", "pink"),
    ("粉", "pink"),
)


@dataclass(frozen=True)
class SimpleObjectRequest:
    args: CreateObjectArgs
    source: str
    label: str
    asset: Optional[SVGAsset] = None


def normalize_spoken_text(text: str) -> str:
    return re.sub(r"[\s，。！？、,.!?:：]+", "", str(text or "")).lower()


def term_matches(candidate: str, text: str) -> bool:
    term = normalize_spoken_text(candidate)
    normalized = normalize_spoken_text(text)
    if not term or not normalized:
        return False
    if term == normalized:
        return True
    return len(term) >= 2 and term in normalized


def strip_prefixes(text: str, prefixes: tuple[str, ...]) -> str:
    normalized = text
    changed = True
    while changed:
        changed = False
        for prefix in sorted(prefixes, key=len, reverse=True):
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):]
                changed = True
                break
    return normalized


def has_draw_prefix(text: str) -> bool:
    without_request = strip_prefixes(normalize_spoken_text(text), REQUEST_PREFIXES)
    return any(without_request.startswith(prefix) for prefix in DRAW_PREFIXES)


def is_simple_object_text(text: str) -> bool:
    normalized = strip_prefixes(normalize_spoken_text(text), REQUEST_PREFIXES)
    if not normalized:
        return False
    if any(normalized.startswith(prefix) for prefix in BLOCKED_PREFIXES):
        return False
    if not any(normalized.startswith(prefix) for prefix in DRAW_PREFIXES):
        return False
    if any(hint in normalized for hint in SCENE_HINTS):
        return False
    if any(hint in normalized for hint in COMPLEX_HINTS):
        return False
    return True


def extract_object_phrase(text: str) -> str:
    normalized = strip_prefixes(normalize_spoken_text(text), REQUEST_PREFIXES)
    normalized = strip_prefixes(normalized, DRAW_PREFIXES)
    normalized = strip_prefixes(normalized, COUNT_PREFIXES)

    for phrase in (
        "在左上角",
        "在右上角",
        "在左下角",
        "在右下角",
        "在左边",
        "在右边",
        "在上面",
        "在下面",
        "在中间",
        "左上角",
        "右上角",
        "左下角",
        "右下角",
        "左边",
        "右边",
        "上面",
        "下面",
        "中间",
        "中央",
    ):
        normalized = normalized.replace(phrase, "")

    for phrase in ("大一点", "大一些", "小一点", "小一些", "很大", "很小", "大型", "小型", "巨大"):
        normalized = normalized.replace(phrase, "")

    for color, _ in COLOR_ALIASES:
        normalized = normalized.replace(color, "")

    return strip_prefixes(normalized, COUNT_PREFIXES)


def position_from_text(text: str) -> PositionSpec:
    normalized = normalize_spoken_text(text)
    anchor = "center"
    if "左上角" in normalized:
        anchor = "top_left"
    elif "右上角" in normalized:
        anchor = "top_right"
    elif "左下角" in normalized:
        anchor = "bottom_left"
    elif "右下角" in normalized:
        anchor = "bottom_right"
    elif "左边" in normalized or "左侧" in normalized:
        anchor = "left"
    elif "右边" in normalized or "右侧" in normalized:
        anchor = "right"
    elif "上面" in normalized or "顶部" in normalized:
        anchor = "top"
    elif "下面" in normalized or "底部" in normalized:
        anchor = "bottom"
    elif "中间" in normalized or "中央" in normalized:
        anchor = "center"
    return PositionSpec(anchor=anchor)


def size_from_text(text: str) -> SizeSpec:
    normalized = normalize_spoken_text(text)
    if any(word in normalized for word in ("巨大", "超大", "很大")):
        return SizeSpec(preset="huge")
    if any(word in normalized for word in ("大一点", "大一些", "大型", "大号")):
        return SizeSpec(preset="large")
    if any(word in normalized for word in ("很小", "小一点", "小一些", "小型", "小号")):
        return SizeSpec(preset="small")
    return SizeSpec(preset="medium")


def style_from_text(text: str) -> StyleSpec:
    normalized = normalize_spoken_text(text)
    for color, value in COLOR_ALIASES:
        if color in normalized:
            return StyleSpec(fill=value, stroke=value)
    return StyleSpec()


def resolve_template_kind(text: str) -> Optional[str]:
    normalized = normalize_spoken_text(text)
    phrase = extract_object_phrase(text)
    candidates = [phrase, normalized]

    for raw in sorted(KIND_ALIASES, key=len, reverse=True):
        kind = KIND_ALIASES[raw]
        if kind in TEMPLATE_KINDS and any(term_matches(raw, candidate) for candidate in candidates):
            return kind

    for kind, profile in BASE_KIND_PROFILES.items():
        if kind not in TEMPLATE_KINDS:
            continue
        aliases = [kind, *(profile.get("aliases") or [])]
        for alias in sorted((str(item) for item in aliases), key=len, reverse=True):
            if any(term_matches(alias, candidate) for candidate in candidates):
                return kind

    if phrase in TEMPLATE_KINDS:
        return phrase
    return None


def build_simple_object_request(
    text: str,
    asset_resolver: Optional[AssetResolver] = None,
) -> Optional[SimpleObjectRequest]:
    if not is_simple_object_text(text):
        return None

    resolver = asset_resolver or AssetResolver()
    phrase = extract_object_phrase(text)
    mapped_kind = KIND_ALIASES.get(normalize_spoken_text(phrase))
    asset = resolver.resolve(mapped_kind, phrase) if mapped_kind else None
    asset = asset or resolver.resolve_text(phrase) or resolver.resolve_text(text)
    template_kind = resolve_template_kind(text)

    if asset:
        return SimpleObjectRequest(
            args=CreateObjectArgs(
                kind=asset.kind,
                render_strategy="svg",
                position=position_from_text(text),
                size=size_from_text(text),
                style=style_from_text(text),
                description=phrase or asset.label,
            ),
            source="svg_asset",
            label=asset.label,
            asset=asset,
        )

    if template_kind:
        return SimpleObjectRequest(
            args=CreateObjectArgs(
                kind=template_kind,
                render_strategy="template",
                position=position_from_text(text),
                size=size_from_text(text),
                style=style_from_text(text),
                description=phrase or template_kind,
            ),
            source="template_object",
            label=phrase or template_kind,
        )

    return None
