# AI 执行记录

> 倒序追加，每条一行：日期 — 任务 — 做了什么 — 结果。

- 2026-06-12 — 删除旧文档 — 删除旧的 MVP/大脑设计/指令能力清单/开发任务清单/架构图文档；把 T5 后续切换摘要收敛到 `docs/ai/status.md`，清理 `AGENTS.md` 与 `docs/ai/*` 中的旧文档引用。— 完成，未改动代码。
- 2026-06-12 — 文档控制校准 — 明确旧 `docs/` 文档不再作为控制入口，补充 `架构图.md` 的历史背景角色，修正 MVP 中 Windows 开发环境的过期描述；`next.md` 继续指向 T5.1。— 完成，未改动代码。
- 2026-06-12 — 文档迁移 — 从 Windows/Codex 迁到 WSL，重构为 `AGENTS.md` + `docs/ai/`（rules/status/decisions/next/log）；阶段 0–4 收敛为简记，阶段 5（T5 系列）作为当前推进重点；`next.md` 指向 T5.1。— 完成，未改动代码。

## 历史阶段（迁移前归档简记）

- 阶段 0｜工程前置 — monorepo 骨架、Key 管理、README、首个 PR。✅
- 阶段 1｜执行层闭环 — 场景图 schema/store、Konva 渲染、create/setStyle/transform/delete 执行器、撤销重做、调试面板。✅
- 阶段 2｜语音最小闭环 — 响应包络校验、MockProvider+fixtures、ClaudeProvider、拆解 prompt、Web Speech + ASR 状态机、完整闭环。✅
- 阶段 3｜大脑深度层 — relative 布局、row/grid 布局、Group 整体操作、复杂拆解、上下文指代、FallbackProvider。✅
- 阶段 4｜容错与收尾 — 危险指令确认、clarify 澄清、容错兜底、standby 打磨、思考流侧边栏、UI 打磨。✅（T4.7 评测表 / T4.8 交付物未完）
