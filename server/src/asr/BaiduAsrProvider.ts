import {
  BaiduAsrConfigurationError,
  BaiduAsrTokenError,
  BaiduAsrTokenProvider,
} from "./BaiduAsrTokenProvider.js";
import type { AsrProvider, AsrResult, AsrTranscribeInput } from "./types.js";
import { AsrError } from "./types.js";

const BAIDU_ASR_URL = "http://vop.baidu.com/server_api";

type BaiduAsrResponse = {
  err_no?: number;
  err_msg?: string;
  corpus_no?: string;
  sn?: string;
  result?: string[];
};

export class BaiduAsrProvider implements AsrProvider {
  constructor(
    private readonly tokenProvider = new BaiduAsrTokenProvider(),
    private readonly asrUrl = BAIDU_ASR_URL,
  ) {}

  async transcribe(input: AsrTranscribeInput): Promise<AsrResult> {
    const startedAt = Date.now();
    const token = await this.getAccessToken();

    const response = await this.requestBaiduAsr(input, token);
    const transcript = response.result?.find((item) => item.trim().length > 0);

    if (response.err_no !== 0) {
      throw this.mapVendorError(response);
    }

    if (!transcript) {
      throw new AsrError(
        "ASR_EMPTY_TRANSCRIPT",
        "Baidu ASR did not return recognized text.",
        422,
        sanitizeBaiduResponse(response),
      );
    }

    return {
      transcript,
      provider: "baidu",
      durationMs: input.durationMs ?? Date.now() - startedAt,
      raw: sanitizeBaiduResponse(response),
    };
  }

  private async getAccessToken(): Promise<string> {
    try {
      return await this.tokenProvider.getAccessToken();
    } catch (error) {
      if (error instanceof BaiduAsrConfigurationError) {
        throw new AsrError("ASR_NOT_CONFIGURED", error.message, 503);
      }

      if (error instanceof BaiduAsrTokenError) {
        throw new AsrError("ASR_TOKEN_FAILED", error.message, 502, {
          status: error.status,
        });
      }

      throw error;
    }
  }

  private async requestBaiduAsr(
    input: AsrTranscribeInput,
    token: string,
  ): Promise<BaiduAsrResponse> {
    const body = {
      format: input.format,
      rate: input.rate,
      channel: input.channel,
      cuid: this.tokenProvider.getCuid(),
      token,
      speech: input.audio.toString("base64"),
      len: input.audio.byteLength,
      dev_pid: this.tokenProvider.getDevPid(),
    };

    try {
      const response = await fetch(this.asrUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as BaiduAsrResponse;

      if (!response.ok) {
        throw new AsrError(
          "ASR_VENDOR_ERROR",
          data.err_msg ?? `Baidu ASR request failed with HTTP ${response.status}`,
          502,
          sanitizeBaiduResponse(data),
        );
      }

      return data;
    } catch (error) {
      if (error instanceof AsrError) {
        throw error;
      }

      throw new AsrError(
        "ASR_NETWORK_ERROR",
        error instanceof Error ? error.message : "Baidu ASR network error.",
        502,
      );
    }
  }

  private mapVendorError(response: BaiduAsrResponse): AsrError {
    if (response.err_no === 3301) {
      return new AsrError(
        "ASR_EMPTY_TRANSCRIPT",
        response.err_msg ?? "Baidu ASR did not detect speech.",
        422,
        sanitizeBaiduResponse(response),
      );
    }

    if (response.err_no === 3302 || response.err_no === 3303) {
      return new AsrError(
        "ASR_TOKEN_FAILED",
        response.err_msg ?? "Baidu ASR token is invalid or expired.",
        502,
        sanitizeBaiduResponse(response),
      );
    }

    if (response.err_no === 3307 || response.err_no === 3311) {
      return new AsrError(
        "ASR_BAD_REQUEST",
        response.err_msg ?? "Baidu ASR rejected the audio format.",
        400,
        sanitizeBaiduResponse(response),
      );
    }

    return new AsrError(
      "ASR_VENDOR_ERROR",
      response.err_msg ?? "Baidu ASR returned an error.",
      502,
      sanitizeBaiduResponse(response),
    );
  }
}

function sanitizeBaiduResponse(response: BaiduAsrResponse): BaiduAsrResponse {
  return {
    err_no: response.err_no,
    err_msg: response.err_msg,
    corpus_no: response.corpus_no,
    sn: response.sn,
    result: response.result,
  };
}
