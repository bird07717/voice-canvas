import { MockProvider } from "./MockProvider.js";
import type { ModelProvider, ParseInput, ParseResult } from "../types.js";

export class ProviderRouter implements ModelProvider {
  private readonly mockProvider = new MockProvider();

  async parseInstruction(input: ParseInput): Promise<ParseResult> {
    return this.mockProvider.parseInstruction(input);
  }
}
