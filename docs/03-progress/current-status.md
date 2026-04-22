# Current Status

## Current Objective

The repo now has a real session-backed MVP path. `/api/enhance` keeps the stable product entrypoint,
but the backend now enforces signed sessions, persisted outputs, usage state, rate limits, stronger image
validation, request IDs, structured logs, a SQLite-backed runtime core, and a deterministic-first
enhancement orchestrator. OpenRouter now handles planning-only graph nodes for the FAL path. Next: payments,
cloud storage, and async jobs for AI-heavy traffic.

## Active Milestone

Production-readiness rescue pass -- coherent MVP path

## Current State

- `src/` contains a runnable Vite + React + TypeScript app (upload -> preset -> process -> result)
- `backend/` contains a Node.js + Hono + TypeScript server with `POST /api/enhance` and `GET /api/health`
- Frontend boots a signed backend session via `GET /api/session`
- Frontend `BackendProcessor` sends multipart uploads to `/api/enhance` with a session header
- Vite dev proxy routes `/api` -> `localhost:3001`
- **Three processors available**, selected via `PROCESSOR` env var:
  - `sharp` (default): deterministic libvips transforms, no API key required
  - `fal`: AI transforms via FAL.ai (background-removal + FLUX Kontext)
  - `mock`: original bytes returned unchanged, for contract-only tests
- backend execution is automation-first
- when `PROCESSOR=fal`, orchestration graph is:
  - image analysis
  - OpenRouter intent normalization
  - OpenRouter shot planning
  - OpenRouter consistency normalization
  - OpenRouter prompt package generation
  - FAL execution
  - output verification
- when OpenRouter planning fails, backend falls back to deterministic preset-based prompt construction
- customer-facing UI no longer exposes provider/model details
- session cookie + `X-Session-Id` header establish the active auth/session boundary
- processed assets are persisted in SQLite and served from `/api/outputs/:outputId`
- sessions, usage events, rate-limit counters, and processing locks are persisted in SQLite under `backend/data/app.sqlite`
- restart-safe credit reservation and refund now run inside database transactions
- `npm test` (root): 76 tests pass
- `npm --prefix backend test`: 69 tests pass
- `tsc --noEmit`: clean in both frontend and backend
- `npm run build`: frontend production build succeeds
- backend now has a real `build`/`start` path via compiled JS
- `npm run verify`: passes

## Processor / Preset Configuration

### FAL processor preset mapping

| Preset | FAL model | Prompt |
|---|---|---|
| `clean-background` | `fal-ai/background-removal` | n/a (dedicated model) |
| `marketplace-ready` | `fal-ai/flux-pro/kontext` | marketplace/white-bg/contrast prompt |
| `studio-polish` | `fal-ai/flux-pro/kontext` | studio/editorial/premium prompt |

FAL output is post-processed through sharp for format/size normalisation so the
response contract remains identical to the sharp processor.

### Orchestration stages

| Stage | Responsibility |
|---|---|
| `analyze` | derive structured image facts from the uploaded asset |
| `intent normalize` | derive a strict JSON `intent_spec` from preset + image facts + optional goal |
| `shot plan` | generate 3-4 bounded structured creative candidates |
| `consistency normalize` | select or merge candidates into one brief |
| `prompt package` | generate FAL-ready structured prompt ingredients and materialize final prompt text |
| `execute` | run FAL as the image-generation backend for the AI path |
| `verify` | check output quality and decide whether to accept, retry once, or fall back |

### Sharp processor preset mapping (Phase 2, default)

| Preset | Max canvas | Fit | Key transforms |
|---|---|---|---|
| `clean-background` | 1200x1200 | inside | flatten->white, brightness+1.08, saturation-0.95, sharpen sigma=0.8 |
| `marketplace-ready` | 1000x1000 | contain (square) | flatten->white, saturation+1.12, linear contrast+1.12, sharpen sigma=1.0 |
| `studio-polish` | 1500x1500 | inside | brightness-0.97, saturation+1.18, fine sharpen (0.5, 1, 2) |

## Workstream Status

| Workstream | Owner | Status | Notes |
|---|---|---|---|
| Runnable frontend slice | Frontend Agent | done | upload -> preset -> process -> result flow |
| Phase 1 backend proxy | Backend Agent | done | Hono server, enhance route, validation |
| Frontend <-> backend wiring | Full Stack | done | BackendProcessor, Vite proxy, abort control |
| Integration hardening | Full Stack | done | signed sessions, multipart upload, persisted outputs, credits stub |
| SQLite runtime core | Full Stack | done | sessions, outputs, rate limits, and locks are durable across restart |
| Automation orchestrator | Full Stack | done | OpenRouter planning graph + FAL execution behind stable `/api/enhance` |
| Repo cleanup | Documentation | done | stale docs archived, all active docs updated |
| Real image processing (Phase 2) | Backend Agent | done | sharp processor, 3 presets, 14 tests |
| AI-provider integration (Phase 3) | Backend Agent | done | FAL.ai, 3 presets, 17 tests, provider-safe path |
| MVP hardening | Full Stack | done | request IDs, structured logs, stronger validation, provider URL allowlist |
| Payments / purchased credits | Product | not_started | next milestone; credits are stubbed server-side only |
| Customer product mode | Product Strategy | not_started | target state only |

## Current Blockers

No implementation blockers inside the current local MVP path.

## Next Action

1. Replace single-node SQLite blob persistence with cloud object storage plus retention controls
2. Add purchased credits / payments on top of the existing session credit stub
3. Decide whether AI traffic should remain synchronous or move to queued async jobs
