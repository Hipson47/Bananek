# Current System — Verified Against Code

> Last verified: 2026-04-22. Every claim below corresponds to code that exists in the repository.

## What This Is

A local-first MVP for AI product photo enhancement, targeting e-commerce sellers. The product accepts an image and a preset, processes it server-side, and returns an enhanced version via a signed download URL.

## Runtime Architecture

```
Browser (Vite + React 18 + TypeScript)
  └─ BackendProcessor → POST /api/enhance (multipart)
       │
Hono server (Node.js + TypeScript, port 3001)
  ├─ Middleware: CORS, body limit (20MB), request ID, session resolution
  ├─ GET  /api/session          → create/refresh signed session
  ├─ POST /api/enhance          → orchestrated enhancement
  ├─ GET  /api/outputs/:id      → serve processed image (signed URL)
  └─ GET  /api/health           → liveness check
       │
  Orchestration: analyze → plan → execute → verify
       │
  OpenRouter planning graph for `PROCESSOR=fal`:
    ├─ intent normalization (strict JSON)
    ├─ shot planning (3-4 structured candidates)
    ├─ consistency normalization
    ├─ prompt package generation
    └─ verification node
       │
  Processors (selected via PROCESSOR env var):
    ├─ sharp (default): deterministic libvips transforms
    ├─ fal: image execution via FAL.ai (background-removal, FLUX Kontext)
    └─ mock: pass-through for testing
       │
  Storage: SQLite (better-sqlite3, WAL mode)
    ├─ sessions (credits, expiry)
    ├─ usage_events (credit reserve/consume/refund audit trail)
    ├─ outputs (image BLOBs + signed URLs)
    ├─ rate_limits (per-IP and per-session sliding windows)
    └─ session_processing_locks (single-flight guard per session)
```

## Enhancement Flow

1. **Session bootstrap**: browser calls `GET /api/session`, receives signed cookie + session ID + credit count.
2. **Upload**: browser sends multipart form (image + presetId) to `POST /api/enhance` with `X-Session-Id` header.
3. **Validation**: server checks rate limits (IP + session), acquires processing lock, validates image (sharp metadata inspection: format, dimensions, pixel count, animated frames, MIME match).
4. **Credit reservation**: atomic SQLite transaction reserves 1 credit before processing begins.
5. **Orchestration**:
   - `analyze`: extract image facts (brightness, contrast, sharpness, background character, framing, marketplace readyScore) via sharp + 16x16 thumbnail.
   - `intent normalize`: OpenRouter converts preset + image facts (+ optional goal) into a strict JSON `intent_spec`.
   - `shot plan`: OpenRouter generates 3-4 bounded structured creative candidates.
   - `consistency normalize`: OpenRouter selects or merges one final brief.
   - `prompt package`: OpenRouter generates structured prompt ingredients; final prompt text is materialized deterministically.
   - `execute`: FAL runs as the sole image-generation backend on the AI path.
   - `verify`: heuristic checks plus a structured verification node may trigger one retry or fallback.
6. **Persistence**: output stored as BLOB in SQLite; signed URL generated with configurable TTL.
7. **Response**: `ProcessedImageResult` with `processedUrl` pointing to `/api/outputs/:outputId?expires=...&sig=...`.
8. **Error path**: on failure, credit is refunded via atomic transaction; processing lock is always released.

## Presets

| Preset ID | Sharp transforms | FAL model |
|---|---|---|
| `clean-background` | 1200px, flatten→white, brighten, desaturate, sharpen | `fal-ai/background-removal` |
| `marketplace-ready` | 1000px square, flatten→white, saturate, contrast, sharpen | `fal-ai/flux-pro/kontext` |
| `studio-polish` | 1500px, darken slightly, saturate, fine sharpen | `fal-ai/flux-pro/kontext` |

## Key Files

| Area | Files |
|---|---|
| Entry point | `backend/src/index.ts` (createApp + serve) |
| Routes | `backend/src/routes/enhance.ts` |
| Config | `backend/src/config.ts` |
| Orchestration | `backend/src/orchestration/*.ts` (analysis, OpenRouter client, intent/shot/consistency/prompt/verification nodes, deterministic planner fallback, enhancement-orchestrator, types) |
| Processors | `backend/src/processors/{sharp,fal,mock}-processor.ts`, `index.ts`, `contracts.ts` |
| Storage | `backend/src/storage/{database,session-store,output-store,runtime-maintenance}.ts` |
| Security | `backend/src/security/{rate-limiter,session-locks}.ts`, `backend/src/utils/signing.ts` |
| Validation | `backend/src/image-validation.ts` |
| Frontend | `src/App.tsx`, `src/features/enhancer/processors/backendProcessor.ts`, `src/features/enhancer/processors/backendSession.ts` |

## Test Coverage

- 76 total tests (69 backend + 7 frontend)
- Backend: route integration tests (SQLite test DB, mocked OpenRouter and FAL), sharp processor tests (real transforms), FAL processor tests (HTTP mocking), OpenRouter client tests, orchestration graph tests, validation tests
- Frontend: BackendProcessor fetch mocking, file validation

## What Does NOT Exist

- Payments or purchased credits (credits are stubbed at session creation)
- Cloud object storage (images stored as SQLite BLOBs)
- Async job queue (all processing is synchronous in the request cycle)
- Deployment configuration (no Dockerfile, no reverse proxy, no TLS)
- User accounts or authentication (sessions are anonymous, cookie-based)
- Admin or playground mode (customer-mode only)
- `backend/src/validation.ts` is dead code — not used by any route
