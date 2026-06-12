import { ClaudeProvider } from "./ClaudeProvider.js";
import { DeepSeekProvider } from "./DeepSeekProvider.js";
import { MockProvider } from "./MockProvider.js";
import type { ModelProvider, ParseInput, ParseResult } from "../types.js";

export class FallbackProvider implements ModelProvider {
  constructor(
    private readonly claudeProvider = new ClaudeProvider(),
    private readonly deepSeekProvider = new DeepSeekProvider(),
    private readonly mockProvider = new MockProvider(),
  ) {}

  async parseInstruction(input: ParseInput): Promise<ParseResult> {
    if (input.model === "mock") {
      return this.mockProvider.parseInstruction(input);
    }

    if (input.model === "deepseek") {
      return this.deepSeekProvider.isConfigured()
        ? this.deepSeekProvider.parseInstruction(input)
        : this.mockProvider.parseInstruction(input);
    }

    if (this.claudeProvider.isConfigured()) {
      try {
        return await this.claudeProvider.parseInstruction(input);
      } catch (error) {
        if (this.deepSeekProvider.isConfigured()) {
          return this.deepSeekProvider.parseInstruction(input);
        }
        throw error;
      }
    }

    if (this.deepSeekProvider.isConfigured()) {
      return this.deepSeekProvider.parseInstruction(input);
    }

    return this.mockProvider.parseInstruction(input);
  }
}
