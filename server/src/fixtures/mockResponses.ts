import type { ParseResult } from "../types.js";

export const mockResponses: Record<string, ParseResult> = {
  drawRedCircle: {
    understanding: "在画布中央创建一个红色的圆",
    operations: [
      {
        op: "create",
        geometry: { shape: "circle", radius: 60 },
        style: { fill: "红", stroke: "黑", strokeWidth: 2 },
        position: { mode: "anchor", region: "center" },
        label: "红色的圆",
      },
    ],
    reply: "画好了一个红色的圆",
    clarify: null,
  },
  paintBlue: {
    understanding: "把当前对象改成蓝色",
    operations: [
      {
        op: "setStyle",
        targetIds: ["__focus__"],
        style: { fill: "蓝", stroke: "黑", strokeWidth: 2 },
      },
    ],
    reply: "已经把它变成蓝色了",
    clarify: null,
  },
  moveLeft: {
    understanding: "把当前对象向左移动一点",
    operations: [
      {
        op: "transform",
        targetIds: ["__focus__"],
        action: { kind: "move", dx: -60, dy: 0 },
      },
    ],
    reply: "已经往左挪了一点",
    clarify: null,
  },
  scaleCurrentUp: {
    understanding: "把当前对象放大一点",
    operations: [
      {
        op: "transform",
        targetIds: ["__focus__"],
        action: { kind: "scale", factor: 1.3 },
      },
    ],
    reply: "已经把它放大了一点",
    clarify: null,
  },
  paintLastGreen: {
    understanding: "把刚才创建的对象改成绿色",
    operations: [
      {
        op: "setStyle",
        targetIds: ["__last__"],
        style: { fill: "绿", stroke: "黑", strokeWidth: 2 },
      },
    ],
    reply: "已经把刚才那个改成绿色了",
    clarify: null,
  },
  deleteLargest: {
    understanding: "删除画布上最大的对象",
    operations: [{ op: "delete", targetIds: ["__largest__"] }],
    reply: "已经删掉最大的那个了",
    clarify: null,
  },
  undo: {
    understanding: "撤销上一步操作",
    operations: [{ op: "undo" }],
    reply: "已撤销上一步",
    clarify: null,
  },
  clearCanvas: {
    understanding: "清空当前画布",
    operations: [{ op: "clear" }],
    reply: "确定要清空画布吗？说确定继续，说取消放弃",
    clarify: null,
  },
  clarifyAmbiguousObject: {
    understanding: "用户想修改对象颜色，但指代不明确",
    operations: [],
    reply: null,
    clarify: {
      question: "你是指哪一个对象？",
      options: ["圆", "方块"],
    },
  },
  deleteMissingObject: {
    understanding: "尝试删除一个不存在的对象",
    operations: [{ op: "delete", targetIds: ["obj_10"] }],
    reply: "画布上没有找到第十个对象",
    clarify: null,
  },
  drawHouse: {
    understanding: "用一组基础图形创建一个房子",
    operations: [
      { op: "createGroup", groupId: "grp_house", label: "房子" },
      {
        op: "create",
        groupId: "grp_house",
        tempId: "wall",
        geometry: { shape: "rect", width: 220, height: 160 },
        style: { fill: "浅黄", stroke: "黑", strokeWidth: 2 },
        position: { mode: "anchor", region: "middle-right", dx: -170 },
        label: "墙体",
      },
      {
        op: "create",
        groupId: "grp_house",
        geometry: { shape: "triangle", width: 260, height: 120 },
        style: { fill: "红棕", stroke: "黑", strokeWidth: 2 },
        position: { mode: "relative", ref: "wall", side: "above", gap: 0 },
        label: "屋顶",
      },
      {
        op: "create",
        groupId: "grp_house",
        geometry: { shape: "rect", width: 54, height: 86 },
        style: { fill: "棕", stroke: "黑", strokeWidth: 2 },
        position: { mode: "relative", ref: "wall", side: "below", gap: -86 },
        label: "门",
      },
      {
        op: "create",
        groupId: "grp_house",
        geometry: { shape: "rect", width: 46, height: 46 },
        style: { fill: "天蓝", stroke: "黑", strokeWidth: 2 },
        position: { mode: "relative", ref: "wall", side: "left", gap: -82, dy: -28 },
        label: "左窗",
      },
      {
        op: "create",
        groupId: "grp_house",
        geometry: { shape: "rect", width: 46, height: 46 },
        style: { fill: "天蓝", stroke: "黑", strokeWidth: 2 },
        position: { mode: "relative", ref: "wall", side: "right", gap: -82, dy: -28 },
        label: "右窗",
      },
    ],
    reply: "画好了一个房子",
    clarify: null,
  },
  drawFiveCircles: {
    understanding: "创建五个由小到大的圆",
    operations: [28, 42, 56, 70, 84].map((radius, index) => ({
      op: "create",
      geometry: { shape: "circle", radius },
      style: { fill: ["红", "橙", "黄", "绿", "蓝"][index] },
      position: {
        mode: "layout",
        layoutId: "rainbow-row",
        type: "row",
        index,
        count: 5,
        gap: 28,
        align: "middle",
      },
      label: `圆${index + 1}`,
    })),
    reply: "画好了五个由小到大的圆",
    clarify: null,
  },
  drawThreeCircles: {
    understanding: "创建三个并排的圆",
    operations: [0, 1, 2].map((index) => ({
      op: "create",
      geometry: { shape: "circle", radius: 44 },
      style: { fill: ["红", "黄", "蓝"][index], stroke: "黑", strokeWidth: 2 },
      position: {
        mode: "layout",
        layoutId: "three-circles",
        type: "row",
        index,
        count: 3,
        gap: 32,
        align: "middle",
      },
      label: `圆${index + 1}`,
    })),
    reply: "画好了三个圆",
    clarify: null,
  },
  drawGridCircles: {
    understanding: "创建一个 3x3 的网格圆",
    operations: Array.from({ length: 9 }, (_, index) => ({
      op: "create",
      geometry: { shape: "circle", radius: 28 },
      style: { fill: "天蓝", stroke: "黑", strokeWidth: 2 },
      position: {
        mode: "layout",
        layoutId: "grid-3x3",
        type: "grid",
        index,
        count: 9,
        cols: 3,
        gap: 24,
      },
      label: `网格圆${index + 1}`,
    })),
    reply: "画好了一个三乘三的网格圆",
    clarify: null,
  },
  circleLeftOfHouse: {
    understanding: "在房子左边创建一个圆",
    operations: [
      {
        op: "create",
        geometry: { shape: "circle", radius: 46 },
        style: { fill: "绿", stroke: "黑", strokeWidth: 2 },
        position: { mode: "relative", ref: "grp_house", side: "left", gap: 60 },
        label: "房子左边的圆",
      },
    ],
    reply: "已经在房子左边画了一个圆",
    clarify: null,
  },
  fallback: {
    understanding: "没有识别为绘图指令",
    operations: [],
    reply: "没听懂这句绘图指令，可以再说一遍，或者试试说画一个红色的圆",
    clarify: null,
  },
};
