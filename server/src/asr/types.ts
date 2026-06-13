export type AsrProviderName = "baidu";

export type AsrAudioFormat = "pcm" | "wav" | "amr" | "m4a";

export type AsrTranscribeInput = {
  audio: Buffer;
  format: AsrAudioFormat;
  mimeType?: string;
  rate: number;
  channel: number;
  durationMs?: number;
  provider?: AsrProviderName;
};

export type AsrResult = {
  transcript: string;
  provider: AsrProviderName;
  durationMs: number;
  raw?: unknown;
};

export interface AsrProvider {
  transcribe(input: AsrTranscribeInput): Promise<AsrResult>;
}

export type AsrErrorCode =
  | "ASR_NOT_CONFIGURED"
  | "ASR_TOKEN_FAILED"
  | "ASR_BAD_REQUEST"
  | "ASR_AUDIO_TOO_LARGE"
  | "ASR_AUDIO_TOO_LONG"
  | "ASR_UNSUPPORTED_PROVIDER"
  | "ASR_EMPTY_TRANSCRIPT"
  | "ASR_VENDOR_ERROR"
  | "ASR_NETWORK_ERROR";

export class AsrError extends Error {
  constructor(
    readonly code: AsrErrorCode,
    message: string,
    readonly status = 500,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
