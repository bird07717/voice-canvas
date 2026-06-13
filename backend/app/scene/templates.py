from copy import deepcopy
from typing import Any, Dict, List, Optional

from app.scene.schemas import SceneBackground, SceneObject, ScenePlan


SCENE_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "beach_sunset": {
        "scene_type": "beach_sunset",
        "default_objects": [
            {"kind": "sun", "role": "background", "position": {"anchor": "top_right", "layer": 1}, "size": {"preset": "large"}, "style": {"fill": "#F97316"}, "label": "太阳"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "top_left", "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FFFFFF"}, "label": "云"},
            {"kind": "river", "role": "midground", "position": {"anchor": "center", "layer": 2}, "size": {"preset": "wide"}, "style": {"fill": "#38BDF8", "stroke": "#0284C7"}, "label": "海面"},
            {"kind": "rect", "role": "foreground", "position": {"anchor": "bottom", "layer": 3}, "size": {"preset": "wide", "height": 120}, "style": {"fill": "#F6C453", "stroke": "#F6C453"}, "label": "沙滩"},
            {"kind": "tree", "role": "foreground", "position": {"anchor": "bottom_left", "layer": 4}, "size": {"preset": "large"}, "style": {"fill": "#16A34A"}, "label": "椰子树"},
        ],
        "palette": {"sky": "#FDE68A", "water": "#38BDF8", "sand": "#F6C453"},
        "layout": {"horizon_y": 330},
    },
    "park": {
        "scene_type": "park",
        "default_objects": [
            {"kind": "rect", "role": "background", "position": {"anchor": "bottom", "layer": 0}, "size": {"preset": "wide", "height": 260}, "style": {"fill": "#86EFAC", "stroke": "#86EFAC"}, "label": "草地"},
            {"kind": "sun", "role": "background", "position": {"anchor": "top_right", "layer": 1}, "size": {"preset": "medium"}, "style": {"fill": "#FACC15"}, "label": "太阳"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "top_left", "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FFFFFF"}, "label": "云"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "left", "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#22C55E"}, "label": "树"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "right", "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#16A34A"}, "label": "树"},
            {"kind": "road", "role": "foreground", "position": {"anchor": "bottom", "layer": 3}, "size": {"preset": "large", "height": 220}, "style": {"fill": "#A3A3A3"}, "label": "小路"},
        ],
        "palette": {"grass": "#86EFAC", "tree": "#22C55E", "path": "#A3A3A3"},
        "layout": {"horizon_y": 350},
    },
    "birthday_card": {
        "scene_type": "birthday_card",
        "default_objects": [
            {"kind": "rect", "role": "background", "position": {"anchor": "center", "layer": 0}, "size": {"preset": "wide", "height": 430}, "style": {"fill": "#FFF7ED", "stroke": "#FB7185"}, "label": "贺卡背景"},
            {"kind": "text", "role": "label", "position": {"anchor": "center", "layer": 3}, "size": {"preset": "wide", "height": 80}, "style": {"fill": "#BE123C", "text": "生日快乐"}, "label": "生日快乐"},
            {"kind": "star", "role": "decoration", "position": {"anchor": "top_left", "layer": 2}, "size": {"preset": "small"}, "style": {"fill": "#FACC15"}, "label": "星星"},
            {"kind": "star", "role": "decoration", "position": {"anchor": "top_right", "layer": 2}, "size": {"preset": "small"}, "style": {"fill": "#60A5FA"}, "label": "星星"},
            {"kind": "flower", "role": "decoration", "position": {"anchor": "bottom_left", "layer": 2}, "size": {"preset": "small"}, "style": {"fill": "#FB7185"}, "label": "花"},
            {"kind": "flower", "role": "decoration", "position": {"anchor": "bottom_right", "layer": 2}, "size": {"preset": "small"}, "style": {"fill": "#A78BFA"}, "label": "花"},
        ],
        "palette": {"paper": "#FFF7ED", "accent": "#FB7185", "text": "#BE123C"},
        "layout": {"horizon_y": None},
    },
    "city_night": {
        "scene_type": "city_night",
        "default_objects": [
            {"kind": "circle", "role": "background", "position": {"anchor": "top_right", "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FDE68A", "stroke": "#FDE68A"}, "label": "月亮"},
            {"kind": "star", "role": "background", "position": {"anchor": "top_left", "layer": 1}, "size": {"preset": "tiny"}, "style": {"fill": "#FACC15"}, "label": "星星"},
            {"kind": "rect", "role": "midground", "position": {"anchor": "left", "layer": 2}, "size": {"preset": "tall"}, "style": {"fill": "#334155"}, "label": "高楼"},
            {"kind": "rect", "role": "midground", "position": {"anchor": "center", "layer": 2}, "size": {"preset": "tall", "height": 300}, "style": {"fill": "#1F2937"}, "label": "高楼"},
            {"kind": "rect", "role": "midground", "position": {"anchor": "right", "layer": 2}, "size": {"preset": "tall"}, "style": {"fill": "#475569"}, "label": "高楼"},
            {"kind": "road", "role": "foreground", "position": {"anchor": "bottom", "layer": 3}, "size": {"preset": "wide", "height": 160}, "style": {"fill": "#111827"}, "label": "道路"},
        ],
        "palette": {"sky": "#111827", "building": "#334155", "moon": "#FDE68A"},
        "layout": {"horizon_y": 380},
    },
    "forest_house": {
        "scene_type": "forest_house",
        "default_objects": [
            {"kind": "house", "role": "midground", "position": {"anchor": "center", "layer": 3}, "size": {"preset": "large"}, "style": {"fill": "#D9A066"}, "label": "小屋"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "left", "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#15803D"}, "label": "树"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "right", "layer": 2}, "size": {"preset": "large"}, "style": {"fill": "#166534"}, "label": "树"},
            {"kind": "grass", "role": "foreground", "position": {"anchor": "bottom_left", "layer": 4}, "size": {"preset": "medium"}, "style": {"fill": "#22C55E"}, "label": "草地"},
            {"kind": "grass", "role": "foreground", "position": {"anchor": "bottom_right", "layer": 4}, "size": {"preset": "medium"}, "style": {"fill": "#16A34A"}, "label": "草地"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "top", "layer": 1}, "size": {"preset": "small"}, "style": {"fill": "#FFFFFF"}, "label": "云"},
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


def normalize_scene_type(scene_type: str) -> str:
    normalized = str(scene_type or "").strip().lower()
    return SCENE_TYPE_ALIASES.get(normalized, normalized)


def get_scene_template(scene_type: str) -> Optional[Dict[str, Any]]:
    normalized = normalize_scene_type(scene_type)
    template = SCENE_TEMPLATES.get(normalized)
    return deepcopy(template) if template else None


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
