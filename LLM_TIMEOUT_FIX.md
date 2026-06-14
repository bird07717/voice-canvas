# LLM超时问题修复

## 🔴 问题描述

执行语音命令"画一只鸟"时出现错误：
```
LLM service error: LLM API call failed: Request timed out.
```

## 🔍 根本原因

在 `backend/app/services/llm_service.py` 中，OpenAI API客户端初始化和API调用时**没有设置超时参数**，导致：

1. 当LLM API响应较慢时，请求会无限等待
2. 当网络不稳定时，请求会挂起
3. 最终触发默认的超时机制，但没有友好的错误处理

## ✅ 应用的修复

### 修复1: 为主要的API调用添加超时
**位置**: `backend/app/services/llm_service.py:623-638`

```python
# 修复前
client = AsyncOpenAI(
    api_key=config.api_key,
    base_url=config.base_url
)

response = await client.chat.completions.create(
    model=config.model_name,
    messages=[...],
    temperature=0.7,
    max_tokens=2000
)

# 修复后
client = AsyncOpenAI(
    api_key=config.api_key,
    base_url=config.base_url,
    timeout=60.0  # 设置60秒超时
)

response = await client.chat.completions.create(
    model=config.model_name,
    messages=[...],
    temperature=0.7,
    max_tokens=2000,
    timeout=60.0  # 设置60秒超时
)
```

### 修复2: 为测试连接添加超时
**位置**: `backend/app/services/llm_service.py:669-683`

```python
# 修复前
client = AsyncOpenAI(
    api_key=api_key,
    base_url=base_url
)

response = await client.chat.completions.create(
    model=model_name,
    messages=[{"role": "user", "content": "Reply with exactly: OK"}],
    temperature=0,
    max_tokens=50
)

# 修复后
client = AsyncOpenAI(
    api_key=api_key,
    base_url=base_url,
    timeout=30.0  # 测试连接使用30秒超时
)

response = await client.chat.completions.create(
    model=model_name,
    messages=[{"role": "user", "content": "Reply with exactly: OK"}],
    temperature=0,
    max_tokens=50,
    timeout=30.0  # 测试连接使用30秒超时
)
```

## 📊 超时时间设置说明

| 场景 | 超时时间 | 理由 |
|------|---------|------|
| 正常API调用 | 60秒 | 考虑到复杂的绘图指令需要LLM处理较长的上下文 |
| 测试连接 | 30秒 | 测试连接只需要简单回复，应该快速响应 |

## 🎯 预期效果

修复后：
- ✅ LLM API调用会在60秒后超时并返回友好错误
- ✅ 避免请求无限挂起
- ✅ 用户会看到明确的超时提示而不是无响应
- ✅ 前端可以捕获错误并给出重试提示

## 🔧 后续优化建议

### 1. 添加重试机制
```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def call_llm_with_retry(...):
    # LLM调用逻辑
```

### 2. 添加降级策略
- 当LLM超时时，返回一个通用的"请稍后重试"消息
- 记录超时事件用于监控

### 3. 配置化超时时间
将超时时间配置放到环境变量或配置文件中：
```python
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "60"))
```

### 4. 添加日志记录
```python
import logging
logger = logging.getLogger(__name__)

logger.warning(f"LLM API call took {duration}s (timeout: {timeout}s)")
```

## 🚀 验证修复

### 1. 重启后端服务
```bash
pkill -f "uvicorn app.main:app"
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. 测试之前超时的命令
- "画一只鸟"
- "添加一个复杂的场景"

### 3. 观察行为
- 如果LLM在60秒内响应 → 正常执行
- 如果LLM超过60秒 → 返回超时错误，不会无限等待

## 📝 修改的文件

- `backend/app/services/llm_service.py` - 添加了超时参数

## 💡 注意事项

1. **60秒是合理的超时时间**：考虑到复杂的绘图场景和长上下文
2. **如果经常超时**：可能需要检查LLM服务的性能或网络连接
3. **测试环境**：确保你的LLM API配置正确且服务可达

## 🎉 总结

通过添加超时参数：
- ✅ 避免了请求无限挂起
- ✅ 提供了更好的错误处理
- ✅ 提升了用户体验

现在请重启后端服务，然后再次尝试"画一只鸟"命令。如果仍然超时，可能需要：
1. 检查LLM API的配置
2. 检查网络连接
3. 考虑增加超时时间或优化LLM提示词
