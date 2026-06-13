from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.canvas import Canvas, ChatHistory
from app.schemas.canvas import (
    CanvasCreate, CanvasUpdate, CanvasResponse,
    VoiceCommandRequest, VoiceCommandResponse, ChatMessage
)
from app.services.llm_service import LLMService

router = APIRouter(prefix="/api/canvases", tags=["canvas"])


@router.get("", response_model=List[CanvasResponse])
async def get_canvases(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取用户的所有画布"""
    result = await db.execute(
        select(Canvas)
        .where(Canvas.user_id == current_user.id)
        .order_by(Canvas.updated_at.desc())
    )
    canvases = result.scalars().all()
    return canvases


@router.post("", response_model=CanvasResponse, status_code=status.HTTP_201_CREATED)
async def create_canvas(
    canvas_data: CanvasCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建新画布"""
    canvas = Canvas(
        user_id=current_user.id,
        title=canvas_data.title,
        canvas_json=canvas_data.canvas_json
    )
    db.add(canvas)
    await db.commit()
    await db.refresh(canvas)
    return canvas


@router.get("/{canvas_id}", response_model=CanvasResponse)
async def get_canvas(
    canvas_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取单个画布"""
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

    return canvas


@router.put("/{canvas_id}", response_model=CanvasResponse)
async def update_canvas(
    canvas_id: int,
    canvas_data: CanvasUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新画布"""
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

    update_data = canvas_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(canvas, field, value)

    await db.commit()
    await db.refresh(canvas)
    return canvas


@router.delete("/{canvas_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_canvas(
    canvas_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除画布"""
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

    await db.delete(canvas)
    await db.commit()
