import { z } from "zod";
import { operationSchema } from "../scene/schema";

export const responseEnvelopeSchema = z
  .object({
    understanding: z.string(),
    operations: z.array(operationSchema),
    reply: z.string().nullable(),
    clarify: z
      .object({
        question: z.string(),
        options: z.array(z.string()).optional(),
      })
      .nullable(),
  })
  .strict();

export type ResponseEnvelope = z.infer<typeof responseEnvelopeSchema>;
