# Product Photo Enhancer

Automation-first product photo enhancement for e-commerce sellers.

## What Exists Today

- `src/` is the active Vite + React + TypeScript customer app
- `backend/` is the active Node.js + Hono + TypeScript API
- the public product entrypoint is still `POST /api/enhance`
- the customer flow is still:
  - upload one photo
  - choose one preset
  - process
  - compare
  - download

## Active Runtime Path

1. the browser boots a signed backend session via `GET /api/session`
2. the frontend sends multipart upload + preset to `POST /api/enhance`
3. when `PROCESSOR=fal`, backend enqueues a durable SQLite-backed job and returns `202`
4. the frontend polls `GET /api/jobs/:jobId` through `BackendProcessor`
5. the backend worker runs `analyze -> plan -> execute -> verify`
6. output metadata is stored in SQLite
7. output bytes are stored in the filesystem-backed object storage abstraction
8. the browser renders and downloads the signed `/api/outputs/:outputId?...` result

Sharp and mock modes still keep the same `/api/enhance` contract, but remain synchronous because they are cheap and deterministic.

## Current Architecture

- processor modes:
  - `sharp`: deterministic preset transforms
  - `fal`: OpenRouter planning-only graph + FAL execution + async job worker
  - `mock`: contract-only pass-through for tests/dev
- runtime durability:
  - SQLite stores sessions, credits, usage events, rate limits, job records, consistency profiles, telemetry rows, and output metadata
  - filesystem-backed object storage stores binary inputs/outputs
- orchestration behavior:
  - candidate-plan graph
  - strict JSON OpenRouter planning nodes
  - deterministic fallback when OpenRouter fails
  - authoritative final verification
  - one bounded retry/replan path
- browser coverage:
  - Vitest frontend tests for the backend adapter
  - Playwright E2E for the real upload -> process -> download flow

## What Is Not Implemented Yet

- real customer auth/accounts
- payments and purchased credits
- cloud object storage
- multi-node queueing / distributed workers
- external metrics, tracing, and alerting

## Run

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
npm --prefix backend install
cp backend/.env.example backend/.env
npm --prefix backend run dev
```

## Verify

In this WSL environment, Vitest needs `TMPDIR=/tmp`.

```bash
TMPDIR=/tmp npm test
TMPDIR=/tmp npm --prefix backend test
npm run build
npm --prefix backend run build
npm run test:e2e
npm run security:audit
```

Full repo gate:

```bash
TMPDIR=/tmp npm run verify
```

Current verified counts:

- root tests: `115`
- backend tests: `105`
- Playwright E2E: `2`

## Key Backend Environment Variables

- `APP_SESSION_SECRET`: required in production; local dev can use a generated secret file only when `ALLOW_GENERATED_DEV_SESSION_SECRET=true`
- `LOCAL_DEV_SESSION_SECRET_PATH`: path for the generated local-dev secret file
- `ALLOWED_HOSTS`: accepted backend host headers
- `TRUSTED_PROXY_RANGES`: trusted proxy peers allowed to supply forwarded client IP headers
- `DATABASE_PATH`: SQLite runtime database path
- `OBJECT_STORAGE_PATH`: filesystem-backed object storage root
- `PROCESSOR`: `sharp`, `fal`, or `mock`
- `PROCESSOR_FAILURE_POLICY`: `strict` or `fallback-to-sharp`
- `JOB_POLL_INTERVAL_MS`: async worker polling interval
- `JOB_RETENTION_SECONDS`: retention for completed job rows
- `OUTPUT_URL_TTL_SECONDS`: signed output URL lifetime
- `OPENROUTER_API_KEY`: planning-only intelligence for the `fal` path
- `OPENROUTER_MODEL_*`: per-node OpenRouter model selection

## Current Phase Status

- backend proxy + frontend wiring: complete
- deterministic `sharp` processing: complete
- FAL integration behind `/api/enhance`: complete
- adaptive orchestration: complete
- durability + async job hardening: complete
- backend freeze for this phase: complete
- next milestone: frontend-focused product development; auth/payments/cloud ops remain deferred

## Docs

- [AI_CONTEXT.md](AI_CONTEXT.md)
- [docs/README.md](docs/README.md)
- [docs/02-architecture/current-system.md](docs/02-architecture/current-system.md)
- [docs/03-progress/current-status.md](docs/03-progress/current-status.md)
