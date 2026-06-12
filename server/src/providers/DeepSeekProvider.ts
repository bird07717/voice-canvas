import type { ModelProvider, ParseInput, ParseResult } from "../types.js";
import { buildSystemPrompt } from "../prompt/systemPrompt.js";

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export class DeepSeekProvider implements ModelProvider {
  isConfigured() {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  }

  async parseInstruction(input: ParseInput): Promise<ParseResult> {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("DEEPSEEK_API_KEY is not configured");
    }

    const response = await fetch(
      `${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
          messages: [
            { role: "system", content: buildSystemPrompt(input) },
            { role: "user", content: input.transcript },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`DeepSeek request failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as OpenAICompatibleResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("DeepSeek response did not include message content");
    }

    return JSON.parse(content) as ParseResult;
  }
}
