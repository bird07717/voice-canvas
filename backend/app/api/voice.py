from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import httpx
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.canvas import Canvas, ChatHistory
from app.schemas.canvas import (
    BaiduASRRequest,
    BaiduASRResponse,
    BaiduASRTestRequest,
    VoiceCommandRequest,
    VoiceCommandResponse,
    ChatMessage
)
from app.services.llm_service import LLMService

router = APIRouter(prefix="/api/voice", tags=["voice"])


async def get_baidu_access_token(api_key: str, secret_key: str) -> str:
    token_url = "https://aip.baidubce.com/oauth/2.0/token"
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            token_url,
            params={
                "grant_type": "client_credentials",
                "client_id": api_key,
                "client_secret": secret_key
            }
        )

    try:
        data = response.json()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Baidu token service returned invalid JSON"
        )

    if response.status_code >= 400 or data.get("error"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=data.get("error_description") or data.get("error") or "Failed to get Baidu access token"
        )

    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Baidu token response missing access_token"
        )

    return access_token


@router.post("/baidu/test")
async def test_baidu_asr(
    request: BaiduASRTestRequest,
    current_user: User = Depends(get_current_user)
):
    """测试百度ASR凭据。"""
    await get_baidu_access_token(request.api_key, request.secret_key)
    return {"success": True, "message": "Baidu ASR credentials are valid"}


@router.post("/baidu/asr", response_model=BaiduASRResponse)
async def recognize_with_baidu(
    request: BaiduASRRequest,
    current_user: User = Depends(get_current_user)
):
    """代理调用百度短语音识别，避免浏览器CORS和音频格式限制问题。"""
    token = await get_baidu_access_token(request.api_key, request.secret_key)

    payload = {
        "format": request.format,
        "rate": request.rate,
        "channel": request.channel,
        "cuid": request.cuid,
        "token": token,
        "dev_pid": request.dev_pid,
        "speech": request.speech,
        "len": request.len
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://vop.baidu.com/server_api",
            json=payload
        )

    try:
        data = response.json()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Baidu ASR service returned invalid JSON"
        )

    if response.status_code >= 400 or data.get("err_no") != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=data.get("err_msg") or "Baidu ASR recognition failed"
        )

    result = data.get("result") or []
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Baidu ASR returned no recognition result"
        )

    return BaiduASRResponse(text=result[0], raw=data)


@router.post("/command", response_model=VoiceCommandResponse)
async def process_voice_command(
    request: VoiceCommandRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """处理语音命令"""
    # 验证画布是否属于当前用户
    result = await db.execute(
        select(Canvas).where(
            Canvas.id == request.canvas_id,
            Canvas.user_id == current_user.id
        )
    )
    canvas = result.scalar_one_or_none()

    if not canvas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Canvas not found"
        )

    # 调用LLM服务
    llm_service = LLMService(db)
    try:
        llm_response = await llm_service.process_command(
            user_id=current_user.id,
            text=request.text,
            llm_config_id=request.llm_config_id,
            canvas_context=request.canvas_context
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM service error: {str(e)}"
        )

    if llm_response["intent"] == "ignore":
        return VoiceCommandResponse(
            intent=llm_response["intent"],
            confidence=llm_response["confidence"],
            commands=[],
            response="",
            reason=llm_response.get("reason"),
            scene=llm_response.get("scene"),
            needs_disambiguation=bool(llm_response.get("needs_disambiguation")),
            disambiguation=llm_response.get("disambiguation"),
            chat_history=[]
        )

    # 非忽略内容才保存到对话历史，避免背景噪声污染画布上下文
    user_message = ChatHistory(
        canvas_id=request.canvas_id,
        role="user",
        content=request.text
    )
    db.add(user_message)

    # 保存助手消息
    assistant_message = ChatHistory(
        canvas_id=request.canvas_id,
        role="assistant",
        content=llm_response["response"],
        command_json={
            "intent": llm_response["intent"],
            "confidence": llm_response["confidence"],
            "commands": llm_response["commands"],
            "reason": llm_response.get("reason"),
            "scene": llm_response.get("scene"),
            "needs_disambiguation": bool(llm_response.get("needs_disambiguation")),
            "disambiguation": llm_response.get("disambiguation"),
        }
    )
    db.add(assistant_message)
    await db.commit()

    # 获取对话历史
    history_result = await db.execute(
        select(ChatHistory)
        .where(ChatHistory.canvas_id == request.canvas_id)
        .order_by(ChatHistory.created_at.asc())
        .limit(50)
    )
    chat_history = history_result.scalars().all()

    return VoiceCommandResponse(
        intent=llm_response["intent"],
        confidence=llm_response["confidence"],
        commands=llm_response["commands"],
        response=llm_response["response"],
        reason=llm_response.get("reason"),
        scene=llm_response.get("scene"),
        needs_disambiguation=bool(llm_response.get("needs_disambiguation")),
        disambiguation=llm_response.get("disambiguation"),
        chat_history=[ChatMessage.model_validate(msg) for msg in chat_history]
    )


@router.get("/chat/{canvas_id}/history", response_model=List[ChatMessage])
async def get_chat_history(
    canvas_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取对话历史"""
    # 验证画布是否属于当前用户
    result = await db.execute(
        select(Canvas).where(
            Canvas.id == canvas_id,
            Canvas.user_id == current_user.id
        )
    )
    canvas = result.scalar_one_or_none()

    if not canvas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Canvas not found"
        )

    # 获取对话历史
    history_result = await db.execute(
        select(ChatHistory)
        .where(ChatHistory.canvas_id == canvas_id)
        .order_by(ChatHistory.created_at.asc())
    )
    chat_history = history_result.scalars().all()

    return [ChatMessage.model_validate(msg) for msg in chat_history]
