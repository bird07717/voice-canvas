# 技术 / 业务决策记录

> 只记录跨任务、长期有效的决策。每条：决策 + 理由。

## D1 — monorepo 双进程

`/client`（Vite+React+TS）+ `/server`（Express+TS），`npm run dev` 经 `concurrently` 同起。前端 `/api/*` 走 Vite 代理到 `:3001`。**理由**：前端要藏 Key 必须经后端代理，双进程本地裸跑即可满足 MVP。

## D2 — 场景图与渲染解耦

场景状态用 Zustand 持有 `SceneState`，Konva 仅作渲染层，operation 经 Zod 校验后由确定性执行器 apply。**理由**：执行层是 dumb 且可靠的"手"，与 LLM 解耦，模型输出先校验再执行，防污染。

## D3 — 统一中心点定位

rect/triangle 的 Konva 左上角 = `x - w/2, y - h/2`，circle 直接用中心。**理由**：让 LLM 只需给中心坐标，布局器/相对定位统一按中心算。

## D4 — 模型路由：Claude 主用，DeepSeek 兜底

`FallbackProvider`：默认 Claude，超时/失败/JSON 不合法自动切 DeepSeek；未配置任何 Key 时退回 Mock。前端只发 `model` 参数，切模型不切 Key。**理由**：演示稳定性优先，单模型故障不应中断闭环。

## D5 — partial 不触发解析

ASR 状态机里 partial transcript 只用于思考流展示，只有 final 进入 parsing。**理由**：避免半句话误触发模型调用与误绘图。

## D6 — 危险指令本地词匹配确认

`clear`/删除全部 → 设 `pendingAction`，下一句在**前端本地**匹配确认/取消词（不调 LLM）。**理由**：误删整画代价高，本地匹配零延迟、零模型依赖。

## D7 — 阶段 5 采用"短指令录音 + 强制时长上限"

后端百度 ASR 走短语音识别标准版 REST（`http://vop.baidu.com/server_api`），单段 < 60 秒，前端硬上限 55 秒、默认 8–12 秒窗口，不做长音频连续听写。**理由**：百度短语音标准版有 60 秒硬约束，短指令窗口足够覆盖绘图指令且避免触线。

## D8 — 浏览器 ASR 降级为备用

正式演示优先后端百度 ASR（`browser`/`baidu` 两 provider 接入同一状态机），Web Speech 仅作开发 fallback。**理由**：Web Speech 在本机频繁 `network`、漏听，不再作为唯一依赖。

## D9 — 文档体系迁移到 docs/ai

废弃并删除旧的 `docs/MVP方案.md`、`docs/大脑设计.md`、`docs/指令能力清单.md`、`docs/开发任务清单.md`、`docs/架构图.md`，改用 `AGENTS.md` + `docs/ai/`（rules/status/decisions/next/log）作为唯一 AI 控制文档。**理由**：从 Windows + Codex 迁移到 WSL，统一精简的 AI 控制文档格式，避免旧文档与当前任务入口冲突。
