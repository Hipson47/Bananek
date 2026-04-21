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
- the backend supports three processor modes behind the same `/api/enhance` contract:
  - `sharp` (default): deterministic preset transforms
  - `fal`: AI-backed preset transforms with optional fallback to `sharp`
  - `mock`: contract-only no-op processing for dev/tests

## Current Product Flow

The app is a narrow customer-mode slice, not a prompt playground. It supports:

1. upload one product photo
2. choose one predefined enhancement preset
3. process through the backend (sharp or FAL.ai behind the same preset-based contract)
4. compare original vs processed output
5. download the result

This keeps the product aligned with the intended customer experience:

- no prompts
- no provider choice
- no API keys in the browser
- no model terminology in the primary UX

## What Is Not Implemented Yet

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
TMPDIR=/tmp npm --prefix backend test
npm run build
npx tsc --noEmit -p backend/tsconfig.json
```

Backend environment:

```bash
cp backend/.env.example backend/.env
```

## Phase Status

- Phase 1 — backend proxy and frontend wiring: **complete**
- Phase 2 — real image processing via sharp: **complete**
- Phase 3 — AI-provider integration via FAL.ai behind `/api/enhance`: **complete**
- MVP product-path hardening: **complete**

## Processor Strategy

- `PROCESSOR=sharp`: deterministic preset processing, no external provider required
- `PROCESSOR=fal`: AI-backed processing via FAL.ai; if provider execution fails and `PROCESSOR_FALLBACK=sharp`, the request falls back to sharp
- `PROCESSOR=mock`: unchanged bytes, useful for contract-only tests

Customer-facing behavior remains provider-safe:

- no prompts in the UI
- no provider/model names shown in the UI
- no secrets in the browser

## Repo Guide

- agent contract: [AGENTS.md](AGENTS.md)
- docs index: [docs/README.md](docs/README.md)
- current repo/product summary: [docs/project-overview.md](docs/project-overview.md)
- current execution snapshot: [docs/progress/current-status.md](docs/progress/current-status.md)
