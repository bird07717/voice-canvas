import type { SceneStyle } from "./types";

const COLOR_MAP: Record<string, string> = {
  红: "#ef4444",
  红色: "#ef4444",
  蓝: "#2563eb",
  蓝色: "#2563eb",
  绿: "#16a34a",
  绿色: "#16a34a",
  黄: "#facc15",
  黄色: "#facc15",
  黑: "#111827",
  黑色: "#111827",
  白: "#ffffff",
  白色: "#ffffff",
  灰: "#94a3b8",
  灰色: "#94a3b8",
  橙: "#f97316",
  橙色: "#f97316",
  紫: "#8b5cf6",
  紫色: "#8b5cf6",
  天蓝: "#38bdf8",
  浅黄: "#fde68a",
  红棕: "#b45309",
  棕: "#92400e",
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

export const DEFAULT_STYLE: Required<SceneStyle> = {
  fill: "#e2e8f0",
  stroke: "#172033",
  strokeWidth: 0,
  opacity: 1,
};

export function normalizeStyle(style: SceneStyle = {}): Required<SceneStyle> {
  return {
    fill: normalizeColor(style.fill) ?? DEFAULT_STYLE.fill,
    stroke:
      style.stroke === null
        ? null
        : (normalizeColor(style.stroke) ?? DEFAULT_STYLE.stroke),
    strokeWidth: style.strokeWidth ?? DEFAULT_STYLE.strokeWidth,
    opacity: style.opacity ?? DEFAULT_STYLE.opacity,
  };
}

export function mergeStyle(
  current: Required<SceneStyle>,
  patch: SceneStyle,
): Required<SceneStyle> {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [
        key,
        key === "fill" || key === "stroke" ? normalizeColor(value) : value,
      ]),
    ),
  };
}

function normalizeColor(color: unknown): string | null | undefined {
  if (color === null) {
    return null;
  }

  if (typeof color !== "string") {
    return undefined;
  }

  const trimmed = color.trim();

  if (HEX_COLOR.test(trimmed)) {
    return trimmed;
  }

  return COLOR_MAP[trimmed] ?? undefined;
}
