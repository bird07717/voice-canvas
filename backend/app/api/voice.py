from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.canvas import Canvas, ChatHistory
from app.schemas.canvas import VoiceCommandRequest, VoiceCommandResponse, ChatMessage
from app.services.llm_service import LLMService

router = APIRouter(prefix="/api/voice", tags=["voice"])


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
            llm_config_id=request.llm_config_id
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
            "reason": llm_response.get("reason")
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
