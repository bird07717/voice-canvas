import base64
import hashlib
from typing import Any, Dict, List, Optional

from app.assets.resolver import AssetResolver
from app.drawing.executor import DrawingCommandCompiler
from app.drawing.object_request import SimpleObjectMatch, build_simple_object_request_from_match
from app.scene.executor import SceneCommandCompiler
from app.scene.patch import ScenePatchPlanner, ScenePatchPlanningError
from app.scene.patch_executor import ScenePatchCommandCompiler
from app.scene.templates import build_template_scene_plan_by_type


class LocalObjectCommandService:
    def __init__(self, asset_resolver: Optional[AssetResolver] = None) -> None:
        self.asset_resolver = asset_resolver or AssetResolver()

    def execute(
        self,
        text: str,
        decision: Any,
        canvas_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        object_match = self._object_match_from_decision(decision)
        object_request = (
            build_simple_object_request_from_match(
                text,
                object_match,
                self.asset_resolver,
            )
            if object_match
            else None
        )
        if not object_request:
            return {
                "intent": "clarify",
                "confidence": 0.0,
                "commands": [],
                "response": "我识别到了本地对象，但没能生成可靠的绘图参数。",
                "reason": "Local object route did not include a rebuildable object match",
                "llm_route": "local_object",
                "llm_used": False,
                "routing_reason": decision.reason,
            }

        compiler = DrawingCommandCompiler(canvas_context)
        if object_request.source == "svg_asset" and object_request.asset:
            commands = [compiler._create_svg_asset(object_request.args, object_request.asset)]
        else:
            commands = compiler._create_object(object_request.args)

        return {
            "intent": "draw",
            "confidence": 1.0,
            "commands": commands,
            "response": f"好的，我添加了{object_request.label}。",
            "reason": object_request.source,
            "llm_route": "local_object",
            "llm_used": False,
            "routing_reason": decision.reason,
            "local_object": {
                "source": object_request.source,
                "label": object_request.label,
                "asset_id": object_request.asset.asset_id if object_request.asset else None,
                "kind": object_request.args.kind,
            },
        }

    def _object_match_from_decision(self, decision: Any) -> Optional[SimpleObjectMatch]:
        if not (
            decision.matched_object_kind
            and decision.matched_object_label
            and decision.matched_object_source
        ):
            return None
        return SimpleObjectMatch(
            kind=decision.matched_object_kind,
            source=decision.matched_object_source,
            label=decision.matched_object_label,
            asset_id=decision.matched_asset_id,
        )


class SceneCommandService:
    async def execute_template(
        self,
        text: str,
        decision: Any,
        config: Any,
        canvas_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        template_scene_plan = (
            build_template_scene_plan_by_type(decision.matched_scene_type)
            if decision.matched_scene_type
            else None
        )
        if not template_scene_plan:
            return {
                "intent": "clarify",
                "confidence": 0.0,
                "commands": [],
                "response": "我找到了场景模板线索，但没能生成稳定的本地场景。",
                "reason": "Template scene route did not include a valid scene type",
                "llm_route": decision.route,
                "llm_used": False,
                "routing_reason": decision.reason,
            }

        commands = SceneCommandCompiler(canvas_context).execute(template_scene_plan)
        patched = await self._apply_scene_patch_if_needed(
            text=text,
            template_scene_plan=template_scene_plan,
            commands=commands,
            config=config,
            canvas_context=canvas_context,
        )
        return {
            "intent": "draw",
            "confidence": 1.0,
            "commands": patched["commands"],
            "response": patched["response"],
            "reason": patched["reason"],
            "scene": patched["scene"],
            "llm_route": decision.route,
            "llm_used": bool(config and decision.route == "template_scene_patch"),
            "routing_reason": decision.reason,
            "needs_disambiguation": bool(patched.get("needs_disambiguation")),
            "disambiguation": patched.get("disambiguation"),
        }

    async def _apply_scene_patch_if_needed(
        self,
        text: str,
        template_scene_plan: Any,
        commands: List[Dict[str, Any]],
        config: Any,
        canvas_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        scene_payload = {
            "scene_type": template_scene_plan.scene_type,
            "title": template_scene_plan.title,
            "style": template_scene_plan.style,
            "render_mode": "object_scene",
            "object_count": len(commands),
            "layout_notes": template_scene_plan.layout_notes,
            "source": "template",
        }

        from app.services.llm_router import has_scene_patch_hint

        if not has_scene_patch_hint(text, template_scene_plan.title, template_scene_plan.scene_type):
            return {
                "commands": commands,
                "response": template_scene_plan.response,
                "reason": "scene_template",
                "scene": scene_payload,
            }

        if not config:
            scene_payload["patch_status"] = "skipped_no_llm_config"
            return {
                "commands": commands,
                "response": template_scene_plan.response + " 额外描述需要配置 LLM 后才能继续细化。",
                "reason": "scene_template_patch_skipped_no_llm_config",
                "scene": scene_payload,
            }

        try:
            patch_plan = await ScenePatchPlanner().plan(
                text=text,
                scene_type=template_scene_plan.scene_type,
                title=template_scene_plan.title,
                template_commands=commands,
                llm_config=config,
            )
            patch_compiler = ScenePatchCommandCompiler(
                scene_type=template_scene_plan.scene_type,
                scene_title=template_scene_plan.title,
                template_commands=commands,
                canvas_context=canvas_context,
            )
            patch_commands = patch_compiler.execute(patch_plan)
        except ScenePatchPlanningError as e:
            scene_payload["patch_status"] = "failed"
            return {
                "commands": commands,
                "response": template_scene_plan.response + e.message,
                "reason": e.reason,
                "scene": scene_payload,
            }
        except Exception as e:
            scene_payload["patch_status"] = "failed"
            return {
                "commands": commands,
                "response": template_scene_plan.response + " 额外描述暂时没有应用成功。",
                "reason": f"ScenePatch failed: {str(e)}",
                "scene": scene_payload,
            }

        if not patch_commands:
            scene_payload["patch_status"] = "empty"
            return {
                "commands": commands,
                "response": template_scene_plan.response,
                "reason": "scene_template_patch_empty",
                "scene": scene_payload,
            }

        needs_disambiguation = bool(patch_compiler.needs_disambiguation and patch_compiler.disambiguation)
        disambiguation = patch_compiler.disambiguation if needs_disambiguation else None
        if disambiguation:
            disambiguation["commands"] = [
                command
                for command in patch_commands
                if command.get("target") == "__pending_target__"
            ]

        scene_payload.update(
            {
                "object_count": len(commands) + len(patch_commands),
                "patch_status": "applied",
                "patch_count": len(patch_commands),
            }
        )
        return {
            "commands": [*commands, *patch_commands],
            "response": patch_plan.response or f"好的，我在{template_scene_plan.title}模板上应用了额外描述。",
            "reason": "scene_template_patch",
            "scene": scene_payload,
            "needs_disambiguation": needs_disambiguation,
            "disambiguation": disambiguation,
        }


class OpenSvgSceneCommandService:
    def execute_response(self, svg_scene: Any, routing_reason: str) -> Dict[str, Any]:
        object_id = f"llm_svg_{hashlib.sha1(svg_scene.svg.encode('utf-8')).hexdigest()[:12]}"
        svg_data_url = self._svg_to_data_url(svg_scene.svg)
        commands = [
            {
                "action": "create",
                "type": "image",
                "id": object_id,
                "params": {
                    "x": 0,
                    "y": 0,
                    "width": 800,
                    "height": 600,
                    "imageUrl": svg_data_url,
                    "kind": "llm_svg_scene",
                    "kindLabel": svg_scene.title,
                    "sceneType": svg_scene.scene_type,
                    "sceneTitle": svg_scene.title,
                    "sceneStyle": svg_scene.style,
                    "sceneRole": "full_scene",
                    "assetSource": svg_scene.source,
                    "rawSvg": svg_scene.svg,
                },
            }
        ]
        return {
            "intent": "draw",
            "confidence": 0.9,
            "commands": commands,
            "response": svg_scene.response,
            "reason": "svg_scene",
            "llm_route": "open_scene",
            "llm_used": True,
            "routing_reason": routing_reason,
            "scene": {
                "scene_type": svg_scene.scene_type,
                "title": svg_scene.title,
                "style": svg_scene.style,
                "render_mode": "svg_image",
                "object_count": len(commands),
                "layout_notes": svg_scene.layout_notes,
                "source": svg_scene.source,
                "repaired": bool(getattr(svg_scene, "repaired", False)),
                "fallback_reason": getattr(svg_scene, "fallback_reason", None),
            },
            "svg_scene": {
                "scene_type": svg_scene.scene_type,
                "title": svg_scene.title,
                "source": svg_scene.source,
                "svg": svg_scene.svg,
                "repaired": bool(getattr(svg_scene, "repaired", False)),
                "fallback_reason": getattr(svg_scene, "fallback_reason", None),
            },
        }

    def _svg_to_data_url(self, svg: str) -> str:
        encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
        return f"data:image/svg+xml;base64,{encoded}"
