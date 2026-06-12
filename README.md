# Voice-Canvas

Voice-Canvas is a local MVP for a pure voice controlled drawing tool. The current codebase is at the phase 0 project skeleton: React/Vite client, Express server, shared npm scripts, and safe environment variable placeholders.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create local server environment variables:

```bash
copy server\.env.example server\.env
```

3. Fill `server/.env` with your local keys when model integration is implemented. Do not commit `server/.env`.

4. Start both the client and server:

```bash
npm run dev
```

The Vite client runs on `http://localhost:5173`. The Express API runs on `http://localhost:3001`, and the client proxies `/api/*` requests to it.

## Environment Variables

`server/.env.example` documents every runtime variable used by the local server:

| Variable | Purpose |
|---|---|
| `PORT` | Express API port. Defaults to `3001`. |
| `ANTHROPIC_API_KEY` | Claude API key for the future `ClaudeProvider`. |
| `ANTHROPIC_BASE_URL` | Optional Anthropic-compatible base URL override. |
| `DEEPSEEK_API_KEY` | DeepSeek API key for the future fallback provider. |
| `DEEPSEEK_BASE_URL` | Optional DeepSeek OpenAI-compatible base URL override. |

## Project Structure

```text
client/  React + TypeScript + Vite frontend
server/  Express + TypeScript local API proxy
docs/    MVP, brain design, task checklist, and architecture notes
```

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite and Express together. |
| `npm run dev:client` | Start only the Vite client. |
| `npm run dev:server` | Start only the Express server. |
| `npm run build` | Type-check/build both workspaces. |
| `npm run typecheck` | Type-check the server and build the client. |

## Current Scope

Phase 0 only proves the repository shape and local client/server loop. Drawing operations, voice input, model providers, and the scene graph start in phase 1 and later tasks.
