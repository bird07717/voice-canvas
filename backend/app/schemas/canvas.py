from pydantic import BaseModel
from typing import Optional, Any, List
from datetime import datetime


class CanvasCreate(BaseModel):
    title: Optional[str] = "Untitled Canvas"
    canvas_json: dict


class CanvasUpdate(BaseModel):
    title: Optional[str] = None
    canvas_json: Optional[dict] = None


class CanvasResponse(BaseModel):
    id: int
    user_id: int
    title: str
    canvas_json: dict
    thumbnail_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatMessage(BaseModel):
    role: str
    content: str
    command_json: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VoiceCommandRequest(BaseModel):
    canvas_id: int
    text: str
    llm_config_id: Optional[int] = None


class VoiceCommandResponse(BaseModel):
    intent: str
    confidence: float = 0.0
    commands: List[dict]
    response: str
    reason: Optional[str] = None
    chat_history: List[ChatMessage]
