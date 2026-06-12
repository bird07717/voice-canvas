import type {
  AnchorRegion,
  BBox,
  CanvasSize,
  Position,
  SceneGeometry,
  ShapeDraftGeometry,
} from "./types";

const ANCHOR_MARGIN = 72;

export function resolvePosition(
  position: Position,
  canvas: CanvasSize,
): { x: number; y: number } {
  if (position.mode === "absolute") {
    return clampPoint(position.x, position.y, canvas);
  }

  const xPositions = {
    left: ANCHOR_MARGIN,
    center: canvas.width / 2,
    right: canvas.width - ANCHOR_MARGIN,
  };
  const yPositions = {
    top: ANCHOR_MARGIN,
    middle: canvas.height / 2,
    bottom: canvas.height - ANCHOR_MARGIN,
  };

  const [vertical, horizontal] = parseRegion(position.region);

  return clampPoint(
    xPositions[horizontal] + (position.dx ?? 0),
    yPositions[vertical] + (position.dy ?? 0),
    canvas,
  );
}

export function withPosition(
  geometry: ShapeDraftGeometry,
  point: { x: number; y: number },
): SceneGeometry {
  return {
    ...geometry,
    x: point.x,
    y: point.y,
  } as SceneGeometry;
}

export function getBBox(geometry: SceneGeometry): BBox {
  switch (geometry.shape) {
    case "circle":
      return {
        x: geometry.x - geometry.radius,
        y: geometry.y - geometry.radius,
        w: geometry.radius * 2,
        h: geometry.radius * 2,
      };
    case "rect":
    case "triangle":
      return {
        x: geometry.x - geometry.width / 2,
        y: geometry.y - geometry.height / 2,
        w: geometry.width,
        h: geometry.height,
      };
    case "ellipse":
      return {
        x: geometry.x - geometry.radiusX,
        y: geometry.y - geometry.radiusY,
        w: geometry.radiusX * 2,
        h: geometry.radiusY * 2,
      };
    case "line": {
      const xs = geometry.points.filter((_, index) => index % 2 === 0);
      const ys = geometry.points.filter((_, index) => index % 2 === 1);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return {
        x: geometry.x + minX,
        y: geometry.y + minY,
        w: maxX - minX,
        h: maxY - minY,
      };
    }
    case "text": {
      const width = Math.max(geometry.content.length * geometry.fontSize, 1);
      const height = geometry.fontSize * 1.25;

      return {
        x: geometry.x - width / 2,
        y: geometry.y - height / 2,
        w: width,
        h: height,
      };
    }
  }
}

export function moveGeometry(
  geometry: SceneGeometry,
  dx: number,
  dy: number,
): SceneGeometry {
  return {
    ...geometry,
    x: geometry.x + dx,
    y: geometry.y + dy,
  } as SceneGeometry;
}

export function moveGeometryTo(
  geometry: SceneGeometry,
  point: { x: number; y: number },
): SceneGeometry {
  return {
    ...geometry,
    x: point.x,
    y: point.y,
  } as SceneGeometry;
}

export function scaleGeometry(
  geometry: SceneGeometry,
  factor: number,
): SceneGeometry {
  switch (geometry.shape) {
    case "circle":
      return { ...geometry, radius: geometry.radius * factor };
    case "rect":
    case "triangle":
      return {
        ...geometry,
        width: geometry.width * factor,
        height: geometry.height * factor,
      };
    case "ellipse":
      return {
        ...geometry,
        radiusX: geometry.radiusX * factor,
        radiusY: geometry.radiusY * factor,
      };
    case "line":
      return {
        ...geometry,
        points: geometry.points.map((point) => point * factor),
      };
    case "text":
      return { ...geometry, fontSize: geometry.fontSize * factor };
  }
}

export function resizeGeometry(
  geometry: SceneGeometry,
  width: number,
  height: number,
): SceneGeometry {
  switch (geometry.shape) {
    case "circle":
      return { ...geometry, radius: Math.min(width, height) / 2 };
    case "rect":
    case "triangle":
      return { ...geometry, width, height };
    case "ellipse":
      return { ...geometry, radiusX: width / 2, radiusY: height / 2 };
    case "line": {
      const bbox = getBBox(geometry);
      const scaleX = bbox.w === 0 ? 1 : width / bbox.w;
      const scaleY = bbox.h === 0 ? 1 : height / bbox.h;

      return {
        ...geometry,
        points: geometry.points.map((point, index) =>
          point * (index % 2 === 0 ? scaleX : scaleY),
        ),
      };
    }
    case "text":
      return { ...geometry, fontSize: height };
  }
}

function parseRegion(region: AnchorRegion) {
  const [vertical, horizontal] = region.split("-") as [
    "top" | "middle" | "bottom" | "center",
    "left" | "center" | "right" | undefined,
  ];

  if (region === "center") {
    return ["middle", "center"] as const;
  }

  return [
    vertical === "center" ? "middle" : vertical,
    horizontal ?? "center",
  ] as const;
}

function clampPoint(x: number, y: number, canvas: CanvasSize) {
  return {
    x: Math.min(Math.max(x, 0), canvas.width),
    y: Math.min(Math.max(y, 0), canvas.height),
  };
}
