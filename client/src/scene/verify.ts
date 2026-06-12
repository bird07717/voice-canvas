import { operationSchema } from "./schema";
import { applyOperations, createInitialSceneState } from "./executor";
import { useSceneStore } from "./store";
import { responseEnvelopeSchema } from "../voice/responseEnvelope";
import { mockVoiceLoop } from "../voice/verify";
import type { Operation } from "./types";

const validCreate: Operation = {
  op: "create",
  geometry: { shape: "circle", radius: 48 },
  style: { fill: "红" },
  position: { mode: "anchor", region: "center" },
  label: "红色的圆",
};

const validResult = operationSchema.safeParse(validCreate);
if (!validResult.success) {
  throw new Error("Expected valid create operation to pass Zod validation");
}

const invalidResult = operationSchema.safeParse({
  ...validCreate,
  unexpected: true,
});
if (invalidResult.success) {
  throw new Error("Expected extra operation fields to be rejected");
}

const envelopeResult = responseEnvelopeSchema.safeParse({
  understanding: "创建红色圆",
  operations: [validCreate],
  reply: "画好了",
  clarify: null,
});
if (!envelopeResult.success) {
  throw new Error("Expected response envelope to pass validation");
}

const invalidEnvelope = responseEnvelopeSchema.safeParse({
  understanding: "缺少字段",
  operations: [],
  reply: null,
});
if (invalidEnvelope.success) {
  throw new Error("Expected response envelope without clarify to fail");
}

let scene = createInitialSceneState();
let report = applyOperations(scene, [validCreate]);
scene = report.nextScene;
if (scene.objects.length !== 1 || report.report.okCount !== 1) {
  throw new Error("Expected create operation to add one object");
}

const targetId = scene.objects[0]?.id;
if (!targetId) {
  throw new Error("Expected created object id");
}

report = applyOperations(scene, [
  { op: "setStyle", targetIds: [targetId], style: { fill: "蓝" } },
  { op: "transform", targetIds: [targetId], action: { kind: "move", dx: -40, dy: 0 } },
  { op: "delete", targetIds: [targetId] },
]);
scene = report.nextScene;

if (scene.objects.length !== 0 || report.report.okCount !== 3) {
  throw new Error("Expected style, transform, and delete operations to apply");
}

const store = useSceneStore.getState();
store.apply([validCreate]);
if (useSceneStore.getState().scene.objects.length !== 1) {
  throw new Error("Expected store apply to create one object");
}

useSceneStore.getState().apply([{ op: "undo" }]);
if (useSceneStore.getState().scene.objects.length !== 0) {
  throw new Error("Expected undo to restore the empty scene");
}

useSceneStore.getState().apply([{ op: "redo" }]);
if (useSceneStore.getState().scene.objects.length !== 1) {
  throw new Error("Expected redo to restore the created object");
}

const voiceScene = mockVoiceLoop("画一个红色的圆", createInitialSceneState());
if (voiceScene.objects.length !== 1) {
  throw new Error("Expected voice loop verification to create one object");
}

const relativeScene = applyOperations(createInitialSceneState(), [
  {
    op: "create",
    tempId: "base",
    geometry: { shape: "circle", radius: 50 },
    position: { mode: "anchor", region: "center" },
    label: "基础圆",
  },
  {
    op: "create",
    geometry: { shape: "rect", width: 80, height: 80 },
    position: { mode: "relative", ref: "base", side: "left", gap: 40 },
    label: "左侧方块",
  },
]).nextScene;
if (relativeScene.objects.length !== 2) {
  throw new Error("Expected relative create to add two objects");
}
if ((relativeScene.objects[1]?.geometry.x ?? 0) >= (relativeScene.objects[0]?.geometry.x ?? 0)) {
  throw new Error("Expected relative object to be placed on the left");
}

const rowScene = applyOperations(createInitialSceneState(), [
  ...[0, 1, 2, 3, 4].map((index) => ({
    op: "create" as const,
    geometry: { shape: "circle" as const, radius: 20 + index * 10 },
    position: {
      mode: "layout" as const,
      layoutId: "row-1",
      type: "row" as const,
      index,
      count: 5,
      gap: 20,
    },
    label: `圆${index + 1}`,
  })),
]).nextScene;
if (rowScene.objects.length !== 5) {
  throw new Error("Expected row layout to create five objects");
}
if (!rowScene.objects.every((object, index, objects) => index === 0 || object.geometry.x > objects[index - 1].geometry.x)) {
  throw new Error("Expected row layout x positions to increase");
}

const groupScene = applyOperations(createInitialSceneState(), [
  { op: "createGroup", groupId: "grp_test", label: "测试组" },
  {
    op: "create",
    groupId: "grp_test",
    geometry: { shape: "rect", width: 100, height: 80 },
    position: { mode: "anchor", region: "center" },
    label: "组成员",
  },
  {
    op: "transform",
    targetIds: ["grp_test"],
    action: { kind: "move", dx: -80, dy: 0 },
  },
]).nextScene;
if ((groupScene.objects[0]?.geometry.x ?? 0) >= 600) {
  throw new Error("Expected group move to move member left");
}

console.log("Scene schema and executor verification passed");
