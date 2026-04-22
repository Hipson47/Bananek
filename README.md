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
  - backend runs `analyze -> plan -> execute -> verify`
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
- enhancement execution is orchestration-first:
  - structured image analysis
  - OpenRouter planning graph for text intelligence
  - deterministic prompt fallback when OpenRouter is unavailable
  - FAL-only image execution on the AI path
  - output verification with one retry/fallback decision

## Current Product Flow

The app is a narrow customer-mode slice, not a prompt playground. It supports:

1. upload one product photo
2. choose one predefined enhancement preset
3. start a signed backend session with per-session usage state
4. process through the backend orchestration layer
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
- `OPENROUTER_API_KEY`: enables planning/orchestration intelligence for the `fal` path
- `OPENROUTER_MODEL_*`: per-node planning models for intent, shot planning, consistency, prompt building, and verification

## Phase Status

- Phase 1 — backend proxy and frontend wiring: **complete**
- Phase 2 — real image processing via sharp: **complete**
- Phase 3 — AI-provider integration via FAL.ai behind `/api/enhance`: **complete**
- MVP product-path rescue pass: **complete**
- Automation orchestrator pass (`analyze -> plan -> execute -> verify`): **complete**

## Processor Strategy

- `PROCESSOR=sharp`: deterministic preset processing, no external planning required
- `PROCESSOR=fal`: OpenRouter planning graph + internal prompt packaging + FAL image execution
- `PROCESSOR=mock`: unchanged bytes, useful for contract-only tests
- `PROCESSOR_FAILURE_POLICY=strict|fallback-to-sharp`: explicit failure policy; default is `strict`

## Automation Architecture

`POST /api/enhance` remains the public contract, but the backend is no longer a direct “call one generator” path.

It now runs:

1. `analyze`: derive structured image facts from the uploaded asset
2. `intent normalization`: use OpenRouter to normalize preset + image facts into a strict JSON `intent_spec`
3. `shot planning`: use OpenRouter to generate 3-4 bounded structured creative candidates
4. `consistency normalization`: use OpenRouter to select or merge candidates into one consistent brief
5. `prompt package generation`: build a FAL-ready package through structured JSON plus deterministic text materialization
6. `execute`: run FAL as the only image-generation backend on the AI path
7. `verify`: evaluate the output and optionally retry once or fall back to deterministic processing

OpenRouter is used only for planning and normalization. FAL remains the image execution layer. AI prompt building stays internal-only and deterministic-first. The frontend still sends only:

- image
- preset
- session header

Customer-facing behavior remains provider-safe:

- no prompts in the UI
- no provider/model names shown in the UI
- no secrets in the browser
- a signed backend session is required before enhancement
- outputs are persisted in SQLite and served from `/api/outputs/:outputId`
- per-session credits, rate limits, and single-flight locks are enforced server-side
- critical runtime state no longer depends on in-memory maps or JSON files
- orchestration decisions are observable in structured logs and backend tests

## Verification Gates

- `npm run verify`
- CI runs the same verify flow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

## Repo Guide

- **AI session handoff**: [AI_CONTEXT.md](AI_CONTEXT.md) — read this first
- **Agent contract**: [AGENTS.md](AGENTS.md)
- **Docs index**: [docs/README.md](docs/README.md)
- **Current system (verified)**: [docs/02-architecture/current-system.md](docs/02-architecture/current-system.md)
- **What to build next**: [docs/03-progress/priorities.md](docs/03-progress/priorities.md)
- **Known gaps**: [docs/02-architecture/known-gaps.md](docs/02-architecture/known-gaps.md)
- **Decision log**: [docs/04-decisions/decision-log.md](docs/04-decisions/decision-log.md)
