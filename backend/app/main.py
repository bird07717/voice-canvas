from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from pathlib import Path
from app.core.config import settings
from app.core.database import engine
from app.api import auth, canvas, voice, llm

app = FastAPI(
    title="Voice Canvas API",
    description="AI语音控制绘画项目后端API",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(canvas.router)
app.include_router(voice.router)
app.include_router(llm.router)

# SVG资源已迁移到前端public/svg-assets目录统一管理
# 前端直接通过 /svg-assets/{path} 访问，无需后端挂载


@app.on_event("startup")
async def migrate_llm_config_api_format() -> None:
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE IF EXISTS llm_configs "
            "ADD COLUMN IF NOT EXISTS api_format VARCHAR(30) DEFAULT 'openai' NOT NULL"
        ))


@app.get("/")
async def root():
    return {
        "message": "Voice Canvas API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
