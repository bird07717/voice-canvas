# 当前唯一任务

## T5.3 — 前端录音链路：MediaRecorder / Web Audio + 60 秒上限

> 阶段 5 的第三步。前端在不依赖 Web Speech 的情况下采集用户语音，并上传到后端 `/api/asr`；仍不允许前端接触任何百度 key/token。

### 目标

新增前端后端 ASR 录音模式：用浏览器麦克风采集短指令音频，控制单段时长，上传到 `/api/asr`，拿到 transcript 后先保留为可验证链路；完整状态机接入与 provider 切换留到 T5.4。

### 步骤

1. 新增前端 ASR client：
   - 封装 `POST /api/asr`，支持上传 Blob/ArrayBuffer。
   - 读取后端结构化错误并转为前端可展示错误。
2. 新增录音封装：
   - 使用 `navigator.mediaDevices.getUserMedia` 获取麦克风。
   - 使用 `MediaRecorder` 或 Web Audio 采集单句音频。
   - 默认短指令窗口控制在 8–12 秒；硬上限 55 秒强制停止。
3. 做基础音频保护：
   - 记录时长、大小、MIME。
   - 过短、空白或无有效音量时不上传，提示“没有听到有效语音”。
   - 任意单段不得超过 55 秒。
4. 将录音阶段信息暴露给现有 UI/思考流可用：
   - `recording`
   - `uploading`
   - `transcribing`
   - `transcript`
   - `asrError`
5. 本任务只打通“录音 → `/api/asr` → transcript”前端链路；不替换现有 Web Speech 主状态机，不做完整 provider 切换。

### 涉及文件

- `client/src/voice/*`
- `client/src/components/VoicePanel.tsx`（如需加开发期验证入口）
- `client/src/App.tsx`（如需传递状态）
- `docs/ai/status.md`
- `docs/ai/log.md`
- `docs/ai/next.md`

### 验收标准

- 浏览器 Web Speech 关闭或不可用时，前端能录音并调用 `/api/asr` 获得 transcript 或结构化错误。
- 单段录音硬停止不超过 55 秒。
- 空白/过短音频不会触发后端上传或不会进入 LLM 解析。
- 前端代码不出现百度 API Key / Secret Key / access token。
- 不改变现有 Web Speech 主流程；完整状态机接入留到 T5.4。
- `git status` 不出现 `.env` / `node_modules` / `dist`。

### 验证

- `npm run typecheck`
- `npm run build`
- 启动前后端，手动录制一段短语音并确认请求到 `/api/asr`。
- 验证空白/过短/超过 55 秒保护。

### 完成后

更新 `status.md`（T5.3 ⬜ → ✅）、`log.md` 追加记录，把本文件切换到 **T5.4**。
