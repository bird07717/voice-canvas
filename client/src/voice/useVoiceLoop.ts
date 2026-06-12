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
import { formatIssueReason } from "../scene/report";
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
  tone?: "info" | "success" | "warning" | "danger" | "muted";
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
    { label: "待命", detail: "等待语音或文本转写输入。", tone: "muted" },
  ]);

  const setMode = useCallback((nextMode: ListenMode) => {
    modeRef.current = nextMode;
    setModeState(nextMode);
  }, []);

  const pushThought = useCallback(
    (
      label: string,
      detail: string,
      tone: ThoughtStep["tone"] = "info",
    ) => {
      setThoughts((current) => [...current.slice(-5), { label, detail, tone }]);
    },
    [],
  );

  const appendRecentTurns = useCallback((turns: RecentTurn[]) => {
    recentTurnsRef.current = [...recentTurnsRef.current, ...turns].slice(-6);
  }, []);

  const speak = useCallback(
    (text: string | null, afterMode: ListenMode = "active") => {
      if (!text) {
        return;
      }

      setLastReply(text);
      if (!("speechSynthesis" in window)) {
        setMode(afterMode);
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
          setMode(afterMode);
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
      pushThought("已识别", transcript, "info");

      const pendingAction = getScene().pendingAction;
      if (pendingAction) {
        if (isConfirmCommand(transcript)) {
          setMode("executing");
          const report = confirmPendingAction();
          pushThought("已确认", `${report.okCount} 个操作已执行。`, "success");
          speak(report.okCount > 0 ? "已确认，画布已清空" : "已确认，但没有可执行的内容");
          if (report.okCount === 0) {
            setMode("active");
          }
          return;
        }

        cancelPendingAction();
        setClarify(null);
        pushThought("已取消", "待确认的危险操作已取消。", "warning");

        if (isCancelCommand(transcript)) {
          speak("已取消这次清空操作");
          return;
        }

        pushThought("继续处理", "已取消待确认操作，继续处理当前转写。", "info");
      }

      if (isPauseCommand(transcript)) {
        setMode("standby");
        pushThought("暂停态", "只响应继续、开始绘图等唤醒词。", "warning");
        speak("已暂停监听，说继续可以恢复", "standby");
        return;
      }

      if (modeRef.current === "standby") {
        if (isResumeCommand(transcript)) {
          setMode("active");
          pushThought("监听态", "已恢复完整解析。", "success");
          speak("继续监听");
        } else {
          pushThought("已忽略", "standby 下不调用模型，也不执行绘图。", "muted");
        }
        return;
      }

      setMode("parsing");
      pushThought("模型解析", "通过 /api/parse 调用 mock 路由。", "info");
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
          pushThought("需要澄清", envelope.clarify.question, "warning");
          speak(envelope.clarify.question);
          return;
        }

        setMode("executing");
        pushThought(
          "执行器",
          summarizeOperations(envelope.operations, envelope.understanding),
          "info",
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
          pushThought("等待确认", "危险操作已进入 pendingAction。", "warning");
          speak("确定要清空画布吗？说确定继续，说取消放弃");
          return;
        }

        if (report.failCount > 0) {
          const reason = envelope.reply ?? formatIssueReason(report);
          pushThought("容错反馈", reason || "部分操作被跳过。", "warning");
          speak(reason);
          if (!reason) {
            setMode("active");
          }
          return;
        }

        pushThought("已执行", envelope.understanding, "success");
        speak(envelope.reply);
        if (!envelope.reply) {
          setMode("active");
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unknown parse error";
        setError(message);
        pushThought("错误", message, "danger");
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
        pushThought("正在听", partial, "info");
      }
    };
    recognition.onerror = (event) => {
      setError(event.error);
      pushThought("识别错误", event.error, "danger");
    };
    recognition.onend = () => {
      if (modeRef.current !== "idle") {
        recognition.start();
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setMode("active");
    pushThought("正在听", "麦克风识别已启动。", "success");
  }, [handleFinalTranscript, pushThought, setMode]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setMode("idle");
    pushThought("已停止", "麦克风识别已停止。", "muted");
  }, [pushThought, setMode]);

  return {
    mode,
    partialTranscript,
    lastTranscript,
    lastReply,
    clarify,
    error,
    thoughts,
    model: "mock" as const,
    startListening,
    stopListening,
    handleFinalTranscript,
  };
}

function summarizeOperations(
  operations: ResponseEnvelope["operations"],
  understanding: string,
) {
  if (operations.length === 0) {
    return `${understanding}；没有生成绘图操作。`;
  }

  const layoutCount = operations.filter(
    (operation) => operation.op === "create" && operation.position.mode === "layout",
  ).length;
  const groupCount = operations.filter(
    (operation) => operation.op === "createGroup",
  ).length;
  const parts = [`${operations.length} 个操作`];

  if (layoutCount > 0) {
    parts.push(`${layoutCount} 个交给布局器`);
  }

  if (groupCount > 0) {
    parts.push(`${groupCount} 个组合索引`);
  }

  return `${parts.join("，")}；${understanding}`;
}
