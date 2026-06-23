from dataclasses import dataclass
from typing import Literal, Optional

from app.drawing.object_request import SimpleObjectRequest, build_simple_object_request
from app.scene.intent import is_open_visual_draw_request
from app.scene.schemas import ScenePlan
from app.scene.templates import build_template_scene_plan


LLMRoute = Literal[
    "local_object",
    "template_scene",
    "template_scene_patch",
    "open_scene",
    "tool_plan",
    "requires_llm",
]


@dataclass(frozen=True)
class LLMRouteDecision:
    route: LLMRoute
    requires_llm: bool
    reason: str
    template_scene_plan: Optional[ScenePlan] = None
    simple_object_request: Optional[SimpleObjectRequest] = None


def has_scene_patch_hint(text: str, scene_title: str, scene_type: str) -> bool:
    normalized = "".join(str(text or "").split()).lower()
    title = "".join(str(scene_title or "").split()).lower()
    scene = str(scene_type or "").lower()

    if not normalized:
        return False

    command_prefixes = ("画一个", "画一幅", "画个", "生成一个", "生成一幅", "来一个", "创建一个")
    bare_scene_phrases = {
        title,
        f"一个{title}",
        f"一幅{title}",
        f"画一个{title}",
        f"画一幅{title}",
        f"画个{title}",
        f"生成一个{title}",
        f"生成一幅{title}",
        scene,
    }
    if normalized in bare_scene_phrases:
        return False

    patch_words = (
        "加",
        "添加",
        "放",
        "摆",
        "带",
        "有",
        "不要",
        "去掉",
        "删除",
        "移除",
        "改",
        "换",
        "变",
        "变成",
        "旁边",
        "左边",
        "右边",
        "上面",
        "下面",
        "背景",
        "前景",
        "文字",
        "写",
    )
    if any(word in normalized for word in patch_words):
        return True

    for prefix in command_prefixes:
        if normalized.startswith(prefix + title):
            return len(normalized) > len(prefix + title)
    return False


def classify_llm_route(text: str, has_llm_config: bool = True) -> LLMRouteDecision:
    template_scene_plan = build_template_scene_plan(text)
    if template_scene_plan:
        needs_patch = has_scene_patch_hint(
            text,
            template_scene_plan.title,
            template_scene_plan.scene_type,
        )
        if needs_patch:
            return LLMRouteDecision(
                route="template_scene_patch" if has_llm_config else "template_scene",
                requires_llm=has_llm_config,
                reason=(
                    "固定模板命中，附加描述交给 LLM ScenePatch"
                    if has_llm_config
                    else "固定模板命中，但未配置 LLM，跳过附加描述"
                ),
                template_scene_plan=template_scene_plan,
            )

        return LLMRouteDecision(
            route="template_scene",
            requires_llm=False,
            reason="固定模板命中，本地生成稳定场景",
            template_scene_plan=template_scene_plan,
        )

    simple_object_request = build_simple_object_request(text)
    if simple_object_request:
        return LLMRouteDecision(
            route="local_object",
            requires_llm=False,
            reason=(
                "命中本地 SVG 素材，直接生成对象"
                if simple_object_request.source == "svg_asset"
                else "命中本地模板对象，直接生成对象"
            ),
            simple_object_request=simple_object_request,
        )

    if is_open_visual_draw_request(text):
        return LLMRouteDecision(
            route="open_scene" if has_llm_config else "requires_llm",
            requires_llm=True,
            reason="第三层通用开放绘画请求，交给 LLM 直接生成 SVG 场景",
        )

    return LLMRouteDecision(
        route="tool_plan" if has_llm_config else "requires_llm",
        requires_llm=True,
        reason="非快速命令或模板场景，使用 LLM 工具规划",
    )
