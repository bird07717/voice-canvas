import { MockProvider } from "./MockProvider.js";
import { ClaudeProvider } from "./ClaudeProvider.js";
import type { ModelProvider, ParseInput, ParseResult } from "../types.js";

export class ProviderRouter implements ModelProvider {
  private readonly mockProvider = new MockProvider();
  private readonly claudeProvider = new ClaudeProvider();

  async parseInstruction(input: ParseInput): Promise<ParseResult> {
    if (input.model === "claude" && this.claudeProvider.isConfigured()) {
      return this.claudeProvider.parseInstruction(input);
    }

    return this.mockProvider.parseInstruction(input);
  }
}
