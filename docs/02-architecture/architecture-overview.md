# Architecture Overview

## Document Status

- `Current State`: verified architecture that exists in the filesystem now
- `Near-Term Target`: the next implementation step after Phase 1 hardening
- `Historical`: older playground-oriented architecture notes are reference only

## Current Architecture

### Verified Facts

- `src/` contains the active customer-facing React app
- `backend/` contains the active Hono API
- the active enhancement request path is:
  - `src/App.tsx`
  - `GET /api/session`
  - `src/features/enhancer/processors/backendProcessor.ts`
  - `POST /api/enhance`
  - `backend/src/orchestration/enhancement-orchestrator.ts`
  - `backend/src/processors/*` execution path (`sharp`, `fal`, or `mock`)
  - `GET /api/outputs/:outputId`
- the frontend no longer uses browser-side mock processing as the active path
- local development uses a Vite proxy from `/api` to the backend

## Current Architecture Summary

- the frontend owns upload, preset selection, progress UI, and result rendering
- the backend owns signed session issuance, request validation, abuse controls, automation orchestration, SQLite-backed runtime state, output persistence, and delivery
- the default processor policy is deterministic-first; when `PROCESSOR=fal`, OpenRouter performs planning-only orchestration and FAL remains the only image-generation backend
- provider details remain hidden from customer-facing UI and response messaging

## Key Systems And Boundaries

### Frontend

Owns:
- upload UI
- preset selection
- request initiation
- status, error, and result rendering

Must not own:
- provider keys
- hidden prompts
- provider routing
- server-side processing logic

### Backend

Owns:
- request validation
- session bootstrap and signed session cookies
- usage tracking / credit decrement stub
- SQLite-backed rate limiting and single-flight enhancement guard
- processing boundary for `/api/enhance`
- orchestration graph stages: analyze, intent normalize, shot plan, consistency normalize, prompt package, execute, verify
- response contract returned to the UI
- persisted output delivery under `/api/outputs/:outputId`
- SQLite persistence for sessions, outputs, rate-limit buckets, and processing locks
- future real-processing integration point

Does not yet own:
- auth
- billing
- queueing
- durable multi-instance delivery

## Current Processing Flow

1. Customer uploads one image.
2. Customer selects one predefined preset.
3. Frontend sends a multipart request to `POST /api/enhance`.
4. Backend validates the session, abuse limits, and uploaded image bytes.
5. Backend analyzes the image to derive structured format, framing, brightness, contrast, and marketplace-readiness signals.
6. If `PROCESSOR=fal`, backend runs a planning graph:
   - OpenRouter intent normalization
   - OpenRouter shot planning
   - OpenRouter consistency normalization
   - OpenRouter prompt package generation
7. Backend materializes a deterministic internal prompt package and executes FAL.
8. Backend verifies the output with heuristic checks plus a structured verification node, and may retry once or fall back if policy allows.
9. If `PROCESSOR=sharp` or `mock`, backend stays on the deterministic processor seam without OpenRouter planning.
10. Backend persists the output and runtime metadata in SQLite, then returns a signed `/api/outputs/:outputId` URL.
11. Frontend renders the stored result.

## Near-Term Target

The existing frontend/backend seam is stable. The next milestone is not provider integration itself, but productisation around the current path:

1. keep `POST /api/enhance` as the stable customer-facing contract (already stable)
2. choose the production default between deterministic-only and OpenRouter-planned FAL execution
3. replace single-node SQLite blob persistence with cloud object storage
4. add payments / credit purchase and async jobs for AI-heavy processing

## Architecture Decision Constraints

- incremental evolution over rewrite
- preserve the backend boundary already introduced in Phase 1
- no provider keys in the browser
- no customer prompts in the default product flow
- keep customer flow preset-based: upload -> preset -> process -> result
