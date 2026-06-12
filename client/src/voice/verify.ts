import { applyOperations } from "../scene/executor";
import type { SceneState } from "../scene/types";
import { responseEnvelopeSchema } from "./responseEnvelope";

const mockEnvelope = {
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
};

export function mockVoiceLoop(transcript: string, scene: SceneState) {
  if (!transcript.includes("圆")) {
    return scene;
  }

  const envelope = responseEnvelopeSchema.parse(mockEnvelope);
  return applyOperations(scene, envelope.operations).nextScene;
}
