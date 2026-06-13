import {
  getBaiduAsrConfig,
  isBaiduAsrConfigured,
  type BaiduAsrConfig,
  type ConfiguredBaiduAsrConfig,
} from "../config/env.js";

const BAIDU_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token";
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

type BaiduTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

export class BaiduAsrConfigurationError extends Error {
  readonly code = "BAIDU_ASR_NOT_CONFIGURED";

  constructor() {
    super(
      "Baidu ASR is not configured. Set BAIDU_ASR_API_KEY and BAIDU_ASR_SECRET_KEY in server/.env.",
    );
  }
}

export class BaiduAsrTokenError extends Error {
  readonly code = "BAIDU_ASR_TOKEN_FAILED";

  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class BaiduAsrTokenProvider {
  private cachedToken: CachedToken | null = null;

  constructor(
    private readonly config: BaiduAsrConfig = getBaiduAsrConfig(),
    private readonly tokenUrl = BAIDU_TOKEN_URL,
  ) {}

  isConfigured(): boolean {
    return isBaiduAsrConfigured(this.config);
  }

  getCuid(): string {
    return this.config.cuid;
  }

  getDevPid(): number {
    return this.config.devPid;
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!isBaiduAsrConfigured(this.config)) {
      throw new BaiduAsrConfigurationError();
    }

    if (!forceRefresh && this.cachedToken && !this.isExpiring(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    const token = await this.fetchAccessToken(this.config);
    this.cachedToken = token;
    return token.accessToken;
  }

  private isExpiring(token: CachedToken): boolean {
    return Date.now() + TOKEN_REFRESH_SKEW_MS >= token.expiresAtMs;
  }

  private async fetchAccessToken(
    config: ConfiguredBaiduAsrConfig,
  ): Promise<CachedToken> {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.apiKey,
      client_secret: config.secretKey,
    });

    const response = await fetch(`${this.tokenUrl}?${params.toString()}`, {
      method: "POST",
    });

    const data = (await response.json()) as BaiduTokenResponse;

    if (!response.ok) {
      throw new BaiduAsrTokenError(
        data.error_description ??
          data.error ??
          `Baidu ASR token request failed with HTTP ${response.status}`,
        response.status,
      );
    }

    if (!data.access_token || typeof data.expires_in !== "number") {
      throw new BaiduAsrTokenError(
        data.error_description ??
          data.error ??
          "Baidu ASR token response did not include access_token and expires_in",
        response.status,
      );
    }

    return {
      accessToken: data.access_token,
      expiresAtMs: Date.now() + data.expires_in * 1000,
    };
  }
}
