export type ShapeType = "circle" | "rect" | "triangle" | "line" | "text" | "ellipse";

export type CircleGeometry = {
  shape: "circle";
  x: number;
  y: number;
  radius: number;
};

export type RectGeometry = {
  shape: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TriangleGeometry = {
  shape: "triangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EllipseGeometry = {
  shape: "ellipse";
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
};

export type LineGeometry = {
  shape: "line";
  x: number;
  y: number;
  points: number[];
};

export type TextGeometry = {
  shape: "text";
  x: number;
  y: number;
  content: string;
  fontSize: number;
};

export type SceneGeometry =
  | CircleGeometry
  | RectGeometry
  | TriangleGeometry
  | EllipseGeometry
  | LineGeometry
  | TextGeometry;

export type ShapeDraftGeometry =
  | Omit<CircleGeometry, "x" | "y">
  | Omit<RectGeometry, "x" | "y">
  | Omit<TriangleGeometry, "x" | "y">
  | Omit<EllipseGeometry, "x" | "y">
  | Omit<LineGeometry, "x" | "y">
  | Omit<TextGeometry, "x" | "y">;

export type SceneStyle = {
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number;
  opacity?: number;
};

export type SceneObject = {
  id: string;
  type: ShapeType;
  geometry: SceneGeometry;
  style: Required<SceneStyle>;
  label: string;
  groupId: string | null;
  seq: number;
  z: number;
};

export type BBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SceneGroup = {
  id: string;
  label: string;
  memberIds: string[];
  bbox: BBox;
  seq: number;
  createdAt: number;
};

export type PendingAction = {
  type: "clear";
  ops: Operation[];
} | null;

export type CanvasSize = {
  width: number;
  height: number;
};

export type SceneSnapshot = {
  objects: SceneObject[];
  groups: SceneGroup[];
  lastCreatedIds: string[];
  focusIds: string[];
  pendingAction: PendingAction;
  nextSeq: number;
};

export type SceneState = SceneSnapshot & {
  canvas: CanvasSize;
};

export type AnchorRegion =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type Position =
  | { mode: "absolute"; x: number; y: number }
  | { mode: "anchor"; region: AnchorRegion; dx?: number; dy?: number }
  | {
      mode: "relative";
      ref: string;
      side: "left" | "right" | "above" | "below";
      gap?: number;
      dx?: number;
      dy?: number;
    }
  | {
      mode: "layout";
      layoutId: string;
      type: "row" | "grid";
      index: number;
      count: number;
      gap?: number;
      align?: "top" | "middle" | "bottom";
      origin?: { region: AnchorRegion; dx?: number; dy?: number };
      cols?: number;
      rows?: number;
    };

export type CreateOperation = {
  op: "create";
  geometry: ShapeDraftGeometry;
  style?: SceneStyle;
  position: Position;
  label: string;
  tempId?: string;
  groupId?: string;
};

export type CreateGroupOperation = {
  op: "createGroup";
  groupId: string;
  label: string;
};

export type SetStyleOperation = {
  op: "setStyle";
  targetIds: string[];
  style: SceneStyle;
};

export type TransformAction =
  | { kind: "move"; dx: number; dy: number }
  | { kind: "moveTo"; position: Position }
  | { kind: "scale"; factor: number }
  | { kind: "resize"; width: number; height: number }
  | { kind: "rotate"; deg: number };

export type TransformOperation = {
  op: "transform";
  targetIds: string[];
  action: TransformAction;
};

export type DeleteOperation = {
  op: "delete";
  targetIds: string[];
};

export type Operation =
  | CreateOperation
  | CreateGroupOperation
  | SetStyleOperation
  | TransformOperation
  | DeleteOperation
  | { op: "clear" }
  | { op: "undo" }
  | { op: "redo" };

export type OpResult =
  | { status: "ok"; affectedIds: string[] }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export type ExecReport = {
  results: OpResult[];
  okCount: number;
  failCount: number;
};
