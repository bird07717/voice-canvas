import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "voice-canvas-server",
  });
});

app.listen(port, () => {
  console.log(`Voice-Canvas API listening on http://localhost:${port}`);
});
