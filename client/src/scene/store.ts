import { create } from "zustand";
import { operationListSchema } from "./schema";
import {
  applyOperations,
  createInitialSceneState,
  createSnapshot,
  restoreSnapshot,
} from "./executor";
import type { ExecReport, Operation, SceneSnapshot, SceneState } from "./types";

type SceneStore = {
  scene: SceneState;
  undoStack: SceneSnapshot[];
  redoStack: SceneSnapshot[];
  lastReport: ExecReport | null;
  lastError: string | null;
  apply: (operations: Operation[]) => ExecReport;
  resetDemo: () => void;
};

export const useSceneStore = create<SceneStore>((set, get) => ({
  scene: createInitialSceneState(),
  undoStack: [],
  redoStack: [],
  lastReport: null,
  lastError: null,
  apply: (operations) => {
    const parsed = operationListSchema.safeParse(operations);

    if (!parsed.success) {
      const report: ExecReport = {
        results: [{ status: "failed", reason: parsed.error.message }],
        okCount: 0,
        failCount: 1,
      };
      set({ lastReport: report, lastError: parsed.error.message });
      return report;
    }

    if (parsed.data.length === 1 && parsed.data[0].op === "undo") {
      return undoScene();
    }

    if (parsed.data.length === 1 && parsed.data[0].op === "redo") {
      return redoScene();
    }

    const { scene, undoStack, redoStack } = get();
    const before = createSnapshot(scene);
    const { nextScene, report, changed } = applyOperations(scene, parsed.data);

    set({
      scene: nextScene,
      undoStack: changed ? [...undoStack, before] : undoStack,
      redoStack: changed ? [] : redoStack,
      lastReport: report,
      lastError: report.failCount > 0 ? "One or more operations failed" : null,
    });

    return report;
  },
  resetDemo: () => {
    const { scene, undoStack } = get();
    set({
      scene: createInitialSceneState(),
      undoStack: [...undoStack, createSnapshot(scene)],
      redoStack: [],
      lastReport: null,
      lastError: null,
    });
  },
}));

export function undoScene(): ExecReport {
  const { scene, undoStack, redoStack } = useSceneStore.getState();
  const snapshot = undoStack.at(-1);

  if (!snapshot) {
    const report: ExecReport = {
      results: [{ status: "skipped", reason: "Nothing to undo" }],
      okCount: 0,
      failCount: 1,
    };
    useSceneStore.setState({ lastReport: report, lastError: "Nothing to undo" });
    return report;
  }

  const report: ExecReport = {
    results: [{ status: "ok", affectedIds: snapshot.focusIds }],
    okCount: 1,
    failCount: 0,
  };

  useSceneStore.setState({
    scene: restoreSnapshot(scene, snapshot),
    undoStack: undoStack.slice(0, -1),
    redoStack: [...redoStack, createSnapshot(scene)],
    lastReport: report,
    lastError: null,
  });

  return report;
}

export function redoScene(): ExecReport {
  const { scene, undoStack, redoStack } = useSceneStore.getState();
  const snapshot = redoStack.at(-1);

  if (!snapshot) {
    const report: ExecReport = {
      results: [{ status: "skipped", reason: "Nothing to redo" }],
      okCount: 0,
      failCount: 1,
    };
    useSceneStore.setState({ lastReport: report, lastError: "Nothing to redo" });
    return report;
  }

  const report: ExecReport = {
    results: [{ status: "ok", affectedIds: snapshot.focusIds }],
    okCount: 1,
    failCount: 0,
  };

  useSceneStore.setState({
    scene: restoreSnapshot(scene, snapshot),
    undoStack: [...undoStack, createSnapshot(scene)],
    redoStack: redoStack.slice(0, -1),
    lastReport: report,
    lastError: null,
  });

  return report;
}
