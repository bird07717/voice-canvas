import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { ProviderRouter } from "./providers/ProviderRouter.js";
import type { ParseInput } from "./types.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const provider = new ProviderRouter();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "voice-canvas-server",
  });
});

app.post("/api/parse", async (req, res, next) => {
  try {
    const input = req.body as ParseInput;

    if (!input?.transcript || typeof input.transcript !== "string") {
      res.status(400).json({ error: "transcript is required" });
      return;
    }

    const result = await provider.parseInstruction(input);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.listen(port, () => {
  console.log(`Voice-Canvas API listening on http://localhost:${port}`);
});
