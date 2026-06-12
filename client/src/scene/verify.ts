import { operationSchema } from "./schema";
import { applyOperations, createInitialSceneState } from "./executor";
import { useSceneStore } from "./store";
import { responseEnvelopeSchema } from "../voice/responseEnvelope";
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

console.log("Scene schema and executor verification passed");
