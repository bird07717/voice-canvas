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
  confirmPendingAction: () => ExecReport;
  cancelPendingAction: () => ExecReport;
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
    if (needsDangerousConfirmation(scene, parsed.data)) {
      const report = createSingleResultReport(
        "skipped",
        "等待确认：清空画布需要说“确定”继续，或说“取消”放弃。",
      );
      set({
        scene: {
          ...scene,
          pendingAction: { type: "clear", ops: parsed.data },
        },
        lastReport: report,
        lastError: null,
      });
      return report;
    }

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
  confirmPendingAction: () => {
    const { scene, undoStack, redoStack } = get();
    const pendingAction = scene.pendingAction;

    if (!pendingAction) {
      const report = createSingleResultReport("skipped", "没有等待确认的操作");
      set({ lastReport: report, lastError: null });
      return report;
    }

    const sceneForExecution = { ...scene, pendingAction: null };
    const before = createSnapshot(sceneForExecution);
    const { nextScene, report, changed } = applyOperations(
      sceneForExecution,
      pendingAction.ops,
    );

    set({
      scene: nextScene,
      undoStack: changed ? [...undoStack, before] : undoStack,
      redoStack: changed ? [] : redoStack,
      lastReport: report,
      lastError: report.failCount > 0 ? "One or more operations failed" : null,
    });

    return report;
  },
  cancelPendingAction: () => {
    const { scene } = get();
    const report = createSingleResultReport("skipped", "已取消等待确认的危险操作");

    set({
      scene: { ...scene, pendingAction: null },
      lastReport: report,
      lastError: null,
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

function createSingleResultReport(
  status: "ok" | "skipped" | "failed",
  reason: string,
): ExecReport {
  if (status === "ok") {
    return {
      results: [{ status: "ok", affectedIds: [] }],
      okCount: 1,
      failCount: 0,
    };
  }

  return {
    results: [{ status, reason }],
    okCount: 0,
    failCount: status === "failed" ? 1 : 0,
  };
}

function needsDangerousConfirmation(scene: SceneState, operations: Operation[]) {
  return operations.some((operation) => {
    if (operation.op === "clear") {
      return true;
    }

    if (operation.op !== "delete" || scene.objects.length === 0) {
      return false;
    }

    const targetIds = resolveTargetIdsForGuard(scene, operation.targetIds);
    return (
      targetIds.size > 0 &&
      scene.objects.every((object) => targetIds.has(object.id))
    );
  });
}

function resolveTargetIdsForGuard(scene: SceneState, targetIds: string[]) {
  const objectIds = new Set(scene.objects.map((object) => object.id));
  const resolved = new Set<string>();

  for (const targetId of targetIds) {
    if (targetId === "__focus__") {
      scene.focusIds.forEach((id) => {
        if (objectIds.has(id)) {
          resolved.add(id);
        }
      });
      continue;
    }

    if (targetId === "__last__") {
      scene.lastCreatedIds.forEach((id) => {
        if (objectIds.has(id)) {
          resolved.add(id);
        }
      });
      continue;
    }

    if (targetId === "__largest__") {
      const largest = scene.objects.at(-1);
      if (largest) {
        resolved.add(largest.id);
      }
      continue;
    }

    if (objectIds.has(targetId)) {
      resolved.add(targetId);
      continue;
    }

    const group = scene.groups.find((item) => item.id === targetId);
    group?.memberIds.forEach((id) => {
      if (objectIds.has(id)) {
        resolved.add(id);
      }
    });
  }

  return resolved;
}

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
