import { FallbackProvider } from "./FallbackProvider.js";
import type { ModelProvider, ParseInput, ParseResult } from "../types.js";

export class ProviderRouter implements ModelProvider {
  private readonly fallbackProvider = new FallbackProvider();

  async parseInstruction(input: ParseInput): Promise<ParseResult> {
    return this.fallbackProvider.parseInstruction(input);
  }
}
