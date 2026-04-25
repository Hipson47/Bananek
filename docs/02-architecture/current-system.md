# Current System — Verified Against Code

> Last verified: 2026-04-24.

## What This Is

A local-first automation-first product photo enhancer for e-commerce sellers. The customer product flow remains preset-based and single-image:

1. upload
2. choose preset
3. process
4. compare
5. download

## Runtime Architecture

```
Browser (Vite + React)
  └─ GET /api/session
  └─ POST /api/enhance
       ├─ sharp/mock: synchronous result
       └─ fal: 202 queued job
            └─ GET /api/jobs/:jobId
                 └─ GET /api/outputs/:outputId

Backend (Node + Hono)
  ├─ signed session cookie + X-Session-Id boundary
  ├─ multipart / JSON upload validation
  ├─ SQLite-backed credits, rate limits, jobs, telemetry, consistency profiles
  ├─ object-store abstraction for binary inputs/outputs
  ├─ async worker for FAL-heavy jobs
  └─ structured logging with request/job correlation

Orchestration
  └─ analyze -> plan -> execute -> verify
       ├─ OpenRouter: planning only, strict JSON nodes
       ├─ FAL: only image-generation backend
       ├─ sharp: deterministic execution and fallback path
       └─ authoritative final verification
```

## Active Routes

- `GET /api/health`
- `GET /api/session`
- `POST /api/enhance`
- `GET /api/jobs/:jobId`
- `GET /api/outputs/:outputId`
- `GET /api/ops/counters`

## Storage Model

### SQLite

Persists:

- sessions
- usage events
- rate-limit buckets
- single-flight processing locks
- enhancement jobs
- consistency profiles
- job node metrics
- output metadata

### Filesystem-backed object storage

Stores:

- uploaded job input binaries
- processed output binaries

The abstraction is intentionally local today and shaped so cloud object storage can replace it later without changing routes.

## Enhancement Flow

### Sharp / mock path

1. validate session, rate limits, and file bytes
2. reserve credit transactionally
3. run orchestration inline
4. store output metadata + bytes
5. return final `ProcessedImageResult`

### FAL path

1. validate session, rate limits, and file bytes
2. reserve credit transactionally
3. persist input bytes
4. create durable job row in SQLite
5. return `202` with `jobId` and `statusUrl`
6. worker claims job and runs orchestration
7. on success:
   - persist consistency profile
   - persist output metadata + bytes
   - persist node telemetry
   - mark job `succeeded`
8. on failure:
   - refund credit
   - mark job `failed`
9. frontend polls `GET /api/jobs/:jobId` until it receives either a final result or a controlled failure

## Orchestration Behavior

- `analyze`: derives structured image facts with `sharp`
- `plan`: builds and scores candidate plans
- `execute`: runs the chosen processor path
- `verify`: scores output and may allow one bounded retry/replan path
- final verification is authoritative; failed outputs do not return success

OpenRouter is used only for structured planning nodes. FAL is used only for image generation. The customer UI never sees prompts, provider names, or model names.

## Consistency Capability

Consistency memory is now real but internal-only:

- persisted per `session + preset` scope in SQLite
- reused across related async jobs by the worker
- not currently exposed as a batch/catalog feature in the customer UI

## Telemetry

Structured logs include:

- `requestId`
- `jobId`
- processor path
- retry/replan/fallback counts
- verification outcome
- trusted-proxy / boundary rejection events
- worker shutdown/drain outcome

SQLite telemetry rows store:

- node name
- latency
- outcome
- attempts
- source/model metadata when applicable

## Tests

Current verified counts:

- root tests: `115`
- backend tests: `105`
- Playwright E2E: `2`

Covered areas include:

- route integration
- async job lifecycle
- credit atomicity
- object storage cleanup
- consistency profile persistence
- OpenRouter client behavior
- FAL execution safety
- frontend backend-adapter polling
- browser upload -> process -> download flow
- trusted-proxy client IP extraction
- Host/Origin boundary checks
- session secret policy
- worker drain/requeue behavior

## What Does Not Exist

- real customer auth/accounts
- real payments/purchased credits
- cloud object storage
- distributed workers/queue infra
- external metrics/tracing/alerts
