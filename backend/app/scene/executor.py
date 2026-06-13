from typing import Any, Dict, List, Optional, Tuple

from app.drawing.executor import DrawingExecutor
from app.drawing.schemas import CreateObjectArgs, PositionSpec, SizeSpec, StyleSpec
from app.scene.schemas import SceneObject, ScenePlan


CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

SUPPORTED_TEMPLATE_KINDS = {
    "sun",
    "tree",
    "cloud",
    "house",
    "flower",
    "person",
    "car",
    "mountain",
    "grass",
    "road",
    "river",
}

BASIC_KINDS = {
    "circle",
    "round",
    "rect",
    "rectangle",
    "square",
    "line",
    "text",
    "star",
    "polygon",
}

ROLE_ORDER = {
    "background": 0,
    "midground": 1,
    "decoration": 2,
    "label": 3,
    "foreground": 4,
}

ANCHOR_POINTS = {
    "top_left": (130, 110),
    "top_right": (670, 110),
    "bottom_left": (130, 490),
    "bottom_right": (670, 490),
    "center": (400, 300),
    "top": (400, 100),
    "bottom": (400, 500),
    "left": (130, 300),
    "right": (670, 300),
}

SIZE_PRESETS = {
    "tiny": (45, 45),
    "small": (80, 80),
    "medium": (130, 110),
    "large": (200, 170),
    "huge": (300, 240),
    "wide": (520, 140),
    "tall": (120, 240),
}


class SceneExecutor:
    def __init__(self, canvas_context: Optional[Dict[str, Any]] = None):
        self.canvas_context = canvas_context or {}
        self.drawing_executor = DrawingExecutor(canvas_context)

    def execute(self, plan: ScenePlan) -> List[Dict[str, Any]]:
        commands: List[Dict[str, Any]] = []

        if plan.background:
            commands.extend(self._create_background(plan))

        for scene_object in self._sort_objects(plan.objects):
            commands.extend(self._create_scene_object(scene_object, plan))

        return commands

    def _create_background(self, plan: ScenePlan) -> List[Dict[str, Any]]:
        if not plan.background:
            return []

        commands: List[Dict[str, Any]] = []
        fill = plan.background.fill
        ground_fill = plan.background.ground_fill
        horizon_y = plan.background.horizon_y

        if fill:
            commands.append({
                "action": "create",
                "type": "rect",
                "id": self.drawing_executor._next_id(),
                "params": {
                    "x": 0,
                    "y": 0,
                    "width": CANVAS_WIDTH,
                    "height": CANVAS_HEIGHT,
                    "fill": fill,
                    "stroke": fill,
                    "strokeWidth": 0,
                    "kind": "background",
                    "kindLabel": f"{plan.title}背景",
                    "sceneType": plan.scene_type,
                    "sceneTitle": plan.title,
                },
            })

        if ground_fill and horizon_y is not None:
            y = max(0, min(CANVAS_HEIGHT, horizon_y))
            commands.append({
                "action": "create",
                "type": "rect",
                "id": self.drawing_executor._next_id(),
                "params": {
                    "x": 0,
                    "y": y,
                    "width": CANVAS_WIDTH,
                    "height": CANVAS_HEIGHT - y,
                    "fill": ground_fill,
                    "stroke": ground_fill,
                    "strokeWidth": 0,
                    "kind": "ground",
                    "kindLabel": "地面",
                    "sceneType": plan.scene_type,
                    "sceneTitle": plan.title,
                },
            })

        return commands

    def _sort_objects(self, objects: List[SceneObject]) -> List[SceneObject]:
        return sorted(
            objects,
            key=lambda obj: (
                obj.position.layer,
                ROLE_ORDER.get(obj.role, ROLE_ORDER["midground"]),
            ),
        )

    def _create_scene_object(self, scene_object: SceneObject, plan: ScenePlan) -> List[Dict[str, Any]]:
        kind = self._normalize_kind(scene_object.kind)
        render_strategy = "basic" if kind in BASIC_KINDS else "template"
        if kind not in BASIC_KINDS and kind not in SUPPORTED_TEMPLATE_KINDS:
            kind = "text"
            render_strategy = "basic"

        args = CreateObjectArgs(
            kind=kind,
            render_strategy=render_strategy,
            position=self._to_position_spec(scene_object),
            size=self._to_size_spec(scene_object),
            style=self._to_style_spec(scene_object),
            description=scene_object.description or scene_object.label,
        )

        commands = self.drawing_executor._create_object(args)
        for command in commands:
            self._attach_scene_metadata(command, scene_object, plan)
        return commands

    def _to_position_spec(self, scene_object: SceneObject) -> PositionSpec:
        x, y = self._resolve_position(scene_object)
        return PositionSpec(anchor="custom", x=x, y=y)

    def _to_size_spec(self, scene_object: SceneObject) -> SizeSpec:
        width, height = self._resolve_size(scene_object)
        preset = scene_object.size.preset
        if preset not in {"tiny", "small", "medium", "large", "huge"}:
            preset = "medium"

        return SizeSpec(
            preset=preset,
            width=width,
            height=height,
        )

    def _to_style_spec(self, scene_object: SceneObject) -> StyleSpec:
        text = scene_object.style.text or scene_object.label
        if self._normalize_kind(scene_object.kind) != "text":
            text = scene_object.style.text

        return StyleSpec(
            fill=scene_object.style.fill,
            stroke=scene_object.style.stroke,
            opacity=scene_object.style.opacity,
            text=text,
        )

    def _resolve_position(self, scene_object: SceneObject) -> Tuple[float, float]:
        position = scene_object.position
        if position.anchor == "custom" and position.x is not None and position.y is not None:
            return position.x, position.y

        return ANCHOR_POINTS.get(position.anchor, ANCHOR_POINTS["center"])

    def _resolve_size(self, scene_object: SceneObject) -> Tuple[float, float]:
        width, height = SIZE_PRESETS.get(scene_object.size.preset, SIZE_PRESETS["medium"])
        return scene_object.size.width or width, scene_object.size.height or height

    def _attach_scene_metadata(
        self,
        command: Dict[str, Any],
        scene_object: SceneObject,
        plan: ScenePlan,
    ) -> None:
        params = command.setdefault("params", {})
        label = scene_object.label or self._kind_label(scene_object.kind)
        params.update({
            "kind": self._normalize_kind(scene_object.kind),
            "kindLabel": label,
            "sceneType": plan.scene_type,
            "sceneTitle": plan.title,
            "sceneRole": scene_object.role,
        })

        if scene_object.id_hint:
            params["idHint"] = scene_object.id_hint

    def _normalize_kind(self, kind: str) -> str:
        aliases = {
            "rectangle": "rect",
            "square": "rect",
            "圆": "circle",
            "圆形": "circle",
            "矩形": "rect",
            "太阳": "sun",
            "树": "tree",
            "云": "cloud",
            "房子": "house",
            "花": "flower",
            "人": "person",
            "小人": "person",
            "车": "car",
            "山": "mountain",
            "草": "grass",
            "路": "road",
            "河": "river",
            "文字": "text",
            "星星": "star",
        }
        return aliases.get(kind, kind).lower()

    def _kind_label(self, kind: str) -> str:
        labels = {
            "sun": "太阳",
            "tree": "树",
            "cloud": "云",
            "house": "房子",
            "flower": "花",
            "person": "小人",
            "car": "汽车",
            "mountain": "山",
            "grass": "草地",
            "road": "道路",
            "river": "河流",
            "circle": "圆形",
            "rect": "矩形",
            "line": "线条",
            "text": "文字",
            "star": "星星",
        }
        return labels.get(self._normalize_kind(kind), kind)
