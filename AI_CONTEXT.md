# AI Context — Session Handoff File

> Read this first when starting a new AI coding session on this repo.
> Last updated: 2026-04-22. Verified against actual code.

## What This Repo Is

A local-first MVP for **AI product photo enhancement** targeting e-commerce sellers. Users upload a product photo, pick a preset, and get back an enhanced image. No prompts, no model selection — automation-first.

## What Exists (Verified)

### Frontend (`src/`)
- Vite + React 18 + TypeScript SPA
- Flow: upload → preset picker → process → comparison/download
- `BackendProcessor` sends multipart uploads to `/api/enhance`
- Session bootstrap via `GET /api/session`
- 7 tests passing

### Backend (`backend/`)
- Node.js + Hono + TypeScript server on port 3001
- Routes: `GET /api/session`, `POST /api/enhance`, `GET /api/outputs/:outputId`, `GET /api/health`
- **Orchestration pipeline**: `analyze → plan → execute → verify`
  - `analysis.ts`: sharp-based image analysis (brightness, contrast, sharpness, background, framing, readyScore)
  - `planner.ts`: strategy selection (sharp-only, ai-only, sharp-then-ai, ai-then-sharp, mock-only)
  - `prompt-builder.ts`: deterministic, preset-driven AI prompt construction (internal only)
  - `enhancement-orchestrator.ts`: coordinates pipeline with one retry and one fallback level
  - `verification.ts`: quality check against preset-specific thresholds
- **Three processors** (selected via `PROCESSOR` env var):
  - `sharp` (default): deterministic libvips transforms, no API key needed
  - `fal`: FAL.ai (background-removal + FLUX Kontext), needs `FAL_API_KEY`
  - `mock`: pass-through, for testing
- **SQLite runtime** (better-sqlite3, WAL mode):
  - Sessions with expiry and credit tracking
  - Transactional credit reservation (reserve before processing, refund on failure)
  - Output BLOBs with signed time-limited URLs
  - Rate limiting (per-IP and per-session sliding windows)
  - Processing locks (single-flight per session)
  - Automatic expired-state cleanup
- 63 tests passing

### Infrastructure
- Vite dev proxy: `/api` → `localhost:3001`
- CI: `.github/workflows/ci.yml` runs `npm run verify`
- Verify chain: `tsc --noEmit` → `vitest` → `vite build` → backend verify → `npm audit`
- Total: **70 tests passing**, zero type errors, clean build

## What Does NOT Exist

- **Payments** — credits are stubbed (free at session creation)
- **Cloud storage** — outputs are SQLite BLOBs (not S3/R2)
- **Async jobs** — AI processing is synchronous (5–30s for FAL)
- **Deployment config** — no Dockerfile, no TLS, no reverse proxy
- **User accounts** — sessions are anonymous cookies
- **Admin mode** — customer mode only

## Active Constraints (Do Not Break)

1. `/api/enhance` response contract is stable and public — do not change response shape
2. Output MIME type must be preserved from input (JPEG in → JPEG out)
3. Provider details (model names, prompts) must be hidden from customer-facing UI and responses
4. Credit reserve/consume/refund must remain transactional
5. Prompt construction must remain deterministic, preset-driven, and internal-only
6. `PROCESSOR_FAILURE_POLICY` controls fallback behavior: `strict` or `fallback-to-sharp`

## Decisions That Matter

| ID | Decision | Status |
|---|---|---|
| DEC-001 | Product direction: automation-first photo enhancement for e-commerce | Accepted |
| DEC-003 | Customer mode vs internal mode separation | Accepted |
| DEC-009 | Backend: Node.js + Hono + TypeScript (not Python) | Accepted |
| DEC-012 | Phase 2: sharp for deterministic processing | Accepted |
| DEC-013 | Phase 3: FAL.ai for AI processing; prompts hidden | Accepted |
| DEC-004–008 | Old playground proxy architecture | **Superseded** — never built |

Full log: `docs/04-decisions/decision-log.md`

## Dead Code to Be Aware Of

- `backend/src/validation.ts` — only consumed by its own test. Real validation is `backend/src/image-validation.ts`.
- `nano_banana_playground_prd.md` (root) — tombstone redirect to archive.

## Key Environment Variables

```
PROCESSOR=sharp|fal|mock          # which processor to use (default: sharp)
PROCESSOR_FAILURE_POLICY=strict|fallback-to-sharp
FAL_API_KEY=                      # required only when PROCESSOR=fal
APP_SESSION_SECRET=               # HMAC signing key (required in production)
DATABASE_PATH=backend/data/app.sqlite
DEFAULT_SESSION_CREDITS=3
```

Full list: `backend/.env.example`

## Doc Structure

```
docs/
├── 01-product/          # product definition, strategy tombstone
├── 02-architecture/     # current system, target system, security rules, known gaps
├── 03-progress/         # current status, working memory, roadmap, priorities
├── 04-decisions/        # decision log, open questions
├── 05-specs/            # phase 1 spec (tombstone — historical only)
├── 06-audits/           # code review and summary (partially updated post-fixes)
├── 07-meta/             # source-of-truth rules, agent work map, project overview
└── 08-archive/          # superseded docs (original PRD, old architecture rec, old spec, old strategy)
```

## Next Actions (Priority Order)

1. Payments integration (Stripe + credit purchase)
2. Cloud object storage (S3/R2 for output BLOBs)
3. Deployment config (Dockerfile + TLS)
4. Async job queue for AI processing
5. Processor strategy decision (sharp-always vs. hybrid)

## How To Run

```bash
# Install
npm install && npm --prefix backend install

# Dev (frontend + backend)
npm run dev          # frontend on :5173
npm --prefix backend run dev   # backend on :3001

# Verify everything
npm run verify       # typecheck + test + build + backend verify + audit
```
