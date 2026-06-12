import { useCallback, useRef, useState } from "react";
import { parseInstruction } from "./api";
import {
  createSpeechRecognition,
  isCancelCommand,
  isConfirmCommand,
  isPauseCommand,
  isResumeCommand,
  type ListenMode,
  type SpeechRecognitionLike,
} from "./asr";
import type { ResponseEnvelope } from "./responseEnvelope";
import type { SceneState } from "../scene/types";
import type { useSceneStore } from "../scene/store";

type SceneApply = ReturnType<typeof useSceneStore.getState>["apply"];
type SceneConfirmPendingAction = ReturnType<
  typeof useSceneStore.getState
>["confirmPendingAction"];
type SceneCancelPendingAction = ReturnType<
  typeof useSceneStore.getState
>["cancelPendingAction"];
type RecentTurn = { role: "user" | "assistant"; content: string };

type VoiceLoopOptions = {
  getScene: () => SceneState;
  apply: SceneApply;
  confirmPendingAction: SceneConfirmPendingAction;
  cancelPendingAction: SceneCancelPendingAction;
};

export type ThoughtStep = {
  label: string;
  detail: string;
};

export function useVoiceLoop({
  getScene,
  apply,
  confirmPendingAction,
  cancelPendingAction,
}: VoiceLoopOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const modeRef = useRef<ListenMode>("idle");
  const speakingUntilRef = useRef(0);
  const recentTurnsRef = useRef<RecentTurn[]>([]);
  const [mode, setModeState] = useState<ListenMode>("idle");
  const [partialTranscript, setPartialTranscript] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [clarify, setClarify] = useState<ResponseEnvelope["clarify"]>(null);
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

  const appendRecentTurns = useCallback((turns: RecentTurn[]) => {
    recentTurnsRef.current = [...recentTurnsRef.current, ...turns].slice(-6);
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

      const pendingAction = getScene().pendingAction;
      if (pendingAction) {
        if (isConfirmCommand(transcript)) {
          setMode("executing");
          const report = confirmPendingAction();
          pushThought("Confirmed", `${report.okCount} operations executed.`);
          speak(report.okCount > 0 ? "已确认，画布已清空" : "已确认，但没有可执行的内容");
          if (report.okCount === 0) {
            setMode("active");
          }
          return;
        }

        cancelPendingAction();
        setClarify(null);
        pushThought("Canceled", "Pending dangerous action was canceled.");

        if (isCancelCommand(transcript)) {
          speak("已取消这次清空操作");
          return;
        }

        pushThought("Continuing", "Handling the new transcript normally.");
      }

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
      setClarify(null);
      setError(null);

      try {
        const scene = getScene();
        const envelope = await parseInstruction({
          transcript,
          scene: {
            objects: scene.objects,
            groups: scene.groups,
          },
          recentTurns: recentTurnsRef.current,
          canvasSize: scene.canvas,
          model: "mock",
        });

        if (envelope.clarify) {
          setClarify(envelope.clarify);
          appendRecentTurns([
            { role: "user", content: transcript },
            { role: "assistant", content: envelope.clarify.question },
          ]);
          pushThought("Clarify", envelope.clarify.question);
          speak(envelope.clarify.question);
          setMode("active");
          return;
        }

        setMode("executing");
        pushThought(
          "Executing",
          `${envelope.operations.length} operations from ${envelope.understanding}.`,
        );
        const report = apply(envelope.operations);
        appendRecentTurns([
          { role: "user", content: transcript },
          {
            role: "assistant",
            content: envelope.reply ?? envelope.understanding,
          },
        ]);
        const pending = getScene().pendingAction;
        if (pending) {
          pushThought("Pending", "Dangerous action is waiting for confirmation.");
          speak("确定要清空画布吗？说确定继续，说取消放弃");
          return;
        }

        if (report.failCount > 0) {
          const reason = report.results
            .filter((result) => result.status !== "ok")
            .map((result) => result.reason)
            .join("；");
          pushThought("Fallback", reason || "Some operations were skipped.");
          speak(reason || envelope.reply);
          if (!reason && !envelope.reply) {
            setMode("active");
          }
          return;
        }

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
    [
      appendRecentTurns,
      apply,
      cancelPendingAction,
      confirmPendingAction,
      getScene,
      pushThought,
      setMode,
      speak,
    ],
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
    clarify,
    error,
    thoughts,
    startListening,
    stopListening,
    handleFinalTranscript,
  };
}
