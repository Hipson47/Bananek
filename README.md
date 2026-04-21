# Product Photo Enhancer

Runnable product-photo enhancement slice for an automation-first e-commerce workflow.

## What Exists Today

- `src/` contains the active Vite + React + TypeScript customer flow
- `backend/` contains a Node.js + Hono + TypeScript API with:
  - `GET /api/health`
  - `POST /api/enhance`
- the active enhancement path is:
  - upload one image
  - choose one preset
  - call `BackendProcessor`
  - send the image to `/api/enhance`
  - receive and render a genuinely transformed result
- Vite proxies `/api/*` to the backend in local development
- the backend uses a real sharp-based processor (auto-orient, resize, flatten, modulate, sharpen)
- set `PROCESSOR=mock` to run without real transforms (dev / contract testing only)

## Current Product Flow

The app is a narrow customer-mode slice, not a prompt playground. It supports:

1. upload one product photo
2. choose one predefined enhancement preset
3. process through the backend (sharp transforms applied per preset)
4. compare original vs processed output
5. download the result

This keeps the product aligned with the intended customer experience:

- no prompts
- no provider choice
- no API keys in the browser
- no model terminology in the primary UX

## What Is Not Implemented Yet

- AI-provider integration behind the backend seam
- auth, billing, credits, storage, jobs, or delivery controls
- production deployment infrastructure

## Run

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

## Verify

In this WSL environment, tests need `TMPDIR=/tmp`.

```bash
TMPDIR=/tmp npm test
npm run build
```

## Phase Status

- Phase 1 — backend proxy and frontend wiring: **complete**
- Phase 2 — real image processing via sharp: **complete** (39 tests passing)
- Phase 3 — AI-provider integration behind `/api/enhance`: **not started**

## Repo Guide

- agent contract: [AGENTS.md](AGENTS.md)
- docs index: [docs/README.md](docs/README.md)
- current repo/product summary: [docs/project-overview.md](docs/project-overview.md)
- current execution snapshot: [docs/progress/current-status.md](docs/progress/current-status.md)
