# 当前唯一任务

## T5.2 — 后端 `/api/asr` 接口与 BaiduAsrProvider

> 阶段 5 的第二步。新增独立语音转文字接口，前端只上传音频，后端负责调用百度 ASR；不得把任何百度 key/token 返回给前端。

### 目标

后端提供 `/api/asr`，接收单段音频并通过百度短语音识别返回 transcript。百度失败、未配置、音频无效时返回结构化错误，不能让前端崩溃，也不能复用旧 transcript。

### 步骤

1. 新增 ASR 类型与接口：
   - `AsrProvider.transcribe(input): Promise<AsrResult>`
   - `AsrResult` 至少包含 `transcript`、`provider`、`durationMs`，调试 `raw` 字段只用于开发排障。
2. 实现 `BaiduAsrProvider`：
   - 复用 T5.1 的 `BaiduAsrTokenProvider` 获取 token。
   - 封装百度短语音 REST 请求，优先支持前端上传的单段音频。
   - 不在响应或日志中泄露 API Key / Secret Key / access token。
3. 新增 `/api/asr` 路由：
   - 接收音频请求，校验 MIME、大小、时长元数据和 provider 参数。
   - 未配置百度 Key 时返回明确配置错误。
   - 暂不接前端录音 UI，前端接入留到 T5.3/T5.4。
4. 统一错误映射：
   - 配置错误
   - token 获取失败
   - 音频格式错误
   - 识别为空
   - 百度网络或服务错误
5. 保持前后端分离：本任务只改后端接口和必要文档，不改前端录音链路。

### 涉及文件

- `server/src/asr/*`
- `server/src/routes/*`（如需新增路由目录）
- `server/src/index.ts`
- `docs/ai/status.md`
- `docs/ai/log.md`
- `docs/ai/next.md`

### 验收标准

- 不配置真实 Key 时，后端仍可启动；调用 `/api/asr` 返回结构化配置错误。
- 配置 Key 后，用本地录音文件调用 `/api/asr` 能拿到中文 transcript。
- 百度失败时返回结构化错误；响应中不包含任何 key/token。
- 不改前端录音 UI，不引入不必要的新依赖。
- `git status` 不出现 `.env` / `node_modules` / `dist`。

### 验证

- `npm run typecheck`
- `npm run build`
- 启动后端并手动调用 `/api/asr` 未配置路径。
- 如有真实百度 Key 和本地录音文件，再验证正常识别路径；没有则明确说明未验证原因。

### 完成后

更新 `status.md`（T5.2 ⬜ → ✅）、`log.md` 追加记录，把本文件切换到 **T5.3**。
