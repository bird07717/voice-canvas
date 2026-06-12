export type ParseModel = "mock" | "claude" | "deepseek";

export type ParseInput = {
  transcript: string;
  scene?: {
    objects?: unknown[];
    groups?: unknown[];
  };
  recentTurns?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  canvasSize?: {
    width: number;
    height: number;
  };
  model?: ParseModel;
};

export type ParseResult = {
  understanding: string;
  operations: unknown[];
  reply: string | null;
  clarify: {
    question: string;
    options?: string[];
  } | null;
};

export interface ModelProvider {
  parseInstruction(input: ParseInput): Promise<ParseResult>;
}
