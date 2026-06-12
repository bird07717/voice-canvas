import { useState } from "react";
import type { ListenMode } from "../voice/asr";
import type { ThoughtStep } from "../voice/useVoiceLoop";

type VoicePanelProps = {
  mode: ListenMode;
  partialTranscript: string;
  lastTranscript: string;
  lastReply: string;
  error: string | null;
  thoughts: ThoughtStep[];
  onStart: () => void;
  onStop: () => void;
  onSubmitTranscript: (transcript: string) => void;
};

export function VoicePanel({
  mode,
  partialTranscript,
  lastTranscript,
  lastReply,
  error,
  thoughts,
  onStart,
  onStop,
  onSubmitTranscript,
}: VoicePanelProps) {
  const [draft, setDraft] = useState("画一个红色的圆");

  return (
    <section className="voice-panel" aria-labelledby="voice-title">
      <div>
        <p className="eyebrow">Phase 2 voice loop</p>
        <h2 id="voice-title">Speech pipeline</h2>
        <p className="panel-copy">
          Voice and text input share the same parse, validate, execute path.
        </p>
      </div>

      <div className={`mode-pill mode-pill--${mode}`}>{mode}</div>

      <div className="voice-actions">
        <button type="button" onClick={onStart}>
          Start listening
        </button>
        <button type="button" onClick={onStop}>
          Stop
        </button>
      </div>

      <form
        className="transcript-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitTranscript(draft);
        }}
      >
        <label htmlFor="transcript-input">Transcript test input</label>
        <input
          id="transcript-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit">Run transcript</button>
      </form>

      <div className="transcript-box">
        <p>Partial: {partialTranscript || "None"}</p>
        <p>Final: {lastTranscript || "None"}</p>
        <p>Reply: {lastReply || "None"}</p>
        {error ? <p className="error-text">Error: {error}</p> : null}
      </div>

      <ol className="thought-list" aria-label="Thinking stream">
        {thoughts.map((thought, index) => (
          <li key={`${thought.label}-${index}`}>
            <strong>{thought.label}</strong>
            <span>{thought.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
