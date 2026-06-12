import type { ParseInput } from "../types.js";
import { serializeCompactScene } from "./sceneSerializer.js";

export function buildSystemPrompt(input: ParseInput) {
  const canvas = input.canvasSize ?? { width: 1200, height: 760 };
  const compactScene = serializeCompactScene(input.scene ?? {});
  const recentTurns =
    input.recentTurns?.map((turn) => `${turn.role}: ${turn.content}`).join("\n") ??
    "（无）";

  return [
    "你是 Voice-Canvas 的语义编译器，只输出严格 JSON。",
    `画布尺寸：${canvas.width} x ${canvas.height}`,
    "所有图形以中心点定位。",
    "可用操作：create / createGroup / setStyle / transform / delete / clear / undo / redo。",
    "position 暂支持 absolute 与 anchor。",
    `当前场景：\n${compactScene}`,
    `最近对话：\n${recentTurns}`,
  ].join("\n\n");
}
