from copy import deepcopy
from typing import Any, Dict, List, Optional

from app.scene.schemas import SceneBackground, SceneObject, ScenePlan


SCENE_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "beach_sunset": {
        "scene_type": "beach_sunset",
        "default_objects": [
            {"kind": "circle", "role": "background", "position": {"anchor": "custom", "x": 610, "y": 142, "layer": 1}, "size": {"preset": "huge", "width": 150, "height": 150}, "style": {"fill": "#F97316", "stroke": "#FDBA74"}, "label": "落日"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 170, "y": 92, "layer": 2}, "size": {"preset": "small", "width": 130, "height": 70}, "style": {"fill": "#FFF7ED", "stroke": "#FED7AA"}, "label": "暖色云"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 425, "y": 105, "layer": 2}, "size": {"preset": "small", "width": 145, "height": 72}, "style": {"fill": "#FFEDD5", "stroke": "#FDBA74"}, "label": "晚霞云"},
            {"kind": "rect", "role": "midground", "position": {"anchor": "custom", "x": 400, "y": 330, "layer": 3}, "size": {"preset": "wide", "width": 800, "height": 150}, "style": {"fill": "#38BDF8", "stroke": "#38BDF8"}, "label": "海面"},
            {"kind": "line", "role": "midground", "position": {"anchor": "custom", "x": 400, "y": 287, "layer": 4}, "size": {"preset": "wide", "width": 680, "height": 20}, "style": {"stroke": "#FDE68A"}, "label": "日落海平线"},
            {"kind": "line", "role": "midground", "position": {"anchor": "custom", "x": 360, "y": 350, "layer": 4}, "size": {"preset": "wide", "width": 520, "height": 18}, "style": {"stroke": "#BAE6FD"}, "label": "海浪"},
            {"kind": "sailboat", "role": "midground", "position": {"anchor": "custom", "x": 520, "y": 342, "layer": 5}, "size": {"preset": "small", "width": 118, "height": 96}, "style": {"fill": "#92400E", "stroke": "#475569"}, "label": "帆船"},
            {"kind": "rect", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 520, "layer": 6}, "size": {"preset": "wide", "width": 800, "height": 160}, "style": {"fill": "#FBCF72", "stroke": "#FBCF72"}, "label": "沙滩"},
            {"kind": "palm_tree", "role": "foreground", "position": {"anchor": "custom", "x": 142, "y": 455, "layer": 7}, "size": {"preset": "large", "width": 190, "height": 220}, "style": {"fill": "#15803D", "stroke": "#8B5A2B"}, "label": "左侧椰子树"},
            {"kind": "palm_tree", "role": "foreground", "position": {"anchor": "custom", "x": 705, "y": 495, "layer": 7}, "size": {"preset": "medium", "width": 135, "height": 160}, "style": {"fill": "#16A34A", "stroke": "#9A3412"}, "label": "远处椰子树"},
            {"kind": "star", "role": "decoration", "position": {"anchor": "custom", "x": 305, "y": 525, "layer": 8}, "size": {"preset": "tiny", "width": 38, "height": 38}, "style": {"fill": "#F59E0B", "stroke": "#F59E0B"}, "label": "海星"},
            {"kind": "circle", "role": "decoration", "position": {"anchor": "custom", "x": 352, "y": 545, "layer": 8}, "size": {"preset": "tiny", "width": 28, "height": 28}, "style": {"fill": "#FDE68A", "stroke": "#D97706"}, "label": "贝壳"},
        ],
        "palette": {"sky": "#FED7AA", "water": "#38BDF8", "sand": "#FBCF72"},
        "layout": {"horizon_y": 445},
    },
    "park": {
        "scene_type": "park",
        "default_objects": [
            {"kind": "rect", "role": "background", "position": {"anchor": "custom", "x": 400, "y": 438, "layer": 1}, "size": {"preset": "wide", "width": 800, "height": 324}, "style": {"fill": "#86EFAC", "stroke": "#86EFAC"}, "label": "大片草地"},
            {"kind": "circle", "role": "background", "position": {"anchor": "custom", "x": 680, "y": 105, "layer": 2}, "size": {"preset": "medium", "width": 92, "height": 92}, "style": {"fill": "#FACC15", "stroke": "#F59E0B"}, "label": "太阳"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 170, "y": 94, "layer": 2}, "size": {"preset": "small", "width": 135, "height": 70}, "style": {"fill": "#FFFFFF", "stroke": "#DDEAFE"}, "label": "云"},
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 425, "y": 116, "layer": 2}, "size": {"preset": "small", "width": 120, "height": 64}, "style": {"fill": "#F8FAFC", "stroke": "#DDEAFE"}, "label": "云"},
            {"kind": "fence", "role": "midground", "position": {"anchor": "custom", "x": 400, "y": 338, "layer": 3}, "size": {"preset": "wide", "width": 580, "height": 82}, "style": {"fill": "#FFFFFF", "stroke": "#CBD5E1"}, "label": "白色栅栏"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 120, "y": 358, "layer": 4}, "size": {"preset": "large", "width": 190, "height": 175}, "style": {"fill": "#16A34A", "stroke": "#166534"}, "label": "左侧大树"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 665, "y": 350, "layer": 4}, "size": {"preset": "large", "width": 180, "height": 170}, "style": {"fill": "#22C55E", "stroke": "#15803D"}, "label": "右侧大树"},
            {"kind": "road", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 505, "layer": 5}, "size": {"preset": "large", "width": 255, "height": 218}, "style": {"fill": "#D6D3D1", "stroke": "#A8A29E"}, "label": "弯曲小路"},
            {"kind": "bench", "role": "foreground", "position": {"anchor": "custom", "x": 390, "y": 420, "layer": 6}, "size": {"preset": "medium", "width": 190, "height": 88}, "style": {"fill": "#B45309", "stroke": "#7C2D12"}, "label": "公园长椅"},
            {"kind": "flower", "role": "foreground", "position": {"anchor": "custom", "x": 250, "y": 496, "layer": 7}, "size": {"preset": "tiny", "width": 56, "height": 56}, "style": {"fill": "#F472B6"}, "label": "粉色花"},
            {"kind": "flower", "role": "foreground", "position": {"anchor": "custom", "x": 560, "y": 505, "layer": 7}, "size": {"preset": "tiny", "width": 56, "height": 56}, "style": {"fill": "#A78BFA"}, "label": "紫色花"},
            {"kind": "flower", "role": "foreground", "position": {"anchor": "custom", "x": 615, "y": 480, "layer": 7}, "size": {"preset": "tiny", "width": 44, "height": 44}, "style": {"fill": "#F97316"}, "label": "橙色花"},
        ],
        "palette": {"sky": "#DBEAFE", "grass": "#86EFAC", "path": "#D6D3D1"},
        "layout": {"horizon_y": 276},
    },
    "birthday_card": {
        "scene_type": "birthday_card",
        "default_objects": [
            {"kind": "rect", "role": "background", "position": {"anchor": "center", "layer": 1}, "size": {"preset": "wide", "width": 650, "height": 455}, "style": {"fill": "#FFF7ED", "stroke": "#FB7185"}, "label": "生日贺卡底纸"},
            {"kind": "rect", "role": "decoration", "position": {"anchor": "custom", "x": 400, "y": 300, "layer": 2}, "size": {"preset": "wide", "width": 595, "height": 395}, "style": {"fill": "#FFFFFF", "stroke": "#FED7AA"}, "label": "内页留白"},
            {"kind": "line", "role": "decoration", "position": {"anchor": "custom", "x": 400, "y": 145, "layer": 3}, "size": {"preset": "wide", "width": 510, "height": 18}, "style": {"stroke": "#FDBA74"}, "label": "彩带"},
            {"kind": "star", "role": "decoration", "position": {"anchor": "custom", "x": 154, "y": 136, "layer": 4}, "size": {"preset": "tiny", "width": 42, "height": 42}, "style": {"fill": "#FACC15", "stroke": "#F59E0B"}, "label": "金色星星"},
            {"kind": "star", "role": "decoration", "position": {"anchor": "custom", "x": 646, "y": 138, "layer": 4}, "size": {"preset": "tiny", "width": 42, "height": 42}, "style": {"fill": "#60A5FA", "stroke": "#3B82F6"}, "label": "蓝色星星"},
            {"kind": "balloon", "role": "decoration", "position": {"anchor": "custom", "x": 205, "y": 258, "layer": 5}, "size": {"preset": "small", "width": 105, "height": 132}, "style": {"fill": "#FB7185", "stroke": "#BE123C"}, "label": "粉色气球"},
            {"kind": "balloon", "role": "decoration", "position": {"anchor": "custom", "x": 595, "y": 252, "layer": 5}, "size": {"preset": "small", "width": 105, "height": 132}, "style": {"fill": "#60A5FA", "stroke": "#2563EB"}, "label": "蓝色气球"},
            {"kind": "text", "role": "label", "position": {"anchor": "custom", "x": 400, "y": 232, "layer": 6}, "size": {"preset": "wide", "width": 420, "height": 80}, "style": {"fill": "#BE123C", "text": "生日快乐"}, "label": "生日快乐"},
            {"kind": "cake", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 372, "layer": 7}, "size": {"preset": "large", "width": 205, "height": 175}, "style": {"fill": "#F9A8D4", "stroke": "#BE185D"}, "label": "生日蛋糕"},
            {"kind": "gift", "role": "foreground", "position": {"anchor": "custom", "x": 252, "y": 442, "layer": 8}, "size": {"preset": "small", "width": 92, "height": 88}, "style": {"fill": "#60A5FA", "stroke": "#F97316"}, "label": "蓝色礼物"},
            {"kind": "gift", "role": "foreground", "position": {"anchor": "custom", "x": 548, "y": 442, "layer": 8}, "size": {"preset": "small", "width": 92, "height": 88}, "style": {"fill": "#A78BFA", "stroke": "#FACC15"}, "label": "紫色礼物"},
            {"kind": "circle", "role": "decoration", "position": {"anchor": "custom", "x": 332, "y": 168, "layer": 9}, "size": {"preset": "tiny", "width": 22, "height": 22}, "style": {"fill": "#34D399", "stroke": "#34D399"}, "label": "彩色纸屑"},
            {"kind": "circle", "role": "decoration", "position": {"anchor": "custom", "x": 472, "y": 166, "layer": 9}, "size": {"preset": "tiny", "width": 22, "height": 22}, "style": {"fill": "#F97316", "stroke": "#F97316"}, "label": "彩色纸屑"},
        ],
        "palette": {"paper": "#FDE2E4", "accent": "#FB7185", "text": "#BE123C"},
        "layout": {"horizon_y": None},
    },
    "city_night": {
        "scene_type": "city_night",
        "default_objects": [
            {"kind": "circle", "role": "background", "position": {"anchor": "custom", "x": 666, "y": 98, "layer": 1}, "size": {"preset": "small", "width": 82, "height": 82}, "style": {"fill": "#FDE68A", "stroke": "#FDE68A"}, "label": "月亮"},
            {"kind": "star", "role": "background", "position": {"anchor": "custom", "x": 128, "y": 92, "layer": 1}, "size": {"preset": "tiny", "width": 32, "height": 32}, "style": {"fill": "#FACC15", "stroke": "#FACC15"}, "label": "星星"},
            {"kind": "star", "role": "background", "position": {"anchor": "custom", "x": 292, "y": 74, "layer": 1}, "size": {"preset": "tiny", "width": 28, "height": 28}, "style": {"fill": "#FDE68A", "stroke": "#FDE68A"}, "label": "星星"},
            {"kind": "star", "role": "background", "position": {"anchor": "custom", "x": 480, "y": 112, "layer": 1}, "size": {"preset": "tiny", "width": 26, "height": 26}, "style": {"fill": "#93C5FD", "stroke": "#93C5FD"}, "label": "蓝色星星"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 95, "y": 352, "layer": 2}, "size": {"preset": "tall", "width": 108, "height": 230}, "style": {"fill": "#334155", "stroke": "#0F172A"}, "label": "左侧高楼"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 228, "y": 318, "layer": 2}, "size": {"preset": "tall", "width": 128, "height": 300}, "style": {"fill": "#1F2937", "stroke": "#0F172A"}, "label": "深色高楼"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 382, "y": 286, "layer": 2}, "size": {"preset": "tall", "width": 148, "height": 350}, "style": {"fill": "#475569", "stroke": "#0F172A"}, "label": "中心高楼"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 548, "y": 322, "layer": 2}, "size": {"preset": "tall", "width": 132, "height": 295}, "style": {"fill": "#334155", "stroke": "#0F172A"}, "label": "右侧高楼"},
            {"kind": "building", "role": "midground", "position": {"anchor": "custom", "x": 700, "y": 362, "layer": 2}, "size": {"preset": "tall", "width": 115, "height": 220}, "style": {"fill": "#1E293B", "stroke": "#0F172A"}, "label": "远处高楼"},
            {"kind": "rect", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 520, "layer": 3}, "size": {"preset": "wide", "width": 800, "height": 160}, "style": {"fill": "#111827", "stroke": "#111827"}, "label": "城市道路"},
            {"kind": "line", "role": "foreground", "position": {"anchor": "custom", "x": 400, "y": 520, "layer": 4}, "size": {"preset": "wide", "width": 600, "height": 20}, "style": {"stroke": "#FDE68A"}, "label": "车道线"},
            {"kind": "car", "role": "foreground", "position": {"anchor": "custom", "x": 540, "y": 520, "layer": 5}, "size": {"preset": "small", "width": 128, "height": 80}, "style": {"fill": "#EF4444", "stroke": "#991B1B"}, "label": "红色汽车"},
        ],
        "palette": {"sky": "#0F172A", "building": "#334155", "moon": "#FDE68A"},
        "layout": {"horizon_y": 440},
    },
    "forest_house": {
        "scene_type": "forest_house",
        "default_objects": [
            {"kind": "cloud", "role": "background", "position": {"anchor": "custom", "x": 210, "y": 86, "layer": 1}, "size": {"preset": "small", "width": 128, "height": 68}, "style": {"fill": "#FFFFFF", "stroke": "#DBEAFE"}, "label": "云"},
            {"kind": "circle", "role": "background", "position": {"anchor": "custom", "x": 642, "y": 112, "layer": 1}, "size": {"preset": "medium", "width": 88, "height": 88}, "style": {"fill": "#FACC15", "stroke": "#F59E0B"}, "label": "太阳"},
            {"kind": "rect", "role": "background", "position": {"anchor": "custom", "x": 400, "y": 458, "layer": 2}, "size": {"preset": "wide", "width": 800, "height": 286}, "style": {"fill": "#A7F3D0", "stroke": "#A7F3D0"}, "label": "林间草地"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 92, "y": 352, "layer": 3}, "size": {"preset": "large", "width": 178, "height": 188}, "style": {"fill": "#15803D", "stroke": "#14532D"}, "label": "左侧树"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 220, "y": 338, "layer": 3}, "size": {"preset": "large", "width": 190, "height": 202}, "style": {"fill": "#166534", "stroke": "#14532D"}, "label": "深色树"},
            {"kind": "tree", "role": "midground", "position": {"anchor": "custom", "x": 650, "y": 340, "layer": 3}, "size": {"preset": "large", "width": 190, "height": 198}, "style": {"fill": "#14532D", "stroke": "#052E16"}, "label": "右侧树"},
            {"kind": "house", "role": "midground", "position": {"anchor": "custom", "x": 410, "y": 338, "layer": 4}, "size": {"preset": "large", "width": 238, "height": 205}, "style": {"fill": "#D9A066", "stroke": "#92400E"}, "label": "森林小屋"},
            {"kind": "fence", "role": "midground", "position": {"anchor": "custom", "x": 410, "y": 430, "layer": 5}, "size": {"preset": "wide", "width": 470, "height": 70}, "style": {"fill": "#F8FAFC", "stroke": "#94A3B8"}, "label": "小屋栅栏"},
            {"kind": "road", "role": "foreground", "position": {"anchor": "custom", "x": 410, "y": 520, "layer": 6}, "size": {"preset": "large", "width": 235, "height": 168}, "style": {"fill": "#B7791F", "stroke": "#854D0E"}, "label": "通往小屋的路"},
            {"kind": "grass", "role": "foreground", "position": {"anchor": "custom", "x": 150, "y": 520, "layer": 7}, "size": {"preset": "medium", "width": 145, "height": 82}, "style": {"fill": "#22C55E"}, "label": "左侧草丛"},
            {"kind": "grass", "role": "foreground", "position": {"anchor": "custom", "x": 642, "y": 520, "layer": 7}, "size": {"preset": "medium", "width": 145, "height": 82}, "style": {"fill": "#16A34A"}, "label": "右侧草丛"},
            {"kind": "flower", "role": "foreground", "position": {"anchor": "custom", "x": 545, "y": 492, "layer": 8}, "size": {"preset": "tiny", "width": 44, "height": 44}, "style": {"fill": "#F472B6"}, "label": "门前小花"},
        ],
        "palette": {"sky": "#BAE6FD", "grass": "#A7F3D0", "house": "#D9A066"},
        "layout": {"horizon_y": 316},
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
