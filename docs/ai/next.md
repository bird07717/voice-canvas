# 当前唯一任务

## T5.1 — 百度 ASR 配置、鉴权与密钥安全

> 阶段 5 的第一步。后端持有百度 ASR 凭据，前端永远拿不到 API Key / Secret Key。

### 目标

后端能用百度 API Key / Secret Key 换取并缓存 access token，为后续 `/api/asr`（T5.2）打底；未配置 Key 时项目仍可正常启动。

### 步骤

1. 在 `server/.env.example` 增加占位变量：
   - `BAIDU_ASR_API_KEY=`
   - `BAIDU_ASR_SECRET_KEY=`
   - `BAIDU_ASR_CUID=voice-canvas-local`
   - `BAIDU_ASR_DEV_PID=1537`
   - `ASR_PROVIDER=baidu`
2. 实现 `BaiduAsrTokenProvider`：用 API Key / Secret Key 换 access token，按 `expires_in` 做内存缓存，快过期时刷新。
3. 后端启动不强制要求百度 Key：未配置时后续 `/api/asr` 返回明确的配置错误（本任务先保证启动不崩、token provider 能识别"未配置"状态）。
4. 确认 `.env` 不入库，`.env.example` 只保留变量名和示例值。

### 涉及文件

- `server/.env.example`
- `server/src/config/*`（如需集中读取环境变量）
- `server/src/asr/*`（新增 `BaiduAsrTokenProvider`）
- `server/src/index.ts`（如需在启动时装配）

### 验收标准

- 不配置真实 Key 时 `npm run dev` 仍可启动。
- 配置 Key 后后端能成功获取并缓存 token（可用临时脚本或日志验证）。
- `git status` 不出现 `.env`。

### 验证

- `npm run typecheck`
- 启动后端确认无报错；token 获取逻辑做一次本地手动验证。

### 完成后

更新 `status.md`（T5.1 ⬜ → ✅）、`log.md` 追加记录，把本文件切换到 **T5.2**。

### 后续

T5 后续任务摘要保存在 `docs/ai/status.md` 的“T5 后续切换参考”。完成本任务后，把本文件切换到 **T5.2** 并写入完整步骤。
