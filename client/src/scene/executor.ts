import {
  getBBox,
  moveGeometry,
  moveGeometryTo,
  resizeGeometry,
  resolvePosition,
  scaleGeometry,
  withPosition,
} from "./geometry";
import { mergeStyle, normalizeStyle } from "./colors";
import type {
  ExecReport,
  Operation,
  OpResult,
  SceneGroup,
  SceneObject,
  SceneSnapshot,
  SceneState,
} from "./types";

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 760;

export function createInitialSceneState(): SceneState {
  return {
    objects: [],
    groups: [],
    lastCreatedIds: [],
    focusIds: [],
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    pendingAction: null,
    nextSeq: 1,
  };
}

export function createSnapshot(scene: SceneState): SceneSnapshot {
  return structuredClone({
    objects: scene.objects,
    groups: scene.groups,
    lastCreatedIds: scene.lastCreatedIds,
    focusIds: scene.focusIds,
    pendingAction: scene.pendingAction,
    nextSeq: scene.nextSeq,
  });
}

export function restoreSnapshot(
  scene: SceneState,
  snapshot: SceneSnapshot,
): SceneState {
  return {
    ...structuredClone(snapshot),
    canvas: scene.canvas,
  };
}

export function applyOperations(
  scene: SceneState,
  operations: Operation[],
): { nextScene: SceneState; report: ExecReport; changed: boolean } {
  const results: OpResult[] = [];
  let nextScene = structuredClone(scene);
  let changed = false;

  for (const operation of operations) {
    const { scene: appliedScene, result, didChange } = applyOperation(
      nextScene,
      operation,
    );
    nextScene = appliedScene;
    changed = changed || didChange;
    results.push(result);
  }

  return {
    nextScene,
    changed,
    report: {
      results,
      okCount: results.filter((result) => result.status === "ok").length,
      failCount: results.filter((result) => result.status !== "ok").length,
    },
  };
}

function applyOperation(
  scene: SceneState,
  operation: Operation,
): { scene: SceneState; result: OpResult; didChange: boolean } {
  switch (operation.op) {
    case "undo":
    case "redo":
      return {
        scene,
        result: {
          status: "skipped",
          reason: `${operation.op} is handled by the history store`,
        },
        didChange: false,
      };
    case "create": {
      const id = `obj_${scene.nextSeq}`;
      const point = resolvePosition(operation.position, scene.canvas);
      const geometry = withPosition(operation.geometry, point);
      const object: SceneObject = {
        id,
        type: geometry.shape,
        geometry,
        style: normalizeStyle(operation.style),
        label: operation.label,
        groupId: operation.groupId ?? null,
        seq: scene.nextSeq,
        z: scene.nextSeq,
      };

      const nextScene = {
        ...scene,
        objects: [...scene.objects, object],
        groups: recomputeGroups(scene.groups, [...scene.objects, object]),
        lastCreatedIds: [id],
        focusIds: [id],
        nextSeq: scene.nextSeq + 1,
      };

      return {
        scene: nextScene,
        result: { status: "ok", affectedIds: [id] },
        didChange: true,
      };
    }
    case "createGroup": {
      if (scene.groups.some((group) => group.id === operation.groupId)) {
        return {
          scene,
          result: {
            status: "skipped",
            reason: `Group ${operation.groupId} already exists`,
          },
          didChange: false,
        };
      }

      const group: SceneGroup = {
        id: operation.groupId,
        label: operation.label,
        memberIds: [],
        bbox: { x: 0, y: 0, w: 0, h: 0 },
        seq: scene.nextSeq,
        createdAt: Date.now(),
      };

      return {
        scene: {
          ...scene,
          groups: [...scene.groups, group],
          nextSeq: scene.nextSeq + 1,
        },
        result: { status: "ok", affectedIds: [operation.groupId] },
        didChange: true,
      };
    }
    case "setStyle": {
      const targetIds = expandTargetIds(scene, operation.targetIds);
      const targetSet = new Set(targetIds);

      if (targetSet.size === 0) {
        return {
          scene,
          result: { status: "skipped", reason: "No matching target objects" },
          didChange: false,
        };
      }

      const objects = scene.objects.map((object) =>
        targetSet.has(object.id)
          ? { ...object, style: mergeStyle(object.style, operation.style) }
          : object,
      );

      return {
        scene: {
          ...scene,
          objects,
          focusIds: Array.from(targetSet),
          groups: recomputeGroups(scene.groups, objects),
        },
        result: { status: "ok", affectedIds: Array.from(targetSet) },
        didChange: true,
      };
    }
    case "transform": {
      const targetIds = expandTargetIds(scene, operation.targetIds);
      const targetSet = new Set(targetIds);

      if (targetSet.size === 0) {
        return {
          scene,
          result: { status: "skipped", reason: "No matching target objects" },
          didChange: false,
        };
      }

      const objects = scene.objects.map((object) => {
        if (!targetSet.has(object.id)) {
          return object;
        }

        return {
          ...object,
          geometry: applyTransformAction(
            object.geometry,
            operation.action,
            scene,
          ),
        };
      });

      return {
        scene: {
          ...scene,
          objects,
          focusIds: Array.from(targetSet),
          groups: recomputeGroups(scene.groups, objects),
        },
        result: { status: "ok", affectedIds: Array.from(targetSet) },
        didChange: true,
      };
    }
    case "delete": {
      const targetIds = expandTargetIds(scene, operation.targetIds);
      const targetSet = new Set(targetIds);

      if (targetSet.size === 0) {
        return {
          scene,
          result: { status: "skipped", reason: "No matching target objects" },
          didChange: false,
        };
      }

      const objects = scene.objects.filter((object) => !targetSet.has(object.id));
      const groups = scene.groups
        .map((group) => ({
          ...group,
          memberIds: group.memberIds.filter((id) => !targetSet.has(id)),
        }))
        .filter((group) => group.memberIds.length > 0);

      return {
        scene: {
          ...scene,
          objects,
          groups: recomputeGroups(groups, objects),
          focusIds: [],
          lastCreatedIds: scene.lastCreatedIds.filter((id) => !targetSet.has(id)),
        },
        result: { status: "ok", affectedIds: Array.from(targetSet) },
        didChange: true,
      };
    }
    case "clear": {
      return {
        scene: {
          ...scene,
          objects: [],
          groups: [],
          focusIds: [],
          lastCreatedIds: [],
          pendingAction: null,
        },
        result: { status: "ok", affectedIds: scene.objects.map((object) => object.id) },
        didChange: scene.objects.length > 0 || scene.groups.length > 0,
      };
    }
  }
}

function applyTransformAction(
  geometry: SceneObject["geometry"],
  action: Extract<Operation, { op: "transform" }>["action"],
  scene: SceneState,
) {
  switch (action.kind) {
    case "move":
      return moveGeometry(geometry, action.dx, action.dy);
    case "moveTo":
      return moveGeometryTo(geometry, resolvePosition(action.position, scene.canvas));
    case "scale":
      return scaleGeometry(geometry, action.factor);
    case "resize":
      return resizeGeometry(geometry, action.width, action.height);
    case "rotate":
      return geometry;
  }
}

function expandTargetIds(scene: SceneState, targetIds: string[]) {
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

    if (objectIds.has(targetId)) {
      resolved.add(targetId);
      continue;
    }

    const group = scene.groups.find((item) => item.id === targetId);
    if (group) {
      group.memberIds.forEach((id) => resolved.add(id));
    }
  }

  return Array.from(resolved);
}

function recomputeGroups(groups: SceneGroup[], objects: SceneObject[]) {
  const objectById = new Map(objects.map((object) => [object.id, object]));

  return groups.map((group) => {
    const memberIds = objects
      .filter((object) => object.groupId === group.id || group.memberIds.includes(object.id))
      .map((object) => object.id);
    const bboxes = memberIds
      .map((id) => objectById.get(id))
      .filter((object): object is SceneObject => Boolean(object))
      .map((object) => getBBox(object.geometry));

    if (bboxes.length === 0) {
      return { ...group, memberIds, bbox: { x: 0, y: 0, w: 0, h: 0 } };
    }

    const minX = Math.min(...bboxes.map((bbox) => bbox.x));
    const minY = Math.min(...bboxes.map((bbox) => bbox.y));
    const maxX = Math.max(...bboxes.map((bbox) => bbox.x + bbox.w));
    const maxY = Math.max(...bboxes.map((bbox) => bbox.y + bbox.h));

    return {
      ...group,
      memberIds,
      bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    };
  });
}
