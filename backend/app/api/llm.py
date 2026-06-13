from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.llm_config import LLMConfig
from app.schemas.llm import (
    LLMConfigCreate, LLMConfigUpdate, LLMConfigResponse,
    LLMTestRequest, LLMTestResponse
)
from app.services.llm_service import LLMService

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.get("/configs", response_model=List[LLMConfigResponse])
async def get_llm_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """获取用户的LLM配置列表"""
    result = await db.execute(
        select(LLMConfig)
        .where(LLMConfig.user_id == current_user.id)
        .order_by(LLMConfig.created_at.desc())
    )
    configs = result.scalars().all()
    return configs


@router.post("/configs", response_model=LLMConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_llm_config(
    config_data: LLMConfigCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建LLM配置"""
    # 检查是否已存在同名配置
    result = await db.execute(
        select(LLMConfig).where(
            LLMConfig.user_id == current_user.id,
            LLMConfig.name == config_data.name
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configuration with this name already exists"
        )

    # 如果是第一个配置，设为激活状态
    count_result = await db.execute(
        select(LLMConfig).where(LLMConfig.user_id == current_user.id)
    )
    is_first = len(count_result.scalars().all()) == 0

    config = LLMConfig(
        user_id=current_user.id,
        name=config_data.name,
        base_url=config_data.base_url,
        api_key=config_data.api_key,
        model_name=config_data.model_name,
        is_active=is_first
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.put("/configs/{config_id}", response_model=LLMConfigResponse)
async def update_llm_config(
    config_id: int,
    config_data: LLMConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新LLM配置"""
    result = await db.execute(
        select(LLMConfig).where(
            LLMConfig.id == config_id,
            LLMConfig.user_id == current_user.id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )

    update_data = config_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)
    return config


@router.delete("/configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_llm_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除LLM配置"""
    result = await db.execute(
        select(LLMConfig).where(
            LLMConfig.id == config_id,
            LLMConfig.user_id == current_user.id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )

    await db.delete(config)
    await db.commit()


@router.post("/configs/{config_id}/activate")
async def activate_llm_config(
    config_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """激活指定的LLM配置"""
    # 先取消所有激活状态
    await db.execute(
        update(LLMConfig)
        .where(LLMConfig.user_id == current_user.id)
        .values(is_active=False)
    )

    # 激活指定配置
    result = await db.execute(
        select(LLMConfig).where(
            LLMConfig.id == config_id,
            LLMConfig.user_id == current_user.id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found"
        )

    config.is_active = True
    await db.commit()

    return {"message": "Configuration activated successfully"}


@router.post("/test", response_model=LLMTestResponse)
async def test_llm_connection(
    test_data: LLMTestRequest,
    current_user: User = Depends(get_current_user)
):
    """测试LLM连接"""
    try:
        llm_service = LLMService(None)
        success = await llm_service.test_connection(
            base_url=test_data.base_url,
            api_key=test_data.api_key,
            model_name=test_data.model_name
        )

        if success:
            return LLMTestResponse(
                success=True,
                message="Connection successful"
            )
        else:
            return LLMTestResponse(
                success=False,
                message="Connection failed"
            )
    except Exception as e:
        return LLMTestResponse(
            success=False,
            message=f"Error: {str(e)}"
        )
