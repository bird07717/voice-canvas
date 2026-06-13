from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
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
