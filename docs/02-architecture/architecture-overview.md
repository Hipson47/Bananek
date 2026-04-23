# Architecture Overview

## Current State

- `src/` is the active customer-facing app
- `backend/` is the active API + orchestration runtime
- `/api/enhance` remains the public product entrypoint
- `PROCESSOR=fal` is now async and job-backed
- `PROCESSOR=sharp` and `PROCESSOR=mock` remain synchronous

## Boundary Summary

### Frontend owns

- upload UI
- preset selection
- progress / error / result rendering
- polling the backend job status through `BackendProcessor`

### Backend owns

- signed session issuance
- request validation
- abuse controls
- credit reservation / refund
- orchestration
- async job execution for AI-heavy work
- output persistence and delivery
- consistency profile persistence
- telemetry

### Frontend does not own

- prompts
- provider routing
- provider keys
- job execution logic
- storage semantics

## Public Contract

`POST /api/enhance` is still the stable public entrypoint.

Behavior by processor:

- `sharp` / `mock`: returns final `ProcessedImageResult`
- `fal`: returns `202` accepted job envelope and the frontend polls until the backend returns either:
  - final `ProcessedImageResult`
  - controlled failure payload

The user-facing flow stays the same because polling is hidden inside `BackendProcessor`.

## Orchestration Contract

The active backend path is:

1. analyze
2. plan
3. execute
4. verify

Additional details:

- OpenRouter is planning-only and schema-constrained
- FAL is the only image-generation backend
- sharp remains the deterministic fallback path
- verification is authoritative
- retries/replans are bounded and observable

## Durability Model

- SQLite is the source of truth for runtime metadata
- filesystem object storage is the source of truth for binary payloads
- cleanup runs on startup and on an interval, not on user requests
- AI work survives process restart through durable job rows

## Remaining Near-Term Target

The next architecture step is not “more orchestration.” It is operational launch work:

1. real auth/accounts
2. payments and purchased credits
3. cloud object storage swap behind the existing storage abstraction
4. external observability
5. graceful shutdown / worker drain behavior
