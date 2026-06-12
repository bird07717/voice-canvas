import { useEffect, useState } from "react";
import "./App.css";

type HealthState =
  | { status: "checking" }
  | { status: "ok"; service: string }
  | { status: "error"; message: string };

function App() {
  const [health, setHealth] = useState<HealthState>({ status: "checking" });

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
      <section className="canvas-placeholder" aria-label="Voice canvas preview">
        <div className="canvas-grid">
          <div className="canvas-mark">Voice Canvas</div>
        </div>
      </section>

      <aside className="sidebar">
        <div>
          <p className="eyebrow">Phase 0 skeleton</p>
          <h1>Voice-Canvas</h1>
          <p className="summary">
            React, Vite, and Express are wired together. The drawing engine comes
            next in phase 1.
          </p>
        </div>

        <div className={`health-card health-card--${health.status}`}>
          <span className="health-dot" aria-hidden="true" />
          <div>
            <h2>API health</h2>
            <p>{getHealthLabel(health)}</p>
          </div>
        </div>

        <dl className="stack-list">
          <div>
            <dt>Client</dt>
            <dd>React + TypeScript + Vite</dd>
          </div>
          <div>
            <dt>Canvas stack</dt>
            <dd>Konva + react-konva installed</dd>
          </div>
          <div>
            <dt>Server</dt>
            <dd>Express API on port 3001</dd>
          </div>
        </dl>
      </aside>
    </main>
  );
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
