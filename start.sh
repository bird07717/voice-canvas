#!/bin/bash

echo "======================================"
echo "  Voice Canvas - 启动脚本"
echo "======================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 版本（支持新旧版本）
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

echo "✅ Docker 环境检查通过"
echo "✅ 使用命令: $COMPOSE_CMD"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建 .env 文件..."
    cp .env.example .env
    echo "✅ .env 文件已创建，请根据需要修改配置"
    echo ""
fi

# 启动服务
echo "🚀 启动所有服务..."
echo ""
$COMPOSE_CMD up -d

echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态:"
$COMPOSE_CMD ps

echo ""
echo "======================================"
echo "  服务已启动！"
echo "======================================"
echo ""
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:8000"
echo "📖 API文档: http://localhost:8000/docs"
echo ""
echo "👤 默认账号: admin"
echo "🔑 默认密码: 123456"
echo ""
echo "🎤 语音识别: 已预置百度ASR配置"
echo ""
echo "💡 查看日志: $COMPOSE_CMD logs -f"
echo "🛑 停止服务: $COMPOSE_CMD down"
echo ""
