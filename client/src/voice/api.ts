import { responseEnvelopeSchema, type ResponseEnvelope } from "./responseEnvelope";
import type { SceneState } from "../scene/types";

export type ParseRequest = {
  transcript: string;
  scene: Pick<SceneState, "objects" | "groups">;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  canvasSize: SceneState["canvas"];
  model: "mock" | "claude" | "deepseek";
};

export async function parseInstruction(
  request: ParseRequest,
): Promise<ResponseEnvelope> {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Parse request failed with HTTP ${response.status}`);
  }

  const data = await response.json();
  return responseEnvelopeSchema.parse(data);
}
