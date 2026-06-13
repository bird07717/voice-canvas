from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """用户登录"""
    # 查询用户
    result = await db.execute(
        select(User).where(User.username == credentials.username)
    )
    user = result.scalar_one_or_none()

    # 第一版：硬编码验证 admin/123456
    if credentials.username == "admin" and credentials.password == "123456":
        # 如果数据库中没有admin用户，创建一个
        if not user:
            hashed_password = get_password_hash("123456")
            user = User(username="admin", password_hash=hashed_password)
            db.add(user)
            await db.commit()
            await db.refresh(user)
    else:
        # 验证密码
        if not user or not verify_password(credentials.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

    # 创建访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username},
        expires_delta=access_token_expires
    )

    return TokenResponse(access_token=access_token, token_type="bearer")


@router.post("/logout")
async def logout():
    """用户登出（JWT无状态，客户端清除token即可）"""
    return {"message": "Logged out successfully"}
