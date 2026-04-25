# AI Context — Session Handoff File

> Last updated: 2026-04-25.

## Repo Reality

- customer-facing React app in `src/`
- backend API/orchestrator in `backend/`
- stable product entrypoint: `POST /api/enhance`
- stable product UX: upload -> preset -> process -> result -> download

## Verified Backend Shape

- `GET /api/session`
- `POST /api/enhance`
- `GET /api/jobs/:jobId`
- `GET /api/outputs/:outputId`
- `GET /api/health`
- `GET /api/ops/counters`

## Processor Reality

- `sharp`: deterministic preset processing
- `fal`: async job-backed AI execution
- `mock`: contract-only processing

OpenRouter is planning-only. FAL is the only image-generation backend.

## Runtime Reality

SQLite persists:

- sessions
- credits / usage events
- rate limits
- locks
- jobs
- consistency profiles
- telemetry rows
- output metadata

The backend also enforces Host/Origin boundaries on state-changing routes,
trusts forwarded IP headers only from configured trusted proxies, and drains or
requeues active jobs during graceful shutdown.

Filesystem object storage persists:

- uploaded job input bytes
- processed output bytes

## Orchestration Reality

Active path:

`analyze -> plan -> execute -> verify`

Properties:

- candidate plans are scored
- final verification is authoritative
- retry/replan is bounded
- frontend does not see prompts or provider details

## Frontend Reality

- `/` is the premium Framer Motion story-scroll landing page
- `/app` and `/app/enhance` are the real product tool routes
- `/` is frontend-only and must not bootstrap `/api/session`; session creation
  starts when the user enters `/app` or `/app/enhance`
- `BackendProcessor` hides async polling from the UI
- browser still interacts only with presets and files
- no prompt input
- no provider choice
- `/dawca` was a temporary donor design reference and has been removed; its
  landing system was transplanted into product-owned code: 1200vh sticky
  runway, donor timing windows, scroll progress transforms, lifecycle gating,
  chapter mechanics, and namespaced donor-style CSS without copying portfolio
  content

## Test / Verify Snapshot

- root tests: `115`
- backend tests: `105`
- Playwright E2E: `7`
- frontend build: passing
- backend build: passing
- `npm run verify`: passing

## Remaining Gaps

- no real auth/accounts
- no payments
- no cloud object storage
- no distributed workers
- no external metrics/tracing/alerts

## Current Phase Recommendation

Backend is freeze-ready for this phase. Stop backend feature work and move to
frontend-focused development unless a real backend defect is found.
