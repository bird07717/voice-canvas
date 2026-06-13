# 🚀 Voice Canvas 启动指南

## 项目状态

✅ **项目已完整搭建完成！**
- 63个项目文件
- 完整的前后端架构
- Docker容器化配置
- 百度ASR集成完成
- 文档齐全

## 立即启动

### 第一步：进入项目目录

```bash
cd /home/bird/Projects/Voice_canvas
```

### 第二步：启动项目

```bash
# 给脚本添加执行权限（仅首次需要）
chmod +x start.sh

# 启动所有服务
./start.sh
```

启动脚本会自动：
1. ✅ 检查Docker环境
2. ✅ 创建.env配置文件
3. ✅ 启动PostgreSQL数据库
4. ✅ 启动后端API服务
5. ✅ 启动前端Web应用
6. ✅ 显示服务状态

### 第三步：访问应用

等待约10-20秒后，访问：

- 🌐 **前端应用**: http://localhost:3000
- 🔧 **后端API**: http://localhost:8000
- 📚 **API文档**: http://localhost:8000/docs

### 第四步：登录系统

使用默认账号：
- 👤 用户名：`admin`
- 🔑 密码：`123456`

## 配置说明

### 必需配置：LLM API

登录后需要配置LLM才能使用语音绘画功能：

1. 点击"新建画布"或进入任意画布
2. 点击侧边栏"LLM设置"标签
3. 点击"添加"按钮
4. 填写配置：
   - **配置名称**：如"OpenAI GPT-4"
   - **Base URL**：`https://api.openai.com/v1`（或其他兼容API）
   - **API Key**：你的API密钥
   - **模型名称**：如`gpt-3.5-turbo`或`gpt-4`
5. 点击"测试连接"验证
6. 点击"确定"保存

### 可选配置：百度ASR

项目已内置百度ASR配置，可直接使用。如需使用自己的密钥：

1. 在画布页面点击"百度ASR"标签
2. 输入你的API Key和Secret Key
3. 点击"测试连接"
4. 点击"保存配置"

## 开始使用

### 1. 创建画布

- 在首页点击"新建画布"按钮
- 进入画布编辑页面

### 2. 开始语音绘画

1. 确保已配置LLM（侧边栏会显示当前模型）
2. 点击"语音控制"标签
3. 点击"开始语音识别"按钮
4. 允许浏览器访问麦克风
5. 对着麦克风说话：

**示例命令**：
```
"画一个红色的圆"
"画一个蓝色的矩形"
"画一个房子"
"把它变成绿色"
"移到左边"
"清空画布"
"撤销"
```

### 3. 查看效果

- 识别的文字会实时显示在界面上
- AI理解后会在画布上绘制图形
- AI的回复显示在右侧对话面板
- 所有对话历史会被保存

## 功能特性

### ✅ 已实现的功能

**语音识别**
- 百度ASR（高准确率）
- Web Speech API（自动降级）
- 实时文本显示
- 状态指示

**AI绘图**
- 自然语言理解
- 基础图形：圆、矩形、线条、文字、星形
- 组合图形：房子、树、动物
- 颜色控制
- 位置移动

**画布管理**
- 创建/保存/删除画布
- 撤销/重做
- 导出PNG图片
- 历史记录

**系统功能**
- 用户认证
- 多LLM配置
- 对话历史
- 状态管理

## 常见问题

### Q: Docker启动失败？

**A:** 检查Docker服务状态
```bash
# 检查Docker是否运行
docker ps

# 查看错误日志
docker compose logs -f
```

### Q: 端口被占用？

**A:** 修改端口配置
```bash
# 检查端口占用
lsof -i :3000
lsof -i :8000
lsof -i :5432

# 在docker-compose.yml中修改端口映射
```

### Q: 语音识别不工作？

**A:** 检查以下几点：
1. 使用Chrome或Edge浏览器
2. 允许麦克风权限
3. 检查"百度ASR"或"浏览器识别"标签显示
4. 查看浏览器控制台错误信息

### Q: LLM调用失败？

**A:** 验证配置：
1. Base URL格式正确（以/v1结尾）
2. API Key有效
3. 模型名称正确
4. 使用"测试连接"功能验证

### Q: 画布不显示？

**A:** 刷新页面或：
```bash
# 重启服务
docker compose restart
```

## 停止服务

```bash
# 停止所有服务
docker compose down

# 停止并删除数据（慎用）
docker compose down -v
```

## 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

## 性能优化建议

### 生产环境部署

1. **修改密钥**：编辑`.env`文件，修改`SECRET_KEY`
2. **配置域名**：修改`CORS_ORIGINS`
3. **使用HTTPS**：配置SSL证书
4. **数据库备份**：定期备份PostgreSQL数据

### 本地开发

1. **修改代码后自动重载**
   - 后端：代码修改自动重启（--reload）
   - 前端：Vite热更新

2. **查看API文档**
   - 访问 http://localhost:8000/docs
   - 在线测试所有API接口

## 技术支持

### 文档
- `README.md` - 本文件
- `CHECKLIST.md` - 功能清单
- `docs/PROJECT_SUMMARY.md` - 完整项目总结
- `docs/baidu_asr.md` - 百度ASR集成说明
- `docs/development.md` - 开发指南
- `docs/api.md` - API文档
- `docs/architecture.md` - 架构设计

### 项目信息
- 技术栈：React + FastAPI + PostgreSQL
- 容器化：Docker + Docker Compose
- 前端框架：React 18 + TypeScript + Ant Design
- 后端框架：Python 3.11 + FastAPI
- 画布引擎：Konva.js
- 语音识别：百度ASR + Web Speech API

## 下一步

项目已完全可用！你现在可以：

1. ✅ 启动项目：`./start.sh`
2. ✅ 配置LLM API
3. ✅ 开始语音绘画创作
4. ✅ 探索各种功能
5. ✅ 根据需求扩展功能

## 预置配置

项目已预置以下配置，可直接使用：

**百度ASR**（已内置）
```
API Key: SRU3kShktNWWRZrw4mANivzE
Secret Key: m95tXCJZAtacKdYXAARtCNgtk5bBj8iS
```

**默认账号**
```
Username: admin
Password: 123456
```

---

🎉 **祝你使用愉快！用语音创作你的艺术作品吧！** 🎨✨
