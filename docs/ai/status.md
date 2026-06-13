# 项目当前状态

> 更新时间：2026-06-13
> 当前分支：`feature/t5-2-baidu-asr-api`

## 一句话

纯语音控制绘图工具。阶段 0–4 已完成（执行层、语音闭环、大脑深度层、容错与思考流），当前处在**阶段 5：后端百度 ASR 补强**；T5.1/T5.2 已完成，下一步是 T5.3 前端录音链路。

## 工程形态

- monorepo：`/client`（Vite + React + TS + Konva + Zustand + Zod）、`/server`（Express + TS）。
- 当前开发环境已迁移到 WSL；`npm run dev` 一条命令起前后端；Vite `/api/*` 代理到 `localhost:3001`。
- 验证命令：`npm run typecheck`、`npm run build`。
- AI 文档控制入口已迁移到 `AGENTS.md` + `docs/ai/`；旧设计/任务文档已删除，必要信息已收敛到本目录。

## 已完成能力（T0–T4，简记）

- **执行层**：`SceneState`/`Operation` 类型与 Zod schema（`client/src/scene/`），Konva 渲染（中心点定位），create/setStyle/transform/delete 执行器，撤销/重做快照栈，调试面板。
- **语音闭环**：Web Speech API 识别 + ASR 状态机（idle/active/standby/parsing/executing/speaking），`/api/parse` 后端代理，MockProvider + fixtures，ClaudeProvider，拆解 system prompt + 紧凑场景图序列化。
- **大脑深度层**：确定性布局器（relative 四方向、row/grid layout），Group 组合体整体操作，复杂指令拆解，上下文指代消解（L4），FallbackProvider（Claude 主用 → DeepSeek 兜底，见 `server/src/providers/FallbackProvider.ts`）。
- **容错与思考流**：危险指令二次确认（pendingAction，前端本地词匹配），clarify 澄清对话，缺参/越界等容错兜底，standby 暂停/继续，实时思考流侧边栏（`useVoiceLoop.ts` 的 `thoughts`），UI 与监听状态显示。

## 当前关键文件

- 前端语音主循环：`client/src/voice/useVoiceLoop.ts`、`client/src/voice/asr.ts`、`client/src/voice/api.ts`。
- 后端入口与路由：`server/src/index.ts`（已有 `/api/health`、`/api/parse`、`/api/asr`），`server/src/providers/*`、`server/src/asr/*`、`server/src/routes/asr.ts`。
- 环境变量样例：`server/.env.example`（已有 Anthropic / DeepSeek / Baidu ASR 占位变量，无真实 key）。

## 阶段 5 进度

后端 ASR 主路径：前端录音 → 后端藏百度 Key → 换 token → 调百度短语音识别 REST → transcript 回流到现有 `/api/parse` 链路。约束：单段音频 < 60 秒，前端硬上限 55 秒、默认 8–12 秒短指令窗口。

- **T5.1** ✅ 百度 ASR 配置、鉴权与密钥安全（`.env.example` 增变量、`BaiduAsrTokenProvider` token 缓存）。
- **T5.2** ✅ 后端 `/api/asr` 接口 + `BaiduAsrProvider`（音频转写、`err_no` 错误映射）。
- **T5.3** ⬜ 前端录音链路（MediaRecorder/Web Audio + 55 秒硬上限 + 空白检测）。
- **T5.4** ⬜ ASR 模式切换（browser/baidu）、状态机接入、失败降级。
- **T5.5** ⬜ 侧边栏 DevTools 门控（`VITE_ENABLE_DEV_TOOLS`），正式 UI 隐藏调试入口。
- **T5.6** ⬜ 本地验证矩阵 + README / `docs/ai` 文档更新。
- **T5.7** ⬜ 阶段 5 PR 检查点。

依赖链：T5.1 → T5.2 → T5.3 → T5.4 →（T5.5 并行）→ T5.6 → T5.7。每次完成当前任务后，把 `next.md` 切换到下一项并写入该项的完整步骤。

## T5 后续切换参考

- **T5.2**：新增 `AsrProvider.transcribe(input): Promise<AsrResult>`，实现 `BaiduAsrProvider` 与 `/api/asr`；接收单段音频 Blob/File，校验 MIME/大小/时长/provider；映射百度 `err_no`/`err_msg` 为配置错误、token 失败、音频格式错误、识别为空、网络错误；响应不得包含 key。
- **T5.3**：新增前端后端 ASR 录音模式；用 `getUserMedia` + `MediaRecorder` 或 Web Audio 采集短指令；默认 8–12 秒窗口，55 秒硬停止；做音量/空白/过短检测；录音思考流为 `recording → uploading → transcribing → transcript`。
- **T5.4**：把 `browser` 与 `baidu` provider 接入同一 ASR 状态机；配置 `VITE_ASR_PROVIDER=baidu|browser` 或后端配置下发；新增 `recording/uploading/transcribing/asrError` 状态；失败不复用旧 transcript，不误执行。
- **T5.5**：新增 `VITE_ENABLE_DEV_TOOLS=true|false`；把执行层调试、转写测试输入、ASR raw response 放入 DevTools gate；正式 UI 隐藏调试入口。
- **T5.6**：README 增补百度 ASR 配置与验证矩阵；覆盖未配置 key、配置错误、正常识别、空白录音、超过 55 秒、百度网络失败、浏览器 ASR fallback；更新 `docs/ai/status.md` / `docs/ai/log.md` / `docs/ai/next.md`。
- **T5.7**：阶段 5 PR 检查点；PR 只覆盖后端 ASR 补强，说明功能描述、实现思路、测试方式；能演示关闭/绕开 Web Speech 后，中文语音经百度 ASR 转写并进入现有解析与画布执行链路。

## 已知约束 / 风险

- 浏览器 Web Speech 在本机频繁报 `network`、漏听，这是引入百度 ASR 的根因；Web Speech 保留为开发 fallback。
- 百度短语音：60 秒上限、对采样率/声道/格式（16kHz 单声道 PCM/WAV）有要求。
- 当前 `/api/parse` 前端写死 `model: "mock"`（见 `useVoiceLoop.ts`），尚未接真实模型路由到 UI。
- 百度 token 获取已用本地 `server/.env` 验证通过；真实 key 不入仓库。
- `/api/asr` 已用生成的 16k 单声道 WAV 验证 JSON 与 raw audio 两条后端路径；尚未用真实用户中文录音验证。
