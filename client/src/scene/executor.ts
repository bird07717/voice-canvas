import {
  getBBox,
  getDraftSize,
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
  CreateOperation,
  BBox,
  CanvasSize,
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
  const tempIds = new Map<string, string>();
  const layoutPoints = computeLayoutPoints(operations, scene.canvas);

  for (const operation of operations) {
    const { scene: appliedScene, result, didChange } = applyOperation(
      nextScene,
      operation,
      tempIds,
      layoutPoints,
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
  tempIds: Map<string, string>,
  layoutPoints: Map<Operation, { x: number; y: number }>,
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
      const point =
        layoutPoints.get(operation) ??
        resolveCreatePosition(operation, scene, tempIds);
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

      if (operation.tempId) {
        tempIds.set(operation.tempId, id);
      }

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
      const groupTargets = operation.targetIds
        .map((id) => scene.groups.find((group) => group.id === id))
        .filter((group): group is SceneGroup => Boolean(group));
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

        const group = groupTargets.find((candidate) =>
          candidate.memberIds.includes(object.id),
        );

        return {
          ...object,
          geometry: group
            ? applyGroupTransformAction(object.geometry, operation.action, group, scene)
            : applyTransformAction(object.geometry, operation.action, scene),
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

function applyGroupTransformAction(
  geometry: SceneObject["geometry"],
  action: Extract<Operation, { op: "transform" }>["action"],
  group: SceneGroup,
  scene: SceneState,
) {
  if (action.kind === "scale") {
    const center = getBBoxCenter(group.bbox);
    const dx = geometry.x - center.x;
    const dy = geometry.y - center.y;
    const scaled = scaleGeometry(geometry, action.factor);

    return moveGeometryTo(scaled, {
      x: center.x + dx * action.factor,
      y: center.y + dy * action.factor,
    });
  }

  if (action.kind === "moveTo") {
    const currentCenter = getBBoxCenter(group.bbox);
    const nextCenter = resolvePosition(action.position, scene.canvas);
    return moveGeometry(geometry, nextCenter.x - currentCenter.x, nextCenter.y - currentCenter.y);
  }

  return applyTransformAction(geometry, action, scene);
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

    if (targetId === "__last__") {
      scene.lastCreatedIds.forEach((id) => {
        if (objectIds.has(id)) {
          resolved.add(id);
        }
      });
      continue;
    }

    if (targetId === "__largest__") {
      const largest = [...scene.objects].sort(
        (a, b) => getBBox(b.geometry).w * getBBox(b.geometry).h - getBBox(a.geometry).w * getBBox(a.geometry).h,
      )[0];
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

function resolveCreatePosition(
  operation: CreateOperation,
  scene: SceneState,
  tempIds: Map<string, string>,
) {
  if (operation.position.mode === "relative") {
    const refId = tempIds.get(operation.position.ref) ?? operation.position.ref;
    const refBox = findRefBBox(scene, refId);
    const size = getDraftSize(operation.geometry);

    if (refBox) {
      return resolveRelativePosition(
        refBox,
        size,
        operation.position.side,
        operation.position.gap ?? 40,
        operation.position.dx ?? 0,
        operation.position.dy ?? 0,
      );
    }

    return resolvePosition({ mode: "anchor", region: "center" }, scene.canvas);
  }

  return resolvePosition(operation.position, scene.canvas);
}

function findRefBBox(scene: SceneState, refId: string) {
  const object = scene.objects.find((candidate) => candidate.id === refId);
  if (object) {
    return getBBox(object.geometry);
  }

  return scene.groups.find((group) => group.id === refId)?.bbox ?? null;
}

function resolveRelativePosition(
  refBox: BBox,
  size: { w: number; h: number },
  side: "left" | "right" | "above" | "below",
  gap: number,
  dx: number,
  dy: number,
) {
  const refCenter = getBBoxCenter(refBox);

  switch (side) {
    case "left":
      return {
        x: refBox.x - gap - size.w / 2 + dx,
        y: refCenter.y + dy,
      };
    case "right":
      return {
        x: refBox.x + refBox.w + gap + size.w / 2 + dx,
        y: refCenter.y + dy,
      };
    case "above":
      return {
        x: refCenter.x + dx,
        y: refBox.y - gap - size.h / 2 + dy,
      };
    case "below":
      return {
        x: refCenter.x + dx,
        y: refBox.y + refBox.h + gap + size.h / 2 + dy,
      };
  }
}

function computeLayoutPoints(operations: Operation[], canvas: CanvasSize) {
  const points = new Map<Operation, { x: number; y: number }>();
  const createOps = operations.filter(
    (operation): operation is CreateOperation => operation.op === "create",
  );
  const byLayout = new Map<string, CreateOperation[]>();

  for (const operation of createOps) {
    if (operation.position.mode !== "layout") {
      continue;
    }

    const current = byLayout.get(operation.position.layoutId) ?? [];
    current.push(operation);
    byLayout.set(operation.position.layoutId, current);
  }

  for (const members of byLayout.values()) {
    const first = members[0];
    if (!first || first.position.mode !== "layout") {
      continue;
    }

    const ordered = [...members].sort((a, b) => {
      if (a.position.mode !== "layout" || b.position.mode !== "layout") {
        return 0;
      }
      return a.position.index - b.position.index;
    });
    const gap = first.position.gap ?? 30;
    const origin =
      first.position.origin
        ? resolvePosition(
            {
              mode: "anchor",
              region: first.position.origin.region,
              dx: first.position.origin.dx,
              dy: first.position.origin.dy,
            },
            canvas,
          )
        : { x: canvas.width / 2, y: canvas.height / 2 };

    if (first.position.type === "row") {
      const sizes = ordered.map((operation) => getDraftSize(operation.geometry));
      const totalWidth =
        sizes.reduce((sum, size) => sum + size.w, 0) + gap * (sizes.length - 1);
      let cursor = origin.x - totalWidth / 2;

      ordered.forEach((operation, index) => {
        const size = sizes[index];
        points.set(operation, { x: cursor + size.w / 2, y: origin.y });
        cursor += size.w + gap;
      });
    } else {
      const cols = first.position.cols ?? Math.ceil(Math.sqrt(ordered.length));
      const maxSize = ordered
        .map((operation) => getDraftSize(operation.geometry))
        .reduce(
          (max, size) => ({
            w: Math.max(max.w, size.w),
            h: Math.max(max.h, size.h),
          }),
          { w: 0, h: 0 },
        );
      const rows = Math.ceil(ordered.length / cols);
      const totalWidth = cols * maxSize.w + (cols - 1) * gap;
      const totalHeight = rows * maxSize.h + (rows - 1) * gap;
      const startX = origin.x - totalWidth / 2 + maxSize.w / 2;
      const startY = origin.y - totalHeight / 2 + maxSize.h / 2;

      ordered.forEach((operation, index) => {
        points.set(operation, {
          x: startX + (index % cols) * (maxSize.w + gap),
          y: startY + Math.floor(index / cols) * (maxSize.h + gap),
        });
      });
    }
  }

  return points;
}

function getBBoxCenter(bbox: BBox) {
  return {
    x: bbox.x + bbox.w / 2,
    y: bbox.y + bbox.h / 2,
  };
}
