from typing import List, Literal, Optional

from pydantic import BaseModel, Field


SceneRole = Literal["background", "midground", "foreground", "decoration", "label"]
SceneAnchor = Literal[
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top_left",
    "top_right",
    "bottom_left",
    "bottom_right",
    "custom"
]
SceneSizePreset = Literal["tiny", "small", "medium", "large", "huge", "wide", "tall"]


class SceneBackground(BaseModel):
    fill: Optional[str] = None
    horizon_y: Optional[float] = None
    ground_fill: Optional[str] = None


class ScenePosition(BaseModel):
    anchor: SceneAnchor = "center"
    x: Optional[float] = None
    y: Optional[float] = None
    layer: int = 0


class SceneSize(BaseModel):
    preset: SceneSizePreset = "medium"
    width: Optional[float] = None
    height: Optional[float] = None


class SceneStyle(BaseModel):
    fill: Optional[str] = None
    stroke: Optional[str] = None
    opacity: Optional[float] = Field(default=None, ge=0, le=1)
    text: Optional[str] = None


class SceneObject(BaseModel):
    id_hint: Optional[str] = None
    kind: str = Field(..., min_length=1)
    role: SceneRole = "midground"
    position: ScenePosition = Field(default_factory=ScenePosition)
    size: SceneSize = Field(default_factory=SceneSize)
    style: SceneStyle = Field(default_factory=SceneStyle)
    label: Optional[str] = None
    description: Optional[str] = None


class ScenePlan(BaseModel):
    scene_type: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    style: str = "cartoon_flat"
    background: Optional[SceneBackground] = None
    objects: List[SceneObject] = Field(default_factory=list)
    layout_notes: Optional[str] = None
    response: str = ""
