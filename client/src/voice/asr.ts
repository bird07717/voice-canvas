export type ListenMode = "idle" | "active" | "standby" | "parsing" | "executing" | "speaking";

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence?: number };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function createSpeechRecognition() {
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

  if (!Recognition) {
    return null;
  }

  const recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;

  return recognition;
}

export function isPauseCommand(transcript: string) {
  return /暂停|停一下|暂停监听/.test(transcript);
}

export function isResumeCommand(transcript: string) {
  return /继续|开始绘图|继续监听|醒醒/.test(transcript);
}
