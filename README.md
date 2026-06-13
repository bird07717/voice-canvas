# Voice Canvas - AI语音控制绘画项目

> 通过语音命令，配合AI大模型理解，在画布上自由创作！

## 🎉 项目完成状态

✅ **项目已完整搭建完成，第二阶段 Scene Planner 已完成，可以立即启动使用！**

## ✨ 核心特性

### 🎤 智能语音识别
- **百度ASR**：高准确率的语音识别（已预置API密钥）
- **自动降级**：失败时自动降级到浏览器Web Speech API
- **实时反馈**：识别文本实时显示

### 🤖 AI智能理解
- **LLM驱动**：支持OpenAI格式的任何大模型
- **自然语言**：用自然语言描述想画的内容
- **智能解析**：自动理解并生成绘图命令
- **双层交互**：常见命令本地快速执行，复杂创作请求再交给LLM
- **场景规划**：一句话生成完整场景，如海边日落、公园、生日贺卡、城市夜景

### 🎨 强大的绘图功能
- **基础图形**：圆形、矩形、线条、文字、星形
- **组合图形**：房子、树、动物等复杂图形
- **灵活控制**：颜色、位置、大小随意调整
- **操作命令**：创建、修改、移动、删除、撤销、清空
- **手动微调**：创建后自动选中，支持点击选中、拖拽移动，再继续语音修改

### 💾 完整的管理功能
- **画布管理**：创建、保存、删除画布
- **历史记录**：对话历史、画布历史
- **撤销重做**：支持多步撤销和重做
- **场景级撤销**：一次场景生成可作为一个历史步骤回退
- **导出功能**：导出为PNG图片

## 🚀 快速开始

### 前置要求
- Docker 20.10+
- Docker Compose 2.0+（或docker-compose 1.29+）

### 一键启动

```bash
cd /home/bird/Projects/Voice_canvas

# 给启动脚本添加执行权限（首次需要）
chmod +x start.sh

# 启动项目
./start.sh
```

启动后访问：
- 🌐 前端：http://localhost:3000
- 🔧 后端：http://localhost:8000
- 📚 文档：http://localhost:8000/docs

默认账号：`admin` / `123456`

## 📖 使用流程

### 1. 登录系统
- 打开 http://localhost:3000
- 使用默认账号登录

### 2. 配置LLM（必需）
- 进入任意画布
- 点击侧边栏"LLM设置"
- 添加OpenAI兼容的API配置
  - Base URL：如 `https://api.openai.com/v1`
  - API Key：你的API密钥
  - Model：如 `gpt-3.5-turbo`
- 测试连接后保存

### 3. 配置语音识别（可选）

**方式一：使用预置配置**
- 项目已内置百度ASR配置，无需设置
- 直接使用即可

**方式二：使用自己的API**
- 点击"百度ASR"标签
- 输入你的API Key和Secret Key
- 测试并保存

**方式三：使用浏览器识别**
- 在"百度ASR"标签点击"禁用"
- 自动使用Web Speech API（降级方案）

### 4. 开始语音绘画
- 点击"开始语音识别"按钮
- 对着麦克风说：**"画一个红色的圆"**
- 观察状态面板、画布变化和AI回复

Voice Canvas 现在采用“快速命令 + LLM理解”的双层语音交互：画圆、改颜色、移动、撤销、保存、导出等高频命令会在前端立即执行；未命中的复杂创作请求会继续调用LLM规划绘图命令。状态面板会固定显示当前状态、识别文本、理解结果和执行结果。

第二阶段新增 Scene Planner：用户可以说“画一个海边日落”“画一个公园”“画一张生日贺卡”，系统会规划多个对象、布局、层级和颜色，再渐进式绘制到当前画布。

### 5. 更多命令示例

**基础图形**：
- "画一个蓝色的矩形"
- "画一条黑色的线"
- "写上文字：Hello"
- "画一个五角星"

**组合图形**：
- "画一个房子"
- "画一棵树"
- "画一个小人"

**完整场景**：
- "画一个海边日落"
- "画一个公园，有草地、树、太阳和小路"
- "画一张生日贺卡，中间写生日快乐"
- "画一个城市夜景"

**控制命令**：
- "把它变成绿色"
- "选中太阳"
- "把海变成蓝色"
- "移到左边"
- "清空画布"
- "撤销"
- "重做"
- "保存"
- "导出"

**演示脚本**：
1. 打开画布，点击"开始语音识别"
2. 说"画一个红色圆"
3. 说"把它变大一点"
4. 拖动圆到左侧
5. 说"变成蓝色"
6. 说"撤销"
7. 说"重做"
8. 说"保存"
9. 说"导出"

## 📁 项目结构

```
Voice_canvas/
├── frontend/              # React前端
│   ├── src/
│   │   ├── pages/         # 页面：登录、首页、画布
│   │   ├── components/    # 组件：语音、画布、LLM等
│   │   ├── stores/        # Zustand状态管理
│   │   ├── services/      # API和语音服务
│   │   └── types/         # TypeScript类型
│   └── Dockerfile
│
├── backend/               # Python后端
│   ├── app/
│   │   ├── api/          # API路由
│   │   ├── scene/        # Scene Planner、模板和执行器
│   │   ├── models/       # 数据模型
│   │   ├── services/     # LLM服务
│   │   └── core/         # 配置和安全
│   ├── init.sql          # 数据库初始化
│   └── Dockerfile
│
├── docs/                  # 文档
│   ├── PROJECT_SUMMARY.md  # 项目总结
│   ├── baidu_asr.md       # 百度ASR文档
│   ├── development.md     # 开发指南
│   ├── api.md            # API文档
│   ├── architecture.md   # 架构文档
│   └── scene_planner.md  # Scene Planner技术文档
│
├── docker-compose.yml     # Docker编排
├── start.sh              # 启动脚本
├── CHECKLIST.md          # 完成清单
└── README.md             # 本文件
```

## 🛠️ 技术栈

### 前端
- **React 18** - UI框架
- **TypeScript** - 类型安全
- **Ant Design** - UI组件库
- **react-konva** - Canvas绘图
- **Zustand** - 状态管理
- **Vite** - 构建工具

### 后端
- **Python 3.11** - 编程语言
- **FastAPI** - Web框架
- **SQLAlchemy** - ORM
- **asyncpg** - 异步数据库驱动
- **OpenAI SDK** - LLM调用

### 基础设施
- **PostgreSQL 15** - 数据库
- **Docker** - 容器化
- **Nginx** - 反向代理（可选）

## 📊 项目统计

- 📝 源代码文件：60+
- 🔌 API接口：15+
- 🎨 前端组件：10+
- 🗄️ 数据库表：4个
- 📚 文档：9份
- 🧩 场景模板：7个

## 🎯 核心功能

### 已实现 ✅
- [x] 用户认证（JWT）
- [x] 画布CRUD管理
- [x] 百度ASR语音识别
- [x] Web Speech API降级
- [x] LLM智能理解
- [x] Scene Planner 场景级语音创作
- [x] 常见场景模板和布局避让
- [x] 场景渐进绘制和场景级撤销
- [x] Canvas实时绘图
- [x] 常用语音命令快速匹配
- [x] 对象自动选中、高亮和拖拽回写
- [x] 对话历史记录
- [x] 撤销/重做
- [x] 导出PNG图片
- [x] Docker容器化

### 计划中 🔄
- [ ] 实时流式识别
- [ ] 自定义词库
- [ ] 画布缩略图
- [ ] 多语言支持
- [ ] 画布分享
- [ ] 多人协作

## 🐛 故障排查

### Docker相关

**问题：端口被占用**
```bash
# 检查端口占用
lsof -i :3000  # 前端
lsof -i :8000  # 后端
lsof -i :5432  # 数据库

# 停止占用进程或修改docker-compose.yml中的端口
```

**问题：服务启动失败**
```bash
# 查看日志
docker compose logs -f

# 重新构建
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 语音识别相关

**问题：百度ASR失败**
- 检查API Key配置
- 查看浏览器控制台错误
- 测试网络连接：`curl https://aip.baidubce.com`
- 使用"测试连接"功能验证配置

**问题：浏览器识别不工作**
- 使用Chrome或Edge浏览器
- 允许麦克风权限
- 确保是HTTPS或localhost环境

### LLM相关

**问题：LLM调用失败**
- 验证Base URL格式正确
- 确认API Key有效
- 检查模型名称正确
- 使用"测试连接"功能

## 📚 文档

详细文档位于 `docs/` 目录：

- **PROJECT_SUMMARY.md** - 完整项目总结和技术细节
- **CHECKLIST.md** - 功能清单和测试指南
- **baidu_asr.md** - 百度ASR集成详细说明
- **development.md** - 开发指南和最佳实践
- **api.md** - 完整的API接口文档
- **architecture.md** - 架构设计和数据流
- **scene_planner.md** - Scene Planner 架构、模板和测试说明

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License

## 👏 致谢

- 百度AI开放平台 - 语音识别服务
- OpenAI - LLM API标准
- Konva.js - Canvas绘图库
- Ant Design - UI组件库

## 🎊 开始创作

现在一切都准备好了！执行以下命令开始你的AI语音绘画之旅：

```bash
./start.sh
```

然后访问 http://localhost:3000，用语音创作你的艺术作品！🎨✨
