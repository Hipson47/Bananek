# Current Status

## Current Objective

Phase 3 AI integration implemented via FAL.ai and hardened for MVP. The `/api/enhance`
endpoint now supports deterministic default processing plus AI-backed processing with safe fallback.
Next: production processor strategy decision and billing/delivery controls.

## Active Milestone

MVP product-path implementation -- coherent

## Current State

- `src/` contains a runnable Vite + React + TypeScript app (upload -> preset -> process -> result)
- `backend/` contains a Node.js + Hono + TypeScript server with `POST /api/enhance` and `GET /api/health`
- Frontend `BackendProcessor` calls `/api/enhance` -- unchanged from Phase 1
- Vite dev proxy routes `/api` -> `localhost:3001`
- **Three processors available**, selected via `PROCESSOR` env var:
  - `sharp` (default): deterministic libvips transforms, no API key required
  - `fal`: AI transforms via FAL.ai (background-removal + FLUX Kontext), can fall back to `sharp`
  - `mock`: original bytes returned unchanged, for contract-only tests
- customer-facing UI no longer exposes provider/model details
- processing failures now return customer-safe messages; provider failures can fall back to `sharp`
- `npm test` (root): 58 tests pass (7 frontend + 51 backend)
  - frontend: 3 `validateImageFile` + 4 `backendProcessor`
  - backend: 9 `validation` + 11 `enhance-route` + 14 `sharp-processor` + 17 `fal-processor`
- `tsc --noEmit`: clean in both frontend and backend
- `npm run build`: frontend production build succeeds

## Processor / Preset Configuration

### FAL processor preset mapping

| Preset | FAL model | Prompt |
|---|---|---|
| `clean-background` | `fal-ai/background-removal` | n/a (dedicated model) |
| `marketplace-ready` | `fal-ai/flux-pro/kontext` | marketplace/white-bg/contrast prompt |
| `studio-polish` | `fal-ai/flux-pro/kontext` | studio/editorial/premium prompt |

FAL output is post-processed through sharp for format/size normalisation so the
response contract remains identical to the sharp processor.

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
| Integration hardening | Full Stack | done | download, drag-and-drop, AbortController, body limit |
| Repo cleanup | Documentation | done | stale docs archived, all active docs updated |
| Real image processing (Phase 2) | Backend Agent | done | sharp processor, 3 presets, 14 tests |
| AI-provider integration (Phase 3) | Backend Agent | done | FAL.ai, 3 presets, 17 tests, provider-safe path |
| MVP hardening | Full Stack | done | customer-safe labels/errors, fallback, env/docs alignment |
| Billing / credits / storage | Product | not_started | next milestone |
| Customer product mode | Product Strategy | not_started | target state only |

## Current Blockers

None.

## Next Action

1. Choose production processor: `sharp` (stable), `fal` (AI quality/cost), or per-preset hybrid
2. Add billing/credit tracking if `fal` is used in production
3. Add output storage (S3/R2) if inline data URLs become too large for the intended download path
