import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { DebugPanel } from "./components/DebugPanel";
import { SceneRenderer } from "./components/SceneRenderer";
import { useSceneStore } from "./scene/store";
import type { ExecReport, Operation } from "./scene/types";

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
  const reportText = useMemo(() => formatReport(lastReport), [lastReport]);

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
            <p className="eyebrow">Scene graph canvas</p>
            <h1>Voice-Canvas</h1>
          </div>
          <div className="metric-strip" aria-label="Scene metrics">
            <span>{scene.objects.length} objects</span>
            <span>{scene.groups.length} groups</span>
            <span>{scene.focusIds.length} focused</span>
          </div>
        </div>

        <div className="canvas-frame">
          <SceneRenderer scene={scene} />
          {scene.objects.length === 0 ? (
            <div className="empty-canvas">
              Use the debug controls to feed operations into the executor.
            </div>
          ) : null}
        </div>
      </section>

      <aside className="sidebar">
        <div>
          <p className="eyebrow">Phase 1</p>
          <h2>Manual execution loop</h2>
          <p className="summary">
            Scene state, Zod validation, deterministic operations, and Konva
            rendering now share one contract.
          </p>
        </div>

        <div className={`health-card health-card--${health.status}`}>
          <span className="health-dot" aria-hidden="true" />
          <div>
            <h2>API health</h2>
            <p>{getHealthLabel(health)}</p>
          </div>
        </div>

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

function formatReport(report: ExecReport | null) {
  if (!report) {
    return "No operations executed yet.";
  }

  return `${report.okCount} ok, ${report.failCount} skipped or failed`;
}

function getHealthLabel(health: HealthState) {
  if (health.status === "checking") {
    return "Checking /api/health...";
  }

  if (health.status === "error") {
    return `Unavailable: ${health.message}`;
  }

  return `${health.service} responded`;
}

export default App;
