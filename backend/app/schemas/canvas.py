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
    canvas_context: Optional[dict] = None


class VoiceCommandResponse(BaseModel):
    intent: str
    confidence: float = 0.0
    commands: List[dict]
    response: str
    reason: Optional[str] = None
    scene: Optional[dict] = None
    needs_disambiguation: bool = False
    disambiguation: Optional[dict] = None
    chat_history: List[ChatMessage]


class BaiduASRRequest(BaseModel):
    api_key: str
    secret_key: str
    speech: str
    len: int
    cuid: str
    format: str = "wav"
    rate: int = 16000
    channel: int = 1
    dev_pid: int = 1537


class BaiduASRTestRequest(BaseModel):
    api_key: str
    secret_key: str


class BaiduASRResponse(BaseModel):
    text: str
    raw: dict
