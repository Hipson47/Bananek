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
  - `src/features/enhancer/processors/backendProcessor.ts`
  - `POST /api/enhance`
  - `backend/src/processors/mock-processor.ts`
- the frontend no longer uses browser-side mock processing as the active path
- local development uses a Vite proxy from `/api` to the backend

## Current Architecture Summary

- the frontend owns upload, preset selection, progress UI, and result rendering
- the backend owns request validation and processing orchestration
- the current processor is still a mock, but the browser/backend boundary is now explicit
- provider details and future server-side processing remain hidden from the browser

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
- processing boundary for `/api/enhance`
- response contract returned to the UI
- future real-processing integration point

Does not yet own:
- auth
- billing
- storage
- queueing
- durable delivery

## Current Processing Flow

1. Customer uploads one image.
2. Customer selects one predefined preset.
3. Frontend serializes the file and calls `POST /api/enhance`.
4. Backend validates the request.
5. Mock processor returns the original bytes with format-correct metadata.
6. Frontend renders the returned result.

## Near-Term Target

The next milestone should preserve the same frontend/backend seam and replace only the backend processing implementation:

1. keep `POST /api/enhance` as the stable customer-facing contract
2. replace the mock processor with real processing, likely `sharp` first
3. keep AI-provider integration behind the backend boundary when it is added later
4. add storage, jobs, billing, and delivery only in later phases

## Architecture Decision Constraints

- incremental evolution over rewrite
- preserve the backend boundary already introduced in Phase 1
- no provider keys in the browser
- no customer prompts in the default product flow
- keep customer flow preset-based: upload -> preset -> process -> result
