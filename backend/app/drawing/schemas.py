from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


PositionAnchor = Literal[
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top_left",
    "top_right",
    "bottom_left",
    "bottom_right",
    "near_target",
    "custom"
]

SizePreset = Literal["tiny", "small", "medium", "large", "huge"]
RenderStrategy = Literal["basic", "template", "svg"]
ToolName = Literal[
    "create_object",
    "edit_object",
    "delete_object",
    "control_canvas",
    "ask_clarification",
    "ignore_input"
]


class PositionSpec(BaseModel):
    anchor: PositionAnchor = "center"
    x: Optional[float] = None
    y: Optional[float] = None
    relative_to: Optional[str] = None
    offset_x: float = 0
    offset_y: float = 0


class SizeSpec(BaseModel):
    preset: SizePreset = "medium"
    width: Optional[float] = None
    height: Optional[float] = None
    scale: Optional[float] = None


class StyleSpec(BaseModel):
    fill: Optional[str] = None
    stroke: Optional[str] = None
    stroke_width: Optional[float] = Field(default=None, ge=0)
    opacity: Optional[float] = Field(default=None, ge=0, le=1)
    rotation: Optional[float] = None
    text: Optional[str] = None
    font_size: Optional[float] = Field(default=None, gt=0)


class TargetSpec(BaseModel):
    ref: Literal["last", "selected", "kind", "id"] = "last"
    id: Optional[str] = None
    kind: Optional[str] = None


class CreateObjectArgs(BaseModel):
    kind: str = Field(..., min_length=1)
    render_strategy: RenderStrategy
    position: PositionSpec = Field(default_factory=PositionSpec)
    size: SizeSpec = Field(default_factory=SizeSpec)
    style: StyleSpec = Field(default_factory=StyleSpec)
    description: Optional[str] = None


class EditObjectArgs(BaseModel):
    target: TargetSpec
    operation: Optional[Literal["move", "resize", "recolor", "rotate", "restyle"]] = None
    changes: Dict[str, Any] = Field(default_factory=dict)


class DeleteObjectArgs(BaseModel):
    target: TargetSpec


class ControlCanvasArgs(BaseModel):
    action: Literal["undo", "redo", "clear", "save", "export"]


class AskClarificationArgs(BaseModel):
    question: str = Field(..., min_length=1)
    missing: List[str] = Field(default_factory=list)


class IgnoreInputArgs(BaseModel):
    reason: str = Field(..., min_length=1)


ToolArguments = Union[
    CreateObjectArgs,
    EditObjectArgs,
    DeleteObjectArgs,
    ControlCanvasArgs,
    AskClarificationArgs,
    IgnoreInputArgs
]


class DrawingToolCall(BaseModel):
    tool: ToolName
    arguments: ToolArguments
    confidence: float = Field(default=0.0, ge=0, le=1)


class DrawingPlan(BaseModel):
    calls: List[DrawingToolCall] = Field(default_factory=list)
    response: str = ""
    reasoning: Optional[str] = None
