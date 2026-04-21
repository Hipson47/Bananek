# Product Photo Enhancer

Runnable product-photo enhancement slice for an automation-first e-commerce workflow.

## What Exists Today

- `src/` contains the active Vite + React + TypeScript customer flow
- `backend/` contains a Node.js + Hono + TypeScript API with:
  - `GET /api/health`
  - `POST /api/enhance`
- the active enhancement path is:
  - upload one image
  - bootstrap a signed backend session
  - choose one preset
  - call `BackendProcessor`
  - send the image to `/api/enhance`
  - receive a persisted result URL and render the stored output
- Vite proxies `/api/*` to the backend in local development
- the backend supports three processor modes behind the same `/api/enhance` contract:
  - `sharp` (default): deterministic preset transforms
  - `fal`: AI-backed preset transforms
  - `mock`: contract-only no-op processing for dev/tests
- runtime state is SQLite-backed:
  - sessions and credit counters
  - usage events
  - rate-limit buckets
  - single-flight processing locks
  - persisted output metadata and payloads

## Current Product Flow

The app is a narrow customer-mode slice, not a prompt playground. It supports:

1. upload one product photo
2. choose one predefined enhancement preset
3. start a signed backend session with per-session usage state
4. process through the backend (sharp or FAL.ai behind the same preset-based contract)
5. compare original vs processed output
6. download the persisted result

This keeps the product aligned with the intended customer experience:

- no prompts
- no provider choice
- no API keys in the browser
- no model terminology in the primary UX

## What Is Not Implemented Yet

- full customer auth
- real payments / credit purchasing
- cloud object storage and deployment infrastructure
- async jobs / queues for slow AI workloads

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

The backend uses Node's `--env-file-if-exists=.env`, so local secrets belong in:

```bash
cp backend/.env.example backend/.env
npm --prefix backend run dev
```

Key backend runtime variables:

- `DATABASE_PATH`: SQLite runtime database path
- `APP_SESSION_SECRET`: session and output URL signing secret
- `PROCESSOR`: `sharp`, `fal`, or `mock`
- `PROCESSOR_FAILURE_POLICY`: `strict` or `fallback-to-sharp`
- `OUTPUT_URL_TTL_SECONDS`: signed output URL lifetime

## Phase Status

- Phase 1 — backend proxy and frontend wiring: **complete**
- Phase 2 — real image processing via sharp: **complete**
- Phase 3 — AI-provider integration via FAL.ai behind `/api/enhance`: **complete**
- MVP product-path rescue pass: **complete**

## Processor Strategy

- `PROCESSOR=sharp`: deterministic preset processing, no external provider required
- `PROCESSOR=fal`: AI-backed processing via FAL.ai
- `PROCESSOR=mock`: unchanged bytes, useful for contract-only tests
- `PROCESSOR_FAILURE_POLICY=strict|fallback-to-sharp`: explicit failure policy; default is `strict`

Customer-facing behavior remains provider-safe:

- no prompts in the UI
- no provider/model names shown in the UI
- no secrets in the browser
- a signed backend session is required before enhancement
- outputs are persisted in SQLite and served from `/api/outputs/:outputId`
- per-session credits, rate limits, and single-flight locks are enforced server-side
- critical runtime state no longer depends on in-memory maps or JSON files

## Verification Gates

- `npm run verify`
- CI runs the same verify flow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

## Repo Guide

- agent contract: [AGENTS.md](AGENTS.md)
- docs index: [docs/README.md](docs/README.md)
- current repo/product summary: [docs/project-overview.md](docs/project-overview.md)
- current execution snapshot: [docs/progress/current-status.md](docs/progress/current-status.md)
