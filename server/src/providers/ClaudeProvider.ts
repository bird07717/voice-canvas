import type { ModelProvider, ParseInput, ParseResult } from "../types.js";
import { buildSystemPrompt } from "../prompt/systemPrompt.js";

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
};

export class ClaudeProvider implements ModelProvider {
  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async parseInstruction(input: ParseInput): Promise<ParseResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const response = await fetch(
      `${process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"}/v1/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929",
          max_tokens: 1200,
          system: buildSystemPrompt(input),
          messages: [
            {
              role: "user",
              content: input.transcript,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Claude request failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content?.find((item) => item.type === "text")?.text;

    if (!text) {
      throw new Error("Claude response did not include text content");
    }

    return JSON.parse(text) as ParseResult;
  }
}
