import express from "express";
import { BaiduAsrProvider } from "../asr/BaiduAsrProvider.js";
import { AsrError, type AsrAudioFormat, type AsrTranscribeInput } from "../asr/types.js";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 60_000;
const DEFAULT_RATE = 16_000;
const DEFAULT_CHANNEL = 1;

const SUPPORTED_FORMATS = new Set<AsrAudioFormat>(["pcm", "wav", "amr", "m4a"]);

type JsonAsrBody = {
  provider?: string;
  audioBase64?: string;
  audio?: string;
  format?: string;
  mimeType?: string;
  rate?: number | string;
  channel?: number | string;
  durationMs?: number | string;
};

export function createAsrRouter(asrProvider = new BaiduAsrProvider()) {
  const router = express.Router();

  router.post(
    "/",
    express.raw({
      type: ["audio/*", "application/octet-stream"],
      limit: MAX_AUDIO_BYTES,
    }),
    async (req, res, next) => {
      try {
        const input = parseTranscribeInput(req);
        const result = await asrProvider.transcribe(input);

        res.json({
          transcript: result.transcript,
          provider: result.provider,
          durationMs: result.durationMs,
          raw: result.raw,
        });
      } catch (error) {
        if (error instanceof AsrError) {
          res.status(error.status).json({
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          });
          return;
        }

        next(error);
      }
    },
  );

  return router;
}

function parseTranscribeInput(req: express.Request): AsrTranscribeInput {
  const provider = readString(req.query.provider) ?? readString(req.header("x-asr-provider")) ?? "baidu";

  if (provider !== "baidu") {
    throw new AsrError(
      "ASR_UNSUPPORTED_PROVIDER",
      `Unsupported ASR provider: ${provider}`,
      400,
    );
  }

  if (Buffer.isBuffer(req.body)) {
    return parseRawInput(req);
  }

  return parseJsonInput(req.body as JsonAsrBody);
}

function parseRawInput(req: express.Request): AsrTranscribeInput {
  const audio = req.body as Buffer;
  validateAudioSize(audio);

  const format = parseFormat(
    readString(req.query.format) ??
      readString(req.header("x-audio-format")) ??
      inferFormat(req.header("content-type")),
  );
  const durationMs = parseOptionalNumber(
    readString(req.query.durationMs) ?? readString(req.header("x-audio-duration-ms")),
    "durationMs",
  );

  validateDuration(durationMs);

  return {
    audio,
    format,
    mimeType: req.header("content-type") ?? undefined,
    rate: parsePositiveNumber(
      readString(req.query.rate) ?? readString(req.header("x-audio-rate")),
      "rate",
      DEFAULT_RATE,
    ),
    channel: parsePositiveNumber(
      readString(req.query.channel) ?? readString(req.header("x-audio-channel")),
      "channel",
      DEFAULT_CHANNEL,
    ),
    durationMs,
    provider: "baidu",
  };
}

function parseJsonInput(body: JsonAsrBody): AsrTranscribeInput {
  if (!body || typeof body !== "object") {
    throw new AsrError("ASR_BAD_REQUEST", "JSON body is required.", 400);
  }

  if (body.provider && body.provider !== "baidu") {
    throw new AsrError(
      "ASR_UNSUPPORTED_PROVIDER",
      `Unsupported ASR provider: ${body.provider}`,
      400,
    );
  }

  const audioBase64 = body.audioBase64 ?? body.audio;
  if (!audioBase64 || typeof audioBase64 !== "string") {
    throw new AsrError("ASR_BAD_REQUEST", "audioBase64 is required.", 400);
  }

  const audio = decodeBase64Audio(audioBase64);
  validateAudioSize(audio);

  const durationMs = parseOptionalNumber(body.durationMs, "durationMs");
  validateDuration(durationMs);

  return {
    audio,
    format: parseFormat(body.format ?? inferFormat(body.mimeType)),
    mimeType: body.mimeType,
    rate: parsePositiveNumber(body.rate, "rate", DEFAULT_RATE),
    channel: parsePositiveNumber(body.channel, "channel", DEFAULT_CHANNEL),
    durationMs,
    provider: "baidu",
  };
}

function decodeBase64Audio(value: string): Buffer {
  const normalized = value.includes(",") ? value.split(",").pop() : value;
  const audio = Buffer.from(normalized ?? "", "base64");

  if (audio.byteLength === 0) {
    throw new AsrError("ASR_BAD_REQUEST", "Audio payload is empty.", 400);
  }

  return audio;
}

function validateAudioSize(audio: Buffer) {
  if (audio.byteLength === 0) {
    throw new AsrError("ASR_BAD_REQUEST", "Audio payload is empty.", 400);
  }

  if (audio.byteLength > MAX_AUDIO_BYTES) {
    throw new AsrError(
      "ASR_AUDIO_TOO_LARGE",
      "Audio payload is too large.",
      413,
      { maxBytes: MAX_AUDIO_BYTES },
    );
  }
}

function validateDuration(durationMs?: number) {
  if (durationMs !== undefined && durationMs > MAX_DURATION_MS) {
    throw new AsrError(
      "ASR_AUDIO_TOO_LONG",
      "Audio duration must be 60 seconds or less.",
      400,
      { maxDurationMs: MAX_DURATION_MS },
    );
  }
}

function parseFormat(value?: string): AsrAudioFormat {
  const normalized = value?.toLowerCase();

  if (normalized && SUPPORTED_FORMATS.has(normalized as AsrAudioFormat)) {
    return normalized as AsrAudioFormat;
  }

  throw new AsrError(
    "ASR_BAD_REQUEST",
    "Audio format must be one of: pcm, wav, amr, m4a.",
    400,
  );
}

function inferFormat(mimeType?: string): string | undefined {
  if (!mimeType) {
    return "wav";
  }

  if (mimeType.includes("pcm")) {
    return "pcm";
  }

  if (mimeType.includes("wav") || mimeType.includes("wave")) {
    return "wav";
  }

  if (mimeType.includes("amr")) {
    return "amr";
  }

  if (mimeType.includes("m4a") || mimeType.includes("mp4")) {
    return "m4a";
  }

  return undefined;
}

function parsePositiveNumber(
  value: number | string | undefined,
  field: string,
  fallback: number,
): number {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AsrError("ASR_BAD_REQUEST", `${field} must be a positive number.`, 400);
  }

  return parsed;
}

function parseOptionalNumber(
  value: number | string | undefined,
  field: string,
): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AsrError("ASR_BAD_REQUEST", `${field} must be a non-negative number.`, 400);
  }

  return parsed;
}

function readString(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return readString(value[0]);
  }

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
