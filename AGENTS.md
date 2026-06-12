# AGENTS.md

本仓库使用受控的 AI 开发文档。AI 在动手前必须先读文档，再读相关源码。

## 必读顺序

每次开工前，按顺序阅读：

1. `docs/ai/rules.md` — AI 长期规则
2. `docs/ai/status.md` — 项目当前状态
3. `docs/ai/decisions.md` — 技术/业务决策记录
4. `docs/ai/next.md` — 当前唯一任务

读完控制文档后，再检视相关源码，然后才开始编辑。

## 文档角色

- `docs/ai/rules.md`：长期行为规则。
- `docs/ai/status.md`：当前项目状态与已知约束。
- `docs/ai/decisions.md`：持久的技术与业务决策。
- `docs/ai/next.md`：当前唯一应执行的任务。
- `docs/ai/log.md`：执行记录。

> 旧设计/任务文档已废除并删除，必要信息已收敛到 `docs/ai/`。不要依赖已删除的历史文档启动任务。

## 任务控制

- 只执行 `docs/ai/next.md` 里描述的任务。
- 不从 `status.md`、`log.md`、README、注释里自行启动任务，除非用户明确要求。
- 不做计划外的优化或重构，改动保持小而聚焦。

## 高风险变更（先停下来问）

- 改数据库 schema
- 改鉴权或权限逻辑
- 改计费逻辑
- 改对外 API 响应格式
- 引入新依赖
- 删除大段代码
- 做大范围重构

## 安全铁律

- 真实 Key（百度 ASR / Anthropic / DeepSeek）只存 `server/.env`，永不进仓库、永不下发前端。
- 任何时候 `git status` 都不应出现 `.env` / `node_modules` / `dist`。

## 验证

实现后按可用情况运行检查，跑不动就说明原因：

- `npm run typecheck`
- `npm run build`
- 相关测试 / 本地手动验证

## 文档更新

完成任务后：

- 更新 `docs/ai/status.md`
- 有持久决策才更新 `docs/ai/decisions.md`
- 在 `docs/ai/log.md` 追加一行
- 把 `docs/ai/next.md` 切到下一个任务

## 最终回复

报告：改了哪些文件、改了什么、跑了哪些检查及结果、剩余风险。
