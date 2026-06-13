from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LLMConfigCreate(BaseModel):
    name: str
    base_url: str
    api_key: str
    model_name: str = "gpt-3.5-turbo"


class LLMConfigUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None


class LLMConfigResponse(BaseModel):
    id: int
    user_id: int
    name: str
    base_url: str
    api_key: str  # 注意：实际生产中应该隐藏或脱敏
    model_name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LLMTestRequest(BaseModel):
    base_url: str
    api_key: str
    model_name: str


class LLMTestResponse(BaseModel):
    success: bool
    message: str
