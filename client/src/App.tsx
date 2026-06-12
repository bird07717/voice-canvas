import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { DebugPanel } from "./components/DebugPanel";
import { SceneRenderer } from "./components/SceneRenderer";
import { VoicePanel } from "./components/VoicePanel";
import { formatExecReport } from "./scene/report";
import { useSceneStore } from "./scene/store";
import type { Operation } from "./scene/types";
import { useVoiceLoop } from "./voice/useVoiceLoop";

type HealthState =
  | { status: "checking" }
  | { status: "ok"; service: string }
  | { status: "error"; message: string };

function App() {
  const [health, setHealth] = useState<HealthState>({ status: "checking" });
  const scene = useSceneStore((state) => state.scene);
  const undoStack = useSceneStore((state) => state.undoStack);
  const redoStack = useSceneStore((state) => state.redoStack);
  const lastReport = useSceneStore((state) => state.lastReport);
  const apply = useSceneStore((state) => state.apply);
  const confirmPendingAction = useSceneStore((state) => state.confirmPendingAction);
  const cancelPendingAction = useSceneStore((state) => state.cancelPendingAction);
  const reportText = useMemo(() => formatExecReport(lastReport), [lastReport]);
  const voiceLoop = useVoiceLoop({
    getScene: () => useSceneStore.getState().scene,
    apply,
    confirmPendingAction,
    cancelPendingAction,
  });

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as { service?: string };
        if (!cancelled) {
          setHealth({
            status: "ok",
            service: data.service ?? "voice-canvas-server",
          });
        }
      } catch (error) {
        if (!cancelled) {
          setHealth({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    void checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="canvas-area" aria-label="Voice canvas preview">
        <div className="canvas-toolbar">
          <div>
            <p className="eyebrow">场景图画布</p>
            <h1>Voice-Canvas</h1>
          </div>
          <div className="metric-strip" aria-label="Scene metrics">
            <span>{scene.objects.length} 对象</span>
            <span>{scene.groups.length} 组合</span>
            <span>{scene.focusIds.length} 焦点</span>
          </div>
        </div>

        <div className="canvas-frame">
          <SceneRenderer scene={scene} />
          {scene.objects.length === 0 ? (
            <div className="empty-canvas">
              说“画一个红色的圆”，或用右侧转写输入进行本地验证。
            </div>
          ) : null}
        </div>
      </section>

      <aside className="sidebar">
        <div>
          <p className="eyebrow">收尾阶段</p>
          <h2>容错与思考流</h2>
          <p className="summary">
            危险操作先确认，模糊指令先澄清，standby 下只响应唤醒词。
          </p>
        </div>

        <div className={`health-card health-card--${health.status}`}>
          <span className="health-dot" aria-hidden="true" />
          <div>
            <h2>API 健康</h2>
            <p>{getHealthLabel(health)}</p>
          </div>
        </div>

        <VoicePanel
          mode={voiceLoop.mode}
          model={voiceLoop.model}
          partialTranscript={voiceLoop.partialTranscript}
          lastTranscript={voiceLoop.lastTranscript}
          lastReply={voiceLoop.lastReply}
          pendingAction={scene.pendingAction}
          clarify={voiceLoop.clarify}
          error={voiceLoop.error}
          thoughts={voiceLoop.thoughts}
          onStart={voiceLoop.startListening}
          onStop={voiceLoop.stopListening}
          onSubmitTranscript={(transcript) => {
            void voiceLoop.handleFinalTranscript(transcript);
          }}
        />

        <DebugPanel
          objectCount={scene.objects.length}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          lastReport={reportText}
          onApply={(operations: Operation[]) => apply(operations)}
        />

        <dl className="stack-list">
          <div>
            <dt>Focus</dt>
            <dd>{scene.focusIds.join(", ") || "None"}</dd>
          </div>
          <div>
            <dt>Undo stack</dt>
            <dd>{undoStack.length} snapshots</dd>
          </div>
          <div>
            <dt>Redo stack</dt>
            <dd>{redoStack.length} snapshots</dd>
          </div>
        </dl>
      </aside>
    </main>
  );
}

function getHealthLabel(health: HealthState) {
  if (health.status === "checking") {
    return "正在检查 /api/health...";
  }

  if (health.status === "error") {
    return `不可用：${health.message}`;
  }

  return `${health.service} 已响应`;
}

export default App;
