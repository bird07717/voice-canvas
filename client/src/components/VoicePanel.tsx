import { useState } from "react";
import type { PendingAction } from "../scene/types";
import type { ListenMode } from "../voice/asr";
import type { ResponseEnvelope } from "../voice/responseEnvelope";
import type { ThoughtStep } from "../voice/useVoiceLoop";

type VoicePanelProps = {
  mode: ListenMode;
  model: "mock" | "claude" | "deepseek";
  partialTranscript: string;
  lastTranscript: string;
  lastReply: string;
  pendingAction: PendingAction;
  clarify: ResponseEnvelope["clarify"];
  error: string | null;
  thoughts: ThoughtStep[];
  onStart: () => void;
  onStop: () => void;
  onSubmitTranscript: (transcript: string) => void;
};

export function VoicePanel({
  mode,
  model,
  partialTranscript,
  lastTranscript,
  lastReply,
  pendingAction,
  clarify,
  error,
  thoughts,
  onStart,
  onStop,
  onSubmitTranscript,
}: VoicePanelProps) {
  const [draft, setDraft] = useState("画一个红色的圆");
  const modeMeta = getModeMeta(mode);

  return (
    <section className="voice-panel" aria-labelledby="voice-title">
      <div>
        <p className="eyebrow">阶段 4</p>
        <h2 id="voice-title">语音控制台</h2>
        <p className="panel-copy">
          转写、解析、澄清、确认和执行都在这里留下可见轨迹。
        </p>
      </div>

      <div className={`mode-status mode-status--${mode}`} aria-live="polite">
        <span className="mode-light" aria-hidden="true" />
        <div>
          <strong>{modeMeta.title}</strong>
          <span>{modeMeta.detail}</span>
        </div>
        <span className="model-badge">model: {model}</span>
      </div>

      {pendingAction ? (
        <div className="pending-banner" role="status" aria-live="polite">
          <strong>等待确认</strong>
          <span>清空画布属于危险操作。说“确定”继续，说“取消”放弃。</span>
        </div>
      ) : null}

      {clarify ? (
        <div className="clarify-box" role="status" aria-live="polite">
          <strong>{clarify.question}</strong>
          {clarify.options?.length ? (
            <div className="option-row" aria-label="Clarify options">
              {clarify.options.map((option) => (
                <span key={option}>{option}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="voice-actions">
        <button type="button" onClick={onStart}>
          开始监听
        </button>
        <button type="button" onClick={onStop}>
          停止
        </button>
      </div>

      <form
        className="transcript-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitTranscript(draft);
        }}
      >
        <label htmlFor="transcript-input">转写测试输入</label>
        <input
          id="transcript-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">运行转写</button>
      </form>

      <div className="transcript-box">
        <p>实时：{partialTranscript || "无"}</p>
        <p>最终：{lastTranscript || "无"}</p>
        <p>回复：{lastReply || "无"}</p>
        {error ? <p className="error-text">错误：{error}</p> : null}
      </div>

      <ol className="thought-list" aria-label="Thinking stream">
        {thoughts.map((thought, index) => (
          <li
            className={`thought-list__item thought-list__item--${thought.tone ?? "info"}`}
            key={`${thought.label}-${index}`}
          >
            <strong>{thought.label}</strong>
            <span>{thought.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function getModeMeta(mode: ListenMode) {
  switch (mode) {
    case "idle":
      return { title: "未启动", detail: "麦克风关闭，等待手动启动。" };
    case "active":
      return { title: "active 全量解析", detail: "正在接收绘图和控制指令。" };
    case "standby":
      return { title: "standby 仅唤醒", detail: "只响应继续、开始绘图等唤醒词。" };
    case "parsing":
      return { title: "解析中", detail: "正在调用模型路由生成操作。" };
    case "executing":
      return { title: "执行中", detail: "正在校验并应用场景图操作。" };
    case "speaking":
      return { title: "播报中", detail: "正在语音回复，临时抑制回声输入。" };
  }
}
