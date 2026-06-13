export type AsrProviderName = "baidu" | "browser";

export type BaiduAsrConfig = {
  apiKey?: string;
  secretKey?: string;
  cuid: string;
  devPid: number;
};

export type ConfiguredBaiduAsrConfig = BaiduAsrConfig & {
  apiKey: string;
  secretKey: string;
};

const DEFAULT_BAIDU_ASR_CUID = "voice-canvas-local";
const DEFAULT_BAIDU_ASR_DEV_PID = 1537;

function readOptionalEnv(
  env: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function readNumberEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const value = readOptionalEnv(env, name);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAsrProvider(
  env: NodeJS.ProcessEnv = process.env,
): AsrProviderName {
  return env.ASR_PROVIDER === "browser" ? "browser" : "baidu";
}

export function getBaiduAsrConfig(
  env: NodeJS.ProcessEnv = process.env,
): BaiduAsrConfig {
  return {
    apiKey: readOptionalEnv(env, "BAIDU_ASR_API_KEY"),
    secretKey: readOptionalEnv(env, "BAIDU_ASR_SECRET_KEY"),
    cuid: readOptionalEnv(env, "BAIDU_ASR_CUID") ?? DEFAULT_BAIDU_ASR_CUID,
    devPid: readNumberEnv(
      env,
      "BAIDU_ASR_DEV_PID",
      DEFAULT_BAIDU_ASR_DEV_PID,
    ),
  };
}

export function isBaiduAsrConfigured(
  config: BaiduAsrConfig,
): config is ConfiguredBaiduAsrConfig {
  return Boolean(config.apiKey && config.secretKey);
}
