import json
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, ValidationError

from app.assets.resolver import AssetResolver
from app.models.llm_config import LLMConfig
from app.services.llm_client import complete_text


PatchAction = Literal["add", "modify", "delete"]
PatchTargetRef = Literal["kind", "label", "id", "scene_role"]
PatchAnchor = Literal[
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top_left",
    "top_right",
    "bottom_left",
    "bottom_right",
    "custom",
]
PatchRenderStrategy = Literal["basic", "template", "svg"]


class ScenePatchTarget(BaseModel):
    ref: PatchTargetRef = "kind"
    value: str = Field(..., min_length=1)


class ScenePatchPosition(BaseModel):
    anchor: PatchAnchor = "center"
    x: Optional[float] = None
    y: Optional[float] = None
    layer: int = 8


class ScenePatchSize(BaseModel):
    preset: Literal["tiny", "small", "medium", "large", "huge"] = "medium"
    width: Optional[float] = None
    height: Optional[float] = None


class ScenePatchStyle(BaseModel):
    fill: Optional[str] = None
    stroke: Optional[str] = None
    opacity: Optional[float] = Field(default=None, ge=0, le=1)
    text: Optional[str] = None


class ScenePatchOperation(BaseModel):
    action: PatchAction
    target: Optional[ScenePatchTarget] = None
    kind: Optional[str] = None
    label: Optional[str] = None
    render_strategy: Optional[PatchRenderStrategy] = None
    position: ScenePatchPosition = Field(default_factory=ScenePatchPosition)
    size: ScenePatchSize = Field(default_factory=ScenePatchSize)
    style: ScenePatchStyle = Field(default_factory=ScenePatchStyle)
    changes: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None


class ScenePatchPlan(BaseModel):
    operations: List[ScenePatchOperation] = Field(default_factory=list)
    response: str = ""
    reason: Optional[str] = None


class ScenePatchPlanningError(Exception):
    def __init__(self, message: str, reason: str):
        super().__init__(message)
        self.message = message
        self.reason = reason


class ScenePatchPlanner:
    SYSTEM_PROMPT = """你是语音绘画系统的 ScenePatch 规划器。
你已经有一个稳定的本地场景模板，用户的话里可能还包含额外要求。
你的任务只输出对模板的补丁：add/modify/delete，不要重新生成完整场景。

只返回严格 JSON，不要 Markdown，不要代码块：
{
  "operations": [
    {
      "action": "add|modify|delete",
      "target": {"ref": "kind|label|id|scene_role", "value": "目标"},
      "kind": "新增物体语义，例如 cat/fountain/text/tree",
      "label": "中文对象名",
      "render_strategy": "basic|template|svg",
      "position": {"anchor": "center|top|bottom|left|right|top_left|top_right|bottom_left|bottom_right|custom", "x": 400, "y": 300, "layer": 8},
      "size": {"preset": "tiny|small|medium|large|huge", "width": 100, "height": 80},
      "style": {"fill": "#颜色", "stroke": "#颜色", "opacity": 1, "text": "文字"},
      "changes": {"fill": "#颜色", "text": "文字", "dx": 40, "dy": 0, "scale_delta": 1.2},
      "description": "给素材检索或几何回退用的简短视觉描述"
    }
  ],
  "response": "给用户的简短中文回复",
  "reason": "简短说明"
}

规则：
- 如果用户只是要求画模板本身，没有额外要求，operations 返回 []。
- 只处理模板以外的额外描述，例如“加一只猫”“把天空变紫”“不要气球”“椅子旁边放喷泉”。
- add 新增具体物体时优先 render_strategy=svg，并使用 SVG 素材目录里的英文 kind；基础图形、背景块或文字用 basic；只有 SVG 不合适时才用 template。
- 如果素材库为空或没有匹配项，也可以输出 svg；系统会自动回退为 template/basic 占位。
- modify/delete 必须带 target。target 优先用 kind 或 label，例如 sky/background/balloon/cake/tree。
- 每次最多 5 个 operations，避免过度修改模板。
- 画布大小为 800x600，坐标必须合理。
"""

    def _extract_json(self, content: str) -> Dict[str, Any]:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            start = content.find("{")
            end = content.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            return json.loads(content[start:end + 1])

    def _format_template_summary(self, scene_type: str, title: str, commands: List[Dict[str, Any]]) -> str:
        objects = []
        for command in commands:
            params = command.get("params") or {}
            objects.append(
                {
                    "id": command.get("id"),
                    "type": command.get("type"),
                    "kind": params.get("kind"),
                    "label": params.get("kindLabel"),
                    "role": params.get("sceneRole"),
                    "x": params.get("x"),
                    "y": params.get("y"),
                    "text": params.get("text"),
                }
            )
        return json.dumps(
            {
                "scene_type": scene_type,
                "title": title,
                "objects": objects[:40],
            },
            ensure_ascii=False,
        )

    async def plan(
        self,
        text: str,
        scene_type: str,
        title: str,
        template_commands: List[Dict[str, Any]],
        llm_config: LLMConfig,
        asset_resolver: Optional[AssetResolver] = None,
    ) -> ScenePatchPlan:
        resolver = asset_resolver or AssetResolver()
        response = await complete_text(
            llm_config,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "system", "content": f"当前模板摘要：{self._format_template_summary(scene_type, title, template_commands)}"},
                {"role": "system", "content": f"可用 SVG 素材：\n{resolver.catalog_summary()}"},
                {"role": "user", "content": text},
            ],
            temperature=0.25,
            max_tokens=1600,
            timeout=30.0,
        )

        content = response.content
        try:
            raw = self._extract_json(content)
            plan = ScenePatchPlan.model_validate(raw)
        except json.JSONDecodeError as exc:
            raise ScenePatchPlanningError(
                "我生成场景补丁时没能可靠解析结果，请再说一次额外要求。",
                "ScenePatch 返回内容不是有效 JSON",
            ) from exc
        except ValidationError as exc:
            raise ScenePatchPlanningError(
                "我生成的场景补丁结构不完整，请换一种说法描述额外要求。",
                "ScenePatch Pydantic 校验失败",
            ) from exc

        plan.operations = plan.operations[:5]
        return plan
