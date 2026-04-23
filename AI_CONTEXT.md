# AI Context — Session Handoff File

> Last updated: 2026-04-23.

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

- `BackendProcessor` hides async polling from the UI
- browser still interacts only with presets and files
- no prompt input
- no provider choice

## Test / Verify Snapshot

- root tests: `91`
- backend tests: `81`
- Playwright E2E: `2`
- frontend build: passing
- backend build: passing
- `npm run verify`: passing

## Remaining Gaps

- no real auth/accounts
- no payments
- no cloud object storage
- no distributed workers
- no external metrics/tracing/alerts
