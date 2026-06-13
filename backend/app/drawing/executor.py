from itertools import count
from typing import Any, Dict, List, Optional, Tuple

from app.drawing.schemas import (
    AskClarificationArgs,
    ControlCanvasArgs,
    CreateObjectArgs,
    DeleteObjectArgs,
    DrawingPlan,
    EditObjectArgs,
    IgnoreInputArgs,
    PositionSpec,
    SizeSpec,
    StyleSpec,
    TargetSpec
)
from app.drawing.tool_parser import intent_from_tool


CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

TEMPLATE_KINDS = {
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
    "river"
}

BASIC_SHAPES = {
    "circle",
    "round",
    "rectangle",
    "rect",
    "square",
    "line",
    "text",
    "star",
    "polygon"
}

COLOR_ALIASES = {
    "红": "red",
    "红色": "red",
    "蓝": "blue",
    "蓝色": "blue",
    "绿": "green",
    "绿色": "green",
    "黄": "yellow",
    "黄色": "yellow",
    "黑": "black",
    "黑色": "black",
    "白": "white",
    "白色": "white",
    "橙": "orange",
    "橙色": "orange",
    "紫": "purple",
    "紫色": "purple",
    "粉": "pink",
    "粉色": "pink",
    "棕": "#8B4513",
    "棕色": "#8B4513",
    "灰": "#999999",
    "灰色": "#999999"
}


class DrawingExecutor:
    def __init__(self, canvas_context: Optional[Dict[str, Any]] = None):
        self._id_counter = count(1)
        self.canvas_context = canvas_context or {}

    def execute(self, plan: DrawingPlan) -> Dict[str, Any]:
        commands: List[Dict[str, Any]] = []
        intent = "ignore"
        confidence = 0.0
        response = plan.response
        reason = plan.reasoning

        for call in plan.calls:
            intent = intent_from_tool(call.tool)
            confidence = max(confidence, call.confidence)
            args = call.arguments

            if isinstance(args, CreateObjectArgs):
                commands.extend(self._create_object(args))
            elif isinstance(args, EditObjectArgs):
                command = self._edit_object(args)
                if command:
                    commands.append(command)
            elif isinstance(args, DeleteObjectArgs):
                command = self._delete_object(args)
                if command:
                    commands.append(command)
            elif isinstance(args, ControlCanvasArgs):
                command = self._control_canvas(args)
                if command:
                    commands.append(command)
            elif isinstance(args, AskClarificationArgs):
                response = response or args.question
                reason = reason or ", ".join(args.missing)
            elif isinstance(args, IgnoreInputArgs):
                response = ""
                reason = reason or args.reason

        if commands and intent == "ignore":
            intent = "draw"

        return {
            "intent": intent,
            "confidence": confidence,
            "commands": commands,
            "response": response,
            "reason": reason
        }

    def _create_object(self, args: CreateObjectArgs) -> List[Dict[str, Any]]:
        kind = args.kind.lower()
        render_strategy = args.render_strategy

        if render_strategy == "basic" or kind in BASIC_SHAPES:
            return [self._create_basic_shape(kind, args)]

        if render_strategy == "template" or kind in TEMPLATE_KINDS:
            return [self._create_template(kind, args)]

        return [self._create_svg_placeholder(args)]

    def _create_basic_shape(self, kind: str, args: CreateObjectArgs) -> Dict[str, Any]:
        x, y = self._resolve_position(args.position)
        width, height = self._resolve_size(args.size)
        style = self._style(args.style)
        object_id = self._next_id()

        if kind in {"circle", "round"}:
            params = {
                "x": x,
                "y": y,
                "radius": min(width, height) / 2,
                **style
            }
            shape_type = "circle"
        elif kind in {"rectangle", "rect", "square"}:
            params = {
                "x": x - width / 2,
                "y": y - height / 2,
                "width": width,
                "height": height,
                **style
            }
            shape_type = "rect"
        elif kind == "line":
            params = {
                "points": [x - width / 2, y, x + width / 2, y],
                "stroke": style.get("stroke", style.get("fill", "black")),
                "strokeWidth": style.get("strokeWidth", 3)
            }
            shape_type = "line"
        elif kind == "text":
            params = {
                "x": x - width / 2,
                "y": y - height / 2,
                "text": args.style.text or args.description or "文字",
                "fontSize": args.style.font_size or 28,
                "fill": style.get("fill", "black")
            }
            shape_type = "text"
        elif kind == "star":
            params = {
                "x": x,
                "y": y,
                "numPoints": 5,
                "innerRadius": min(width, height) * 0.22,
                "outerRadius": min(width, height) * 0.45,
                **style
            }
            shape_type = "star"
        else:
            params = {
                "points": [
                    x,
                    y - height / 2,
                    x - width / 2,
                    y + height / 2,
                    x + width / 2,
                    y + height / 2
                ],
                "closed": True,
                **style
            }
            shape_type = "polygon"

        return {
            "action": "create",
            "type": shape_type,
            "id": object_id,
            "params": {
                **params,
                "kind": kind
            }
        }

    def _create_template(self, kind: str, args: CreateObjectArgs) -> Dict[str, Any]:
        x, y = self._resolve_position(args.position)
        width, height = self._resolve_size(args.size)
        style = self._style(args.style)
        kind = self._normalize_template_kind(kind)
        children = getattr(self, f"_template_{kind}", self._template_generic)(x, y, width, height, style)

        return {
            "action": "create",
            "type": "group",
            "id": self._next_id(),
            "params": {"kind": kind},
            "children": children
        }

    def _create_svg_placeholder(self, args: CreateObjectArgs) -> Dict[str, Any]:
        x, y = self._resolve_position(args.position)
        width, height = self._resolve_size(args.size)
        text = args.kind or "custom"
        return {
            "action": "create",
            "type": "text",
            "id": self._next_id(),
            "params": {
                "x": x - width / 2,
                "y": y - height / 2,
                "text": f"{text}（SVG待生成）",
                "fontSize": 20,
                "fill": "#555555"
            }
        }

    def _edit_object(self, args: EditObjectArgs) -> Optional[Dict[str, Any]]:
        target = self._resolve_target(args.target)
        if not target:
            return None

        target_object = self._find_object_by_id(target)
        params = self._normalize_changes(args.changes, target_object)
        if not params:
            return None

        return {
            "action": "modify",
            "target": target,
            "params": params
        }

    def _delete_object(self, args: DeleteObjectArgs) -> Optional[Dict[str, Any]]:
        target = self._resolve_target(args.target)
        if not target:
            return None
        return {"action": "delete", "target": target}

    def _control_canvas(self, args: ControlCanvasArgs) -> Optional[Dict[str, Any]]:
        if args.action in {"undo", "redo", "clear"}:
            return {"action": args.action}
        return None

    def _resolve_target(self, target: TargetSpec) -> Optional[str]:
        if target.ref == "id" and target.id:
            return target.id
        if target.ref == "selected":
            return self.canvas_context.get("selectedObjectId") or self.canvas_context.get("lastModifiedObjectId")
        if target.ref == "last":
            return (
                self.canvas_context.get("lastModifiedObjectId")
                or self.canvas_context.get("lastCreatedObjectId")
                or self._last_object_id()
                or "__last__"
            )
        if target.ref == "kind" and target.kind:
            return self._find_object_by_kind(target.kind) or f"__kind__:{target.kind}"
        if target.ref in {"last", "selected"}:
            return "__last__"
        return None

    def _last_object_id(self) -> Optional[str]:
        objects = self.canvas_context.get("objects") or []
        if not objects:
            return None
        return objects[-1].get("id")

    def _find_object_by_kind(self, kind: str) -> Optional[str]:
        normalized_kind = self._normalize_template_kind(kind.lower())
        objects = self.canvas_context.get("objects") or []
        for obj in reversed(objects):
            obj_kind = str(obj.get("kind") or obj.get("type") or "").lower()
            if self._normalize_template_kind(obj_kind) == normalized_kind:
                return obj.get("id")
        return None

    def _resolve_position(self, position: PositionSpec) -> Tuple[float, float]:
        if position.anchor == "custom" and position.x is not None and position.y is not None:
            return position.x, position.y

        anchors = {
            "center": (CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
            "top": (CANVAS_WIDTH / 2, 100),
            "bottom": (CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100),
            "left": (120, CANVAS_HEIGHT / 2),
            "right": (CANVAS_WIDTH - 120, CANVAS_HEIGHT / 2),
            "top_left": (130, 110),
            "top_right": (CANVAS_WIDTH - 130, 110),
            "bottom_left": (130, CANVAS_HEIGHT - 110),
            "bottom_right": (CANVAS_WIDTH - 130, CANVAS_HEIGHT - 110),
            "near_target": (CANVAS_WIDTH / 2 + 120, CANVAS_HEIGHT / 2)
        }
        x, y = anchors.get(position.anchor, anchors["center"])
        return x + position.offset_x, y + position.offset_y

    def _resolve_size(self, size: SizeSpec) -> Tuple[float, float]:
        presets = {
            "tiny": (45, 45),
            "small": (80, 80),
            "medium": (130, 110),
            "large": (200, 170),
            "huge": (300, 240)
        }
        width, height = presets.get(size.preset, presets["medium"])
        if size.width:
            width = size.width
        if size.height:
            height = size.height
        if size.scale:
            width *= size.scale
            height *= size.scale
        return width, height

    def _style(self, style: StyleSpec) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "fill": self._color(style.fill) or "#cccccc",
            "stroke": self._color(style.stroke) or "black",
            "strokeWidth": style.stroke_width or 2
        }
        if style.opacity is not None:
            params["opacity"] = style.opacity
        if style.rotation is not None:
            params["rotation"] = style.rotation
        return params

    def _normalize_changes(
        self,
        changes: Dict[str, Any],
        target_object: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        normalized: Dict[str, Any] = {}
        current = target_object or {}

        for key, value in changes.items():
            if key in {"dx", "dy", "scale_delta"}:
                continue

            normalized_key = {
                "color": "fill",
                "stroke_width": "strokeWidth",
                "font_size": "fontSize"
            }.get(key, key)
            if normalized_key in {"fill", "stroke"} and isinstance(value, str):
                normalized[normalized_key] = self._color(value) or value
            else:
                normalized[normalized_key] = value

        if "dx" in changes:
            normalized["x"] = float(current.get("x") or 0) + float(changes["dx"])
        if "dy" in changes:
            normalized["y"] = float(current.get("y") or 0) + float(changes["dy"])
        if "scale_delta" in changes:
            scale_delta = float(changes["scale_delta"])
            if current.get("radius") is not None:
                normalized["radius"] = float(current["radius"]) * scale_delta
            if current.get("width") is not None:
                normalized["width"] = float(current["width"]) * scale_delta
            if current.get("height") is not None:
                normalized["height"] = float(current["height"]) * scale_delta

        return normalized

    def _find_object_by_id(self, object_id: str) -> Optional[Dict[str, Any]]:
        objects = self.canvas_context.get("objects") or []
        for obj in objects:
            if obj.get("id") == object_id:
                return obj
        return None

    def _color(self, color: Optional[str]) -> Optional[str]:
        if not color:
            return None
        return COLOR_ALIASES.get(color, color)

    def _next_id(self) -> str:
        return f"obj_{next(self._id_counter)}"

    def _normalize_template_kind(self, kind: str) -> str:
        aliases = {
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
            "草地": "grass",
            "路": "road",
            "道路": "road",
            "小路": "road",
            "河": "river",
            "河流": "river",
            "海": "river",
            "海面": "river",
        }
        return aliases.get(kind, kind)

    def _template_generic(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [{
            "id": self._next_id(),
            "type": "rect",
            "params": {
                "x": x - width / 2,
                "y": y - height / 2,
                "width": width,
                "height": height,
                **style
            }
        }]

    def _template_sun(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        radius = min(width, height) * 0.25
        fill = style.get("fill", "yellow")
        children = [{
            "id": self._next_id(),
            "type": "circle",
            "params": {"x": x, "y": y, "radius": radius, "fill": fill, "stroke": "orange", "strokeWidth": 2}
        }]
        for dx, dy in [(0, -1), (1, 0), (0, 1), (-1, 0), (0.7, -0.7), (0.7, 0.7), (-0.7, 0.7), (-0.7, -0.7)]:
            children.append({
                "id": self._next_id(),
                "type": "line",
                "params": {
                    "points": [x + dx * radius * 1.35, y + dy * radius * 1.35, x + dx * radius * 2.0, y + dy * radius * 2.0],
                    "stroke": "orange",
                    "strokeWidth": 3
                }
            })
        return children

    def _template_tree(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            {
                "id": self._next_id(),
                "type": "rect",
                "params": {
                    "x": x - width * 0.08,
                    "y": y,
                    "width": width * 0.16,
                    "height": height * 0.42,
                    "fill": "#8B4513",
                    "stroke": "black",
                    "strokeWidth": 2
                }
            },
            {
                "id": self._next_id(),
                "type": "circle",
                "params": {
                    "x": x,
                    "y": y - height * 0.18,
                    "radius": min(width, height) * 0.34,
                    "fill": style.get("fill", "green"),
                    "stroke": "black",
                    "strokeWidth": 2
                }
            }
        ]

    def _template_cloud(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        fill = style.get("fill", "white")
        return [
            {"id": self._next_id(), "type": "circle", "params": {"x": x - width * 0.22, "y": y, "radius": height * 0.28, "fill": fill, "stroke": "#999999", "strokeWidth": 2}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x, "y": y - height * 0.16, "radius": height * 0.36, "fill": fill, "stroke": "#999999", "strokeWidth": 2}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x + width * 0.24, "y": y, "radius": height * 0.3, "fill": fill, "stroke": "#999999", "strokeWidth": 2}},
            {"id": self._next_id(), "type": "rect", "params": {"x": x - width * 0.35, "y": y, "width": width * 0.7, "height": height * 0.22, "fill": fill, "stroke": "#999999", "strokeWidth": 2}}
        ]

    def _template_house(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            {"id": self._next_id(), "type": "rect", "params": {"x": x - width * 0.35, "y": y - height * 0.05, "width": width * 0.7, "height": height * 0.48, "fill": style.get("fill", "#D9A066"), "stroke": "black", "strokeWidth": 2}},
            {"id": self._next_id(), "type": "polygon", "params": {"points": [x - width * 0.42, y - height * 0.05, x, y - height * 0.48, x + width * 0.42, y - height * 0.05], "fill": "#C0392B", "stroke": "black", "strokeWidth": 2, "closed": True}},
            {"id": self._next_id(), "type": "rect", "params": {"x": x - width * 0.08, "y": y + height * 0.18, "width": width * 0.16, "height": height * 0.25, "fill": "#654321", "stroke": "black", "strokeWidth": 2}}
        ]

    def _template_flower(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        fill = style.get("fill", "pink")
        petal_radius = min(width, height) * 0.12
        return [
            {"id": self._next_id(), "type": "line", "params": {"points": [x, y + height * 0.35, x, y], "stroke": "green", "strokeWidth": 4}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x, "y": y, "radius": petal_radius, "fill": "yellow", "stroke": "black", "strokeWidth": 1}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x - petal_radius, "y": y, "radius": petal_radius, "fill": fill, "stroke": "black", "strokeWidth": 1}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x + petal_radius, "y": y, "radius": petal_radius, "fill": fill, "stroke": "black", "strokeWidth": 1}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x, "y": y - petal_radius, "radius": petal_radius, "fill": fill, "stroke": "black", "strokeWidth": 1}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x, "y": y + petal_radius, "radius": petal_radius, "fill": fill, "stroke": "black", "strokeWidth": 1}}
        ]

    def _template_person(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        stroke = style.get("stroke", "black")
        return [
            {"id": self._next_id(), "type": "circle", "params": {"x": x, "y": y - height * 0.28, "radius": height * 0.12, "fill": "#F5CBA7", "stroke": stroke, "strokeWidth": 2}},
            {"id": self._next_id(), "type": "line", "params": {"points": [x, y - height * 0.15, x, y + height * 0.18], "stroke": stroke, "strokeWidth": 4}},
            {"id": self._next_id(), "type": "line", "params": {"points": [x - width * 0.22, y, x + width * 0.22, y], "stroke": stroke, "strokeWidth": 4}},
            {"id": self._next_id(), "type": "line", "params": {"points": [x, y + height * 0.18, x - width * 0.18, y + height * 0.42], "stroke": stroke, "strokeWidth": 4}},
            {"id": self._next_id(), "type": "line", "params": {"points": [x, y + height * 0.18, x + width * 0.18, y + height * 0.42], "stroke": stroke, "strokeWidth": 4}}
        ]

    def _template_car(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        fill = style.get("fill", "red")
        return [
            {"id": self._next_id(), "type": "rect", "params": {"x": x - width * 0.4, "y": y - height * 0.12, "width": width * 0.8, "height": height * 0.28, "fill": fill, "stroke": "black", "strokeWidth": 2}},
            {"id": self._next_id(), "type": "polygon", "params": {"points": [x - width * 0.22, y - height * 0.12, x - width * 0.08, y - height * 0.34, x + width * 0.18, y - height * 0.34, x + width * 0.32, y - height * 0.12], "fill": fill, "stroke": "black", "strokeWidth": 2, "closed": True}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x - width * 0.25, "y": y + height * 0.18, "radius": height * 0.11, "fill": "black"}},
            {"id": self._next_id(), "type": "circle", "params": {"x": x + width * 0.25, "y": y + height * 0.18, "radius": height * 0.11, "fill": "black"}}
        ]

    def _template_mountain(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            {"id": self._next_id(), "type": "polygon", "params": {"points": [x - width * 0.5, y + height * 0.35, x - width * 0.12, y - height * 0.35, x + width * 0.25, y + height * 0.35], "fill": style.get("fill", "#8E8E8E"), "stroke": "black", "strokeWidth": 2, "closed": True}},
            {"id": self._next_id(), "type": "polygon", "params": {"points": [x - width * 0.05, y + height * 0.35, x + width * 0.22, y - height * 0.25, x + width * 0.5, y + height * 0.35], "fill": "#777777", "stroke": "black", "strokeWidth": 2, "closed": True}}
        ]

    def _template_grass(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        fill = style.get("fill", "green")
        return [
            {"id": self._next_id(), "type": "line", "params": {"points": [x - width * 0.45 + i * width * 0.1, y + height * 0.25, x - width * 0.42 + i * width * 0.1, y - height * 0.2], "stroke": fill, "strokeWidth": 3}}
            for i in range(10)
        ]

    def _template_road(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            {"id": self._next_id(), "type": "polygon", "params": {"points": [x - width * 0.35, y + height * 0.45, x - width * 0.1, y - height * 0.45, x + width * 0.1, y - height * 0.45, x + width * 0.35, y + height * 0.45], "fill": style.get("fill", "#555555"), "stroke": "black", "strokeWidth": 2, "closed": True}},
            {"id": self._next_id(), "type": "line", "params": {"points": [x, y + height * 0.35, x, y - height * 0.35], "stroke": "white", "strokeWidth": 3}}
        ]

    def _template_river(self, x: float, y: float, width: float, height: float, style: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            {"id": self._next_id(), "type": "line", "params": {"points": [x - width * 0.45, y, x - width * 0.2, y - height * 0.18, x, y + height * 0.12, x + width * 0.22, y - height * 0.12, x + width * 0.45, y], "stroke": style.get("stroke", "#3498DB"), "strokeWidth": height * 0.25, "lineCap": "round", "lineJoin": "round"}}
        ]
