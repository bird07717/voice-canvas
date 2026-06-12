import { z } from "zod";

const positiveNumber = z.number().positive();

export const circleGeometrySchema = z.object({
  shape: z.literal("circle"),
  radius: positiveNumber,
}).strict();

export const rectGeometrySchema = z.object({
  shape: z.literal("rect"),
  width: positiveNumber,
  height: positiveNumber,
}).strict();

export const triangleGeometrySchema = z.object({
  shape: z.literal("triangle"),
  width: positiveNumber,
  height: positiveNumber,
}).strict();

export const ellipseGeometrySchema = z.object({
  shape: z.literal("ellipse"),
  radiusX: positiveNumber,
  radiusY: positiveNumber,
}).strict();

export const lineGeometrySchema = z.object({
  shape: z.literal("line"),
  points: z.array(z.number()).min(4),
}).strict();

export const textGeometrySchema = z.object({
  shape: z.literal("text"),
  content: z.string(),
  fontSize: positiveNumber,
}).strict();

export const geometrySchema = z.discriminatedUnion("shape", [
  circleGeometrySchema,
  rectGeometrySchema,
  triangleGeometrySchema,
  ellipseGeometrySchema,
  lineGeometrySchema,
  textGeometrySchema,
]);

export const styleSchema = z
  .object({
    fill: z.string().nullable().optional(),
    stroke: z.string().nullable().optional(),
    strokeWidth: z.number().min(0).optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .strict();

export const regionSchema = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

export const positionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("absolute"),
    x: z.number(),
    y: z.number(),
  }).strict(),
  z.object({
    mode: z.literal("anchor"),
    region: regionSchema,
    dx: z.number().optional(),
    dy: z.number().optional(),
  }).strict(),
]);

const createOperationSchema = z.object({
  op: z.literal("create"),
  geometry: geometrySchema,
  style: styleSchema.optional(),
  position: positionSchema,
  label: z.string(),
  tempId: z.string().optional(),
  groupId: z.string().optional(),
}).strict();

const createGroupOperationSchema = z.object({
  op: z.literal("createGroup"),
  groupId: z.string(),
  label: z.string(),
}).strict();

const setStyleOperationSchema = z.object({
  op: z.literal("setStyle"),
  targetIds: z.array(z.string()).min(1),
  style: styleSchema,
}).strict();

const transformActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), dx: z.number(), dy: z.number() }).strict(),
  z.object({ kind: z.literal("moveTo"), position: positionSchema }).strict(),
  z.object({ kind: z.literal("scale"), factor: positiveNumber }).strict(),
  z.object({
    kind: z.literal("resize"),
    width: positiveNumber,
    height: positiveNumber,
  }).strict(),
  z.object({ kind: z.literal("rotate"), deg: z.number() }).strict(),
]);

const transformOperationSchema = z.object({
  op: z.literal("transform"),
  targetIds: z.array(z.string()).min(1),
  action: transformActionSchema,
}).strict();

const deleteOperationSchema = z.object({
  op: z.literal("delete"),
  targetIds: z.array(z.string()).min(1),
}).strict();

export const operationSchema = z.discriminatedUnion("op", [
  createOperationSchema,
  createGroupOperationSchema,
  setStyleOperationSchema,
  transformOperationSchema,
  deleteOperationSchema,
  z.object({ op: z.literal("clear") }).strict(),
  z.object({ op: z.literal("undo") }).strict(),
  z.object({ op: z.literal("redo") }).strict(),
]);

export const operationListSchema = z.array(operationSchema);

export type OperationInput = z.input<typeof operationSchema>;
