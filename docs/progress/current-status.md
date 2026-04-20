# Current Status

## Current Objective

Phase 2 real image processing implemented via sharp. The `/api/enhance` endpoint
now returns genuinely transformed images for all three presets.
Next: AI-provider integration behind the same seam.

## Active Milestone

Phase 2 -- real image processing via sharp -- complete

## Current State

- `src/` contains a runnable Vite + React + TypeScript app (upload -> preset -> process -> result)
- `backend/` contains a Node.js + Hono + TypeScript server with `POST /api/enhance` and `GET /api/health`
- Frontend `BackendProcessor` calls `/api/enhance` -- unchanged from Phase 1
- Vite dev proxy routes `/api` -> `localhost:3001`
- **Backend sharp processor applies real per-preset transforms** (auto-orient, resize, flatten, modulate, sharpen)
- Mock processor is retained and selectable via `PROCESSOR=mock` env var
- `npm test` (root): 39 tests pass (7 frontend + 32 backend)
  - frontend: 3 `validateImageFile` + 4 `backendProcessor`
  - backend: 9 `validation` + 9 `enhance-route` (contract, uses mock) + 14 `sharp-processor` (real transforms)
- `tsc --noEmit`: clean in both frontend and backend
- `npm run build`: frontend production build succeeds

## Processor Selection

Set `PROCESSOR` env var before starting the backend:

| Value | Behaviour |
|---|---|
| `sharp` (default) | Real image transforms via libvips; output differs from input |
| `mock` | Original bytes returned unchanged; no transformation; useful for contract-only tests |

## Preset Behaviours (sharp processor)

| Preset | Max canvas | Fit | Key transforms |
|---|---|---|---|
| `clean-background` | 1200x1200 | inside | flatten->white, brightness+1.08, saturation-0.95, sharpen sigma=0.8 |
| `marketplace-ready` | 1000x1000 | contain (square) | flatten->white, saturation+1.12, linear contrast+1.12, sharpen sigma=1.0 |
| `studio-polish` | 1500x1500 | inside | brightness-0.97, saturation+1.18, fine sharpen (0.5, 1, 2) |

## Workstream Status

| Workstream | Owner | Status | Notes |
|---|---|---|---|
| Runnable frontend slice | Frontend Agent | done | upload -> preset -> process -> result flow |
| Phase 1 backend proxy | Backend Agent | done | Hono server, enhance route, validation, mock processor |
| Frontend <-> backend wiring | Full Stack | done | BackendProcessor, Vite proxy, abort control, adapter coverage |
| Integration hardening | Full Stack | done | download button, drag-and-drop, AbortController, body limit, error logging |
| Repo cleanup | Documentation | done | stale docs archived, all active docs updated |
| Real image processing | Backend Agent | done | sharp processor, 3 presets, 14 new tests, processor env var selection |
| AI-provider integration | Backend Agent | not_started | next milestone; plug in behind /api/enhance seam |
| Customer product mode | Product Strategy | not_started | target state only |

## Current Blockers

None.

## Next Action

1. Choose AI provider for Phase 3 (Gemini Vision, FAL, OpenAI, or similar)
2. Implement as a new processor file behind the existing `/api/enhance` seam
3. Add `PROCESSOR=ai-{provider}` path to `processors/index.ts`
4. Wire API key via `requireEnv` in `config.ts` (pattern already established)
