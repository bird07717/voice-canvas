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
  undo: {
    understanding: "撤销上一步操作",
    operations: [{ op: "undo" }],
    reply: "已撤销上一步",
    clarify: null,
  },
  drawHouse: {
    understanding: "用一组基础图形创建一个房子",
    operations: [
      { op: "createGroup", groupId: "grp_house", label: "房子" },
      {
        op: "create",
        groupId: "grp_house",
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
        position: { mode: "anchor", region: "middle-right", dx: -170, dy: -140 },
        label: "屋顶",
      },
      {
        op: "create",
        groupId: "grp_house",
        geometry: { shape: "rect", width: 54, height: 86 },
        style: { fill: "棕", stroke: "黑", strokeWidth: 2 },
        position: { mode: "anchor", region: "middle-right", dx: -170, dy: 44 },
        label: "门",
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
        mode: "absolute",
        x: 360 + index * 120,
        y: 380,
      },
      label: `圆${index + 1}`,
    })),
    reply: "画好了五个由小到大的圆",
    clarify: null,
  },
  fallback: {
    understanding: "没有识别为绘图指令",
    operations: [],
    reply: "这句我还不会画，可以先试试说画一个红色的圆",
    clarify: null,
  },
};
