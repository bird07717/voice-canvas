#!/bin/bash

# Voice Canvas 启动脚本
# 一键启动所有服务

set -e

echo "========================================="
echo "  Voice Canvas - AI语音控制绘画项目"
echo "========================================="
echo ""

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ 错误: Docker未运行，请先启动Docker"
    exit 1
fi

# 检查docker-compose命令
if command -v docker compose > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ 错误: 未找到docker-compose命令"
    exit 1
fi

echo "🔍 检查环境配置..."

# 检查.env文件
if [ ! -f .env ]; then
    echo "⚠️  未找到.env文件，从.env.example复制..."
    cp .env.example .env
    echo "✅ .env文件已创建"
fi

echo ""
echo "🚀 启动服务..."
echo ""

# 停止可能存在的旧容器
$COMPOSE_CMD down 2>/dev/null || true

# 构建并启动服务
$COMPOSE_CMD up --build -d

echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态:"
$COMPOSE_CMD ps

echo ""
echo "========================================="
echo "  ✅ 服务启动完成！"
echo "========================================="
echo ""
echo "📍 访问地址:"
echo "   - 前端: http://localhost:3000"
echo "   - 后端: http://localhost:8000"
echo "   - API文档: http://localhost:8000/docs"
echo ""
echo "👤 默认账号:"
echo "   用户名: admin"
echo "   密码: 123456"
echo ""
echo "📝 查看日志:"
echo "   $COMPOSE_CMD logs -f"
echo ""
echo "🛑 停止服务:"
echo "   $COMPOSE_CMD down"
echo ""
echo "========================================="
