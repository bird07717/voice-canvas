from copy import deepcopy
from typing import Any, Dict, List, Optional

from app.scene.schemas import SceneBackground, SceneObject, ScenePlan


SCENE_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "beach_sunset": {
        "scene_type": "beach_sunset",
        "default_objects": [
            {"kind": "sun", "role": "background", "position": {"anchor": "custom", "x": 650, "y": 125, "layer": 1}, "size": {"preset": "large"}, "style": {"fill": "#F97316"}, "label": "太阳"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 180, "y": 100, "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FFFFFF"}, "label": "云"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 470, "y": 85, "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FFF7ED"}, "label": "晚霞云"},
            {"kind": "river", "role": "midground", "position": {"anchor": "custom", "x": 400, "y": 335, "layer": 2}, "size": {"preset": "wide", "width": 620, "height": 120}, "style": {"fill": "#38BDF8", "stroke": "#0284C7"}, "label": "海面"},
            {"kind": "sailboat", "role": "midground", "position": {"anchor": "custom", "x": 505, "y": 330, "layer": 3}, "size": {"preset": "small", "width": 105, "height": 90}, "style": {"fill": "#92400E"}, "label": "帆船"},
            {"kind": "rect", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 520, "layer": 4}, "size": {"preset": "wide", "width": 620, "height": 120}, "style": {"fill": "#F6C453", "stroke": "#F6C453"}, "label": "沙滩"},
            {"kind": "palm_tree", "role": "foreground", "position": {"anchor": "custom", "x": 150, "y": 455, "layer": 5}, "size": {"preset": "large", "width": 190, "height": 210}, "style": {"fill": "#16A34A", "stroke": "#8B5A2B"}, "label": "椰子树"},
            {"kind": "flower", "role": "foreground", "position": {"anchor": "custom", "x": 295, "y": 525, "layer": 6}, "size": {"preset": "tiny"}, "style": {"fill": "#FB7185"}, "label": "沙滩小花"},
        ],
        "palette": {"sky": "#FDE68A", "water": "#38BDF8", "sand": "#F6C453"},
        "layout": {"horizon_y": 330},
    },
    "park": {
        "scene_type": "park",
        "default_objects": [
            {"kind": "rect", "role": "background", "position": {"anchor": "custom", "x": 400, "y": 470, "layer": 0}, "size": {"preset": "wide", "width": 680, "height": 260}, "style": {"fill": "#86EFAC", "stroke": "#86EFAC"}, "label": "草地"},
            {"kind": "sun", "role": "background", "position": {"anchor": "custom", "x": 675, "y": 110, "layer": 1}, "size": {"preset": "medium"}, "style": {"fill": "#FACC15"}, "label": "太阳"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 165, "y": 95, "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FFFFFF"}, "label": "云"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 430, "y": 115, "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FFFFFF"}, "label": "云"},
            {"kind": "fence", "role": "midground", "position": {"anchor": "custom", "x": 400, "y": 350, "layer": 2}, "size": {"preset": "wide", "width": 520, "height": 80}, "style": {"fill": "#F8FAFC", "stroke": "#94A3B8"}, "label": "栅栏"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 155, "y": 360, "layer": 3}, "size": {"preset": "large"}, "style": {"fill": "#22C55E"}, "label": "左边的树"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 650, "y": 350, "layer": 3}, "size": {"preset": "large"}, "style": {"fill": "#16A34A"}, "label": "右边的树"},
            {"kind": "road", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 500, "layer": 4}, "size": {"preset": "large", "width": 230, "height": 210}, "style": {"fill": "#A3A3A3"}, "label": "小路"},
            {"kind": "bench", "role": "foreground", "position": {"anchor": "custom", "x": 405, "y": 425, "layer": 5}, "size": {"preset": "medium", "width": 170, "height": 85}, "style": {"fill": "#B45309", "stroke": "#7C2D12"}, "label": "长椅"},
            {"kind": "flower", "role": "foreground", "position": {"anchor": "custom", "x": 260, "y": 500, "layer": 6}, "size": {"preset": "tiny"}, "style": {"fill": "#F472B6"}, "label": "花"},
            {"kind": "flower", "role": "foreground", "position": {"anchor": "custom", "x": 555, "y": 505, "layer": 6}, "size": {"preset": "tiny"}, "style": {"fill": "#A78BFA"}, "label": "花"},
        ],
        "palette": {"grass": "#86EFAC", "tree": "#22C55E", "path": "#A3A3A3"},
        "layout": {"horizon_y": 350},
    },
    "birthday_card": {
        "scene_type": "birthday_card",
        "default_objects": [
            {"kind": "rect", "role": "background", "position": {"anchor": "center", "layer": 0}, "size": {"preset": "wide", "height": 430}, "style": {"fill": "#FFF7ED", "stroke": "#FB7185"}, "label": "贺卡背景"},
            {"kind": "text", "role": "label", "position": {"anchor": "custom", "x": 400, "y": 220, "layer": 5}, "size": {"preset": "wide", "height": 80}, "style": {"fill": "#BE123C", "text": "生日快乐"}, "label": "生日快乐"},
            {"kind": "cake", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 360, "layer": 4}, "size": {"preset": "medium", "width": 170, "height": 150}, "style": {"fill": "#F9A8D4"}, "label": "蛋糕"},
            {"kind": "balloon", "role": "decoration", "position": {"anchor": "custom", "x": 215, "y": 225, "layer": 3}, "size": {"preset": "small"}, "style": {"fill": "#FB7185"}, "label": "气球"},
            {"kind": "balloon", "role": "decoration", "position": {"anchor": "custom", "x": 585, "y": 225, "layer": 3}, "size": {"preset": "small"}, "style": {"fill": "#60A5FA"}, "label": "气球"},
            {"kind": "gift", "role": "decoration", "position": {"anchor": "custom", "x": 255, "y": 420, "layer": 4}, "size": {"preset": "small"}, "style": {"fill": "#60A5FA", "stroke": "#F97316"}, "label": "礼物"},
            {"kind": "gift", "role": "decoration", "position": {"anchor": "custom", "x": 545, "y": 420, "layer": 4}, "size": {"preset": "small"}, "style": {"fill": "#A78BFA", "stroke": "#FACC15"}, "label": "礼物"},
            {"kind": "star", "role": "decoration", "position": {"anchor": "custom", "x": 150, "y": 125, "layer": 2}, "size": {"preset": "tiny"}, "style": {"fill": "#FACC15"}, "label": "星星"},
            {"kind": "star", "role": "decoration", "position": {"anchor": "custom", "x": 650, "y": 125, "layer": 2}, "size": {"preset": "tiny"}, "style": {"fill": "#60A5FA"}, "label": "星星"},
        ],
        "palette": {"paper": "#FFF7ED", "accent": "#FB7185", "text": "#BE123C"},
        "layout": {"horizon_y": None},
    },
    "city_night": {
        "scene_type": "city_night",
        "default_objects": [
            {"kind": "circle", "role": "background", "position": {"anchor": "custom", "x": 680, "y": 105, "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FDE68A", "stroke": "#FDE68A"}, "label": "月亮"},
            {"kind": "star", "role": "background", "position": {"anchor": "custom", "x": 140, "y": 95, "layer": 1}, "size": {"preset": "tiny"}, "style": {"fill": "#FACC15"}, "label": "星星"},
            {"kind": "star", "role": "background", "position": {"anchor": "custom", "x": 330, "y": 75, "layer": 1}, "size": {"preset": "tiny"}, "style": {"fill": "#FACC15"}, "label": "星星"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 155, "y": 310, "layer": 2}, "size": {"preset": "tall", "width": 130, "height": 260}, "style": {"fill": "#334155"}, "label": "高楼"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 330, "y": 280, "layer": 2}, "size": {"preset": "tall", "width": 145, "height": 320}, "style": {"fill": "#1F2937"}, "label": "高楼"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 520, "y": 300, "layer": 2}, "size": {"preset": "tall", "width": 140, "height": 280}, "style": {"fill": "#475569"}, "label": "高楼"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 665, "y": 330, "layer": 2}, "size": {"preset": "tall", "width": 115, "height": 220}, "style": {"fill": "#334155"}, "label": "高楼"},
            {"kind": "road", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 505, "layer": 3}, "size": {"preset": "wide", "width": 620, "height": 170}, "style": {"fill": "#111827"}, "label": "道路"},
            {"kind": "car", "role": "foreground", "position": {"anchor": "custom", "x": 520, "y": 520, "layer": 4}, "size": {"preset": "small", "width": 120, "height": 80}, "style": {"fill": "#EF4444"}, "label": "汽车"},
        ],
        "palette": {"sky": "#111827", "building": "#334155", "moon": "#FDE68A"},
        "layout": {"horizon_y": 380},
    },
    "forest_house": {
        "scene_type": "forest_house",
        "default_objects": [
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 230, "y": 90, "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FFFFFF"}, "label": "云"},
            {"kind": "sun", "role": "background", "position": {"anchor": "custom", "x": 640, "y": 115, "layer": 1}, "size": {"preset": "medium"}, "style": {"fill": "#FACC15"}, "label": "太阳"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 125, "y": 350, "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#15803D"}, "label": "树"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 245, "y": 330, "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#166534"}, "label": "树"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 650, "y": 345, "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#14532D"}, "label": "树"},
            {"kind": "house", "role": "midground", "position": {"anchor": "custom", "x": 420, "y": 345, "layer": 3}, "size": {"preset": "large", "width": 220, "height": 190}, "style": {"fill": "#D9A066"}, "label": "小屋"},
            {"kind": "fence", "role": "midground", "position": {"anchor": "custom", "x": 420, "y": 430, "layer": 4}, "size": {"preset": "wide", "width": 400, "height": 70}, "style": {"fill": "#F8FAFC", "stroke": "#94A3B8"}, "label": "栅栏"},
            {"kind": "road", "role": "foreground", "position": {"anchor": "custom", "x": 410, "y": 515, "layer": 5}, "size": {"preset": "large", "width": 210, "height": 160}, "style": {"fill": "#A16207"}, "label": "小路"},
            {"kind": "grass", "role": "foreground", "position": {"anchor": "custom", "x": 145, "y": 510, "layer": 6}, "size": {"preset": "medium"}, "style": {"fill": "#22C55E"}, "label": "草地"},
            {"kind": "grass", "role": "foreground", "position": {"anchor": "custom", "x": 650, "y": 510, "layer": 6}, "size": {"preset": "medium"}, "style": {"fill": "#16A34A"}, "label": "草地"},
        ],
        "palette": {"sky": "#BAE6FD", "forest": "#166534", "house": "#D9A066"},
        "layout": {"horizon_y": 360},
    },
    "mountain_landscape": {
        "scene_type": "mountain_landscape",
        "default_objects": [
            {"kind": "sun", "role": "background", "position": {"anchor": "top_left", "layer": 1}, "size": {"preset": "medium"}, "style": {"fill": "#FACC15"}, "label": "太阳"},
            {"kind": "mountain", "role": "midground", "position": {"anchor": "left", "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#94A3B8"}, "label": "山"},
            {"kind": "mountain", "role": "midground", "position": {"anchor": "right", "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#64748B"}, "label": "山"},
            {"kind": "river", "role": "foreground", "position": {"anchor": "bottom", "layer": 3}, "size": {"preset": "wide"}, "style": {"stroke": "#38BDF8"}, "label": "河流"},
            {"kind": "tree", "role": "foreground", "position": {"anchor": "bottom_left", "layer": 4}, "size": {"preset": "small"}, "style": {"fill": "#16A34A"}, "label": "树"},
            {"kind": "tree", "role": "foreground", "position": {"anchor": "bottom_right", "layer": 4}, "size": {"preset": "small"}, "style": {"fill": "#22C55E"}, "label": "树"},
        ],
        "palette": {"sky": "#DBEAFE", "mountain": "#94A3B8", "water": "#38BDF8"},
        "layout": {"horizon_y": 340},
    },
    "simple_classroom": {
        "scene_type": "simple_classroom",
        "default_objects": [
            {"kind": "rect", "role": "background", "position": {"anchor": "top", "layer": 1}, "size": {"preset": "wide", "height": 150}, "style": {"fill": "#14532D", "stroke": "#052E16"}, "label": "黑板"},
            {"kind": "text", "role": "label", "position": {"anchor": "top", "layer": 2}, "size": {"preset": "wide", "height": 60}, "style": {"fill": "#FFFFFF", "text": "欢迎上课"}, "label": "黑板文字"},
            {"kind": "rect", "role": "midground", "position": {"anchor": "bottom_left", "layer": 3}, "size": {"preset": "small"}, "style": {"fill": "#D97706"}, "label": "课桌"},
            {"kind": "rect", "role": "midground", "position": {"anchor": "bottom", "layer": 3}, "size": {"preset": "small"}, "style": {"fill": "#D97706"}, "label": "课桌"},
            {"kind": "rect", "role": "midground", "position": {"anchor": "bottom_right", "layer": 3}, "size": {"preset": "small"}, "style": {"fill": "#D97706"}, "label": "课桌"},
            {"kind": "person", "role": "foreground", "position": {"anchor": "right", "layer": 4}, "size": {"preset": "medium"}, "style": {"stroke": "#111827"}, "label": "老师"},
        ],
        "palette": {"wall": "#F8FAFC", "board": "#14532D", "desk": "#D97706"},
        "layout": {"horizon_y": None},
    },
}

SCENE_TYPE_ALIASES = {
    "beach": "beach_sunset",
    "sunset": "beach_sunset",
    "seaside_sunset": "beach_sunset",
    "park_scene": "park",
    "birthday": "birthday_card",
    "card": "birthday_card",
    "night_city": "city_night",
    "forest_cabin": "forest_house",
    "cabin": "forest_house",
    "mountain": "mountain_landscape",
    "landscape": "mountain_landscape",
    "classroom": "simple_classroom",
}

SCENE_TEXT_ALIASES = [
    ("beach_sunset", ("海边日落", "海边", "日落", "沙滩")),
    ("park", ("公园", "草地公园")),
    ("birthday_card", ("生日贺卡", "贺卡", "生日卡片")),
    ("city_night", ("城市夜景", "夜晚城市", "夜景城市")),
    ("forest_house", ("森林小屋", "森林里的房子", "小木屋")),
    ("mountain_landscape", ("山水风景", "山水", "山景", "山水画")),
    ("simple_classroom", ("教室", "课堂")),
]

SCENE_TITLES = {
    "beach_sunset": "海边日落",
    "park": "公园",
    "birthday_card": "生日贺卡",
    "city_night": "城市夜景",
    "forest_house": "森林小屋",
    "mountain_landscape": "山水风景",
    "simple_classroom": "教室",
}


def normalize_scene_type(scene_type: str) -> str:
    normalized = str(scene_type or "").strip().lower()
    return SCENE_TYPE_ALIASES.get(normalized, normalized)


def get_scene_template(scene_type: str) -> Optional[Dict[str, Any]]:
    normalized = normalize_scene_type(scene_type)
    template = SCENE_TEMPLATES.get(normalized)
    return deepcopy(template) if template else None


def match_template_scene_type(text: str) -> Optional[str]:
    normalized = "".join(str(text or "").split())
    if not normalized:
        return None

    for scene_type, aliases in SCENE_TEXT_ALIASES:
        if any(alias in normalized for alias in aliases):
            return scene_type
    return None


def build_template_scene_plan(text: str) -> Optional[ScenePlan]:
    scene_type = match_template_scene_type(text)
    if not scene_type:
        return None

    title = SCENE_TITLES.get(scene_type, scene_type)
    plan = ScenePlan(
        scene_type=scene_type,
        title=title,
        style="cartoon_flat",
        objects=[],
        response=f"好的，我用模板快速生成了{title}场景。",
    )
    return apply_scene_template(plan)


def apply_scene_template(plan: ScenePlan) -> ScenePlan:
    template = get_scene_template(plan.scene_type)
    if not template:
        plan.scene_type = normalize_scene_type(plan.scene_type)
        return plan

    template_objects = [
        SceneObject.model_validate(obj)
        for obj in template.get("default_objects", [])
    ]
    extra_objects = _extract_extra_objects(plan.objects, template_objects)
    palette = template.get("palette", {})
    layout = template.get("layout", {})

    plan.scene_type = template["scene_type"]
    plan.background = plan.background or _template_background(palette, layout)
    plan.objects = [*template_objects, *extra_objects]
    if not plan.layout_notes:
        plan.layout_notes = "使用内置场景模板生成基础构图，并合并用户指定对象。"
    return plan


def _extract_extra_objects(
    planned_objects: List[SceneObject],
    template_objects: List[SceneObject],
) -> List[SceneObject]:
    template_signatures = {
        _object_signature(obj)
        for obj in template_objects
    }
    template_kinds = {
        obj.kind.lower()
        for obj in template_objects
    }

    extras: List[SceneObject] = []
    for obj in planned_objects:
        signature = _object_signature(obj)
        kind = obj.kind.lower()
        if kind in {"placeholder", "占位", "占位符"}:
            continue
        if signature in template_signatures:
            continue
        if kind in template_kinds and not obj.description and not obj.id_hint:
            continue
        extras.append(obj)

    return extras


def _object_signature(obj: SceneObject) -> tuple[str, str]:
    return (obj.kind.lower(), (obj.label or "").strip())


def _template_background(
    palette: Dict[str, Any],
    layout: Dict[str, Any],
) -> Optional[SceneBackground]:
    sky = palette.get("sky") or palette.get("paper") or palette.get("wall")
    ground = palette.get("sand") or palette.get("grass")
    horizon_y = layout.get("horizon_y")

    if not sky and not ground and horizon_y is None:
        return None

    return SceneBackground(
        fill=sky,
        horizon_y=horizon_y,
        ground_fill=ground,
    )
