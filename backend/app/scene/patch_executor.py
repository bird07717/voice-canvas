from itertools import count
from typing import Any, Dict, Iterable, List, Optional
from uuid import uuid4

from app.assets.resolver import AssetResolver, SVGAsset
from app.drawing.executor import DrawingExecutor
from app.drawing.schemas import CreateObjectArgs, PositionSpec, SizeSpec, StyleSpec
from app.scene.patch import ScenePatchOperation, ScenePatchPlan


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
    "river",
    "palm_tree",
    "bench",
    "balloon",
    "gift",
    "cake",
    "building",
    "sailboat",
    "fence",
    "desk",
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


class ScenePatchExecutor:
    def __init__(
        self,
        scene_type: str,
        scene_title: str,
        template_commands: List[Dict[str, Any]],
        canvas_context: Optional[Dict[str, Any]] = None,
        asset_resolver: Optional[AssetResolver] = None,
    ):
        self.scene_type = scene_type
        self.scene_title = scene_title
        self.template_commands = template_commands
        self.canvas_context = canvas_context or {}
        self.asset_resolver = asset_resolver or AssetResolver()
        self.drawing_executor = DrawingExecutor(canvas_context)
        self._id_counter = count(1)
        self._id_prefix = f"patch_{uuid4().hex[:8]}"

    def execute(self, plan: ScenePatchPlan) -> List[Dict[str, Any]]:
        commands: List[Dict[str, Any]] = []
        for operation in plan.operations:
            if operation.action == "add":
                commands.extend(self._add(operation))
            elif operation.action == "modify":
                command = self._modify(operation)
                if command:
                    commands.append(command)
            elif operation.action == "delete":
                command = self._delete(operation)
                if command:
                    commands.append(command)
        return commands

    def _add(self, operation: ScenePatchOperation) -> List[Dict[str, Any]]:
        kind = (operation.kind or "object").strip().lower()
        render_strategy = operation.render_strategy or self._default_strategy(kind)

        if render_strategy == "svg":
            asset = self.asset_resolver.resolve(kind, operation.description or operation.label)
            if asset:
                return [self._create_svg_asset(operation, asset)]
            render_strategy = self._default_strategy(kind)

        args = CreateObjectArgs(
            kind=kind if kind else "rect",
            render_strategy=render_strategy,
            position=PositionSpec(
                anchor=operation.position.anchor,
                x=operation.position.x,
                y=operation.position.y,
            ),
            size=SizeSpec(
                preset=operation.size.preset,
                width=operation.size.width,
                height=operation.size.height,
            ),
            style=StyleSpec(
                fill=operation.style.fill,
                stroke=operation.style.stroke,
                opacity=operation.style.opacity,
                text=operation.style.text,
            ),
            description=operation.description or operation.label,
        )
        created = self.drawing_executor._create_object(args)
        for command in created:
            self._rewrite_command_ids(command)
        for command in created:
            self._attach_scene_metadata(command, operation, kind)
        return created

    def _create_svg_asset(self, operation: ScenePatchOperation, asset: SVGAsset) -> Dict[str, Any]:
        x, y = self._position_xy(operation)
        width, height = self._size_wh(operation)
        kind = asset.kind or (operation.kind or "svg_asset").strip().lower()
        params = {
            "x": x - width / 2,
            "y": y - height / 2,
            "width": width,
            "height": height,
            "imageUrl": asset.public_url,
            "kind": kind,
            "kindLabel": operation.label or asset.label or operation.kind or "素材",
            "assetId": asset.asset_id,
            "assetCategory": asset.category,
            "semanticAliases": asset.aliases,
            "sceneType": self.scene_type,
            "sceneTitle": self.scene_title,
            "sceneStyle": "cartoon_flat",
            "sceneRole": "foreground",
            "assetSource": "svg",
            "opacity": operation.style.opacity,
        }
        return {
            "action": "create",
            "type": "image",
            "id": self._next_patch_id(),
            "params": {key: value for key, value in params.items() if value is not None},
        }

    def _modify(self, operation: ScenePatchOperation) -> Optional[Dict[str, Any]]:
        target_id = self._resolve_target(operation)
        if not target_id:
            return None
        params = dict(operation.changes or {})
        if operation.style.fill:
            params["fill"] = operation.style.fill
        if operation.style.stroke:
            params["stroke"] = operation.style.stroke
        if operation.style.opacity is not None:
            params["opacity"] = operation.style.opacity
        if operation.style.text:
            params["text"] = operation.style.text
        return {"action": "modify", "target": target_id, "params": params} if params else None

    def _delete(self, operation: ScenePatchOperation) -> Optional[Dict[str, Any]]:
        target_id = self._resolve_target(operation)
        return {"action": "delete", "target": target_id} if target_id else None

    def _resolve_target(self, operation: ScenePatchOperation) -> Optional[str]:
        if not operation.target:
            return None

        ref = operation.target.ref
        value = operation.target.value.strip().lower()
        for command in reversed(self.template_commands):
            params = command.get("params") or {}
            candidates = self._target_candidates(command, params)
            if ref == "id" and str(command.get("id", "")).lower() == value:
                return command.get("id")
            if ref == "scene_role" and str(params.get("sceneRole", "")).lower() == value:
                return command.get("id")
            if ref in {"kind", "label"} and value in candidates:
                return command.get("id")
        return None

    def _target_candidates(self, command: Dict[str, Any], params: Dict[str, Any]) -> set[str]:
        values: Iterable[Any] = (
            command.get("type"),
            params.get("kind"),
            params.get("kindLabel"),
            params.get("sceneRole"),
            params.get("text"),
        )
        return {str(value).strip().lower() for value in values if value}

    def _attach_scene_metadata(
        self,
        command: Dict[str, Any],
        operation: ScenePatchOperation,
        kind: str,
    ) -> None:
        params = command.setdefault("params", {})
        params.update(
            {
                "kind": kind,
                "kindLabel": operation.label or operation.kind or kind,
                "sceneType": self.scene_type,
                "sceneTitle": self.scene_title,
                "sceneStyle": "cartoon_flat",
                "sceneRole": "foreground",
                "scenePatch": True,
            }
        )

    def _default_strategy(self, kind: str) -> str:
        if kind in BASIC_KINDS:
            return "basic"
        if kind in TEMPLATE_KINDS:
            return "template"
        return "basic"

    def _position_xy(self, operation: ScenePatchOperation) -> tuple[float, float]:
        if operation.position.anchor == "custom" and operation.position.x is not None and operation.position.y is not None:
            return operation.position.x, operation.position.y
        return {
            "center": (400, 300),
            "top": (400, 120),
            "bottom": (400, 500),
            "left": (150, 320),
            "right": (650, 320),
            "top_left": (150, 120),
            "top_right": (650, 120),
            "bottom_left": (150, 500),
            "bottom_right": (650, 500),
        }.get(operation.position.anchor, (400, 300))

    def _size_wh(self, operation: ScenePatchOperation) -> tuple[float, float]:
        presets = {
            "tiny": (45, 45),
            "small": (80, 80),
            "medium": (130, 110),
            "large": (200, 170),
            "huge": (300, 240),
        }
        width, height = presets.get(operation.size.preset, presets["medium"])
        return operation.size.width or width, operation.size.height or height

    def _next_patch_id(self) -> str:
        return f"{self._id_prefix}_{next(self._id_counter)}"

    def _rewrite_command_ids(self, command: Dict[str, Any]) -> None:
        command["id"] = self._next_patch_id()
        for child in command.get("children") or []:
            self._rewrite_child_ids(child)

    def _rewrite_child_ids(self, child: Dict[str, Any]) -> None:
        child["id"] = self._next_patch_id()
        for nested in child.get("children") or []:
            self._rewrite_child_ids(nested)
