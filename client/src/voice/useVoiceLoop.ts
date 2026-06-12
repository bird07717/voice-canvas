import { useCallback, useRef, useState } from "react";
import { parseInstruction } from "./api";
import {
  createSpeechRecognition,
  isPauseCommand,
  isResumeCommand,
  type ListenMode,
  type SpeechRecognitionLike,
} from "./asr";
import type { SceneState } from "../scene/types";
import type { useSceneStore } from "../scene/store";

type SceneApply = ReturnType<typeof useSceneStore.getState>["apply"];

type VoiceLoopOptions = {
  getScene: () => SceneState;
  apply: SceneApply;
};

export type ThoughtStep = {
  label: string;
  detail: string;
};

export function useVoiceLoop({ getScene, apply }: VoiceLoopOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const modeRef = useRef<ListenMode>("idle");
  const speakingUntilRef = useRef(0);
  const [mode, setModeState] = useState<ListenMode>("idle");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<ThoughtStep[]>([
    { label: "Ready", detail: "Start listening or use text input." },
  ]);

  const setMode = useCallback((nextMode: ListenMode) => {
    modeRef.current = nextMode;
    setModeState(nextMode);
  }, []);

  const pushThought = useCallback((label: string, detail: string) => {
    setThoughts((current) => [...current.slice(-5), { label, detail }]);
  }, []);

  const speak = useCallback(
    (text: string | null) => {
      if (!text) {
        return;
      }

      setLastReply(text);
      if (!("speechSynthesis" in window)) {
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 1;
      speakingUntilRef.current = Date.now() + 1200;
      setMode("speaking");
      utterance.onend = () => {
        if (modeRef.current === "speaking") {
          setMode("active");
        }
      };
      window.speechSynthesis.speak(utterance);
    },
    [setMode],
  );

  const handleFinalTranscript = useCallback(
    async (rawTranscript: string) => {
      const transcript = rawTranscript.trim();
      if (!transcript || Date.now() < speakingUntilRef.current) {
        return;
      }

      setLastTranscript(transcript);
      setPartialTranscript("");
      pushThought("Recognized", transcript);

      if (isPauseCommand(transcript)) {
        setMode("standby");
        pushThought("Standby", "Only resume commands will be handled.");
        speak("已暂停监听，说继续可以恢复");
        return;
      }

      if (modeRef.current === "standby") {
        if (isResumeCommand(transcript)) {
          setMode("active");
          pushThought("Active", "Full parsing resumed.");
          speak("继续监听");
        } else {
          pushThought("Ignored", "Standby mode ignored this transcript.");
        }
        return;
      }

      setMode("parsing");
      pushThought("Parsing", "Calling mock provider through /api/parse.");
      setError(null);

      try {
        const scene = getScene();
        const envelope = await parseInstruction({
          transcript,
          scene: {
            objects: scene.objects,
            groups: scene.groups,
          },
          recentTurns: [],
          canvasSize: scene.canvas,
          model: "mock",
        });

        if (envelope.clarify) {
          pushThought("Clarify", envelope.clarify.question);
          speak(envelope.clarify.question);
          setMode("active");
          return;
        }

        setMode("executing");
        pushThought("Executing", `${envelope.operations.length} operations.`);
        apply(envelope.operations);
        pushThought("Done", envelope.understanding);
        speak(envelope.reply);
        if (!envelope.reply) {
          setMode("active");
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unknown parse error";
        setError(message);
        pushThought("Error", message);
        setMode("active");
      }
    },
    [apply, getScene, pushThought, setMode, speak],
  );

  const startListening = useCallback(() => {
    setError(null);

    const recognition = createSpeechRecognition();
    if (!recognition) {
      setError("This browser does not support Web Speech API.");
      return;
    }

    recognition.onresult = (event) => {
      let partial = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          void handleFinalTranscript(transcript);
        } else {
          partial += transcript;
        }
      }

      if (partial) {
        setPartialTranscript(partial);
        pushThought("Listening", partial);
      }
    };
    recognition.onerror = (event) => {
      setError(event.error);
      pushThought("ASR error", event.error);
    };
    recognition.onend = () => {
      if (modeRef.current !== "idle") {
        recognition.start();
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setMode("active");
    pushThought("Listening", "Microphone recognition started.");
  }, [handleFinalTranscript, pushThought, setMode]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setMode("idle");
    pushThought("Stopped", "Microphone recognition stopped.");
  }, [pushThought, setMode]);

  return {
    mode,
    partialTranscript,
    lastTranscript,
    lastReply,
    error,
    thoughts,
    startListening,
    stopListening,
    handleFinalTranscript,
  };
}
