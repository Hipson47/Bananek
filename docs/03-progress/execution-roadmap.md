# Execution Roadmap

## Document Status

This is a target-state roadmap. It is not evidence that the corresponding implementation exists in the current filesystem snapshot.

## Planning Rule

Order work by:
1. blocker removal
2. security impact
3. revenue enablement
4. dependency order
5. verification ease

## Phase 0 — Coordination Foundation

### Goal

Create shared docs, role boundaries, and a stable project narrative.

### Status

- `Verified Fact`: complete — documentation system, role map, workstream map, and progress tracking are in place

### Deliverables

- documentation system
- role map
- workstream map
- progress tracking format

## Phase 1 — Secure Product Foundation

### Goal

Move from browser-playground behavior to a backend-controlled enhancement pipeline.

### Status

- `Verified Fact`: complete -- Hono backend with `POST /api/enhance`, validation, frontend wired via BackendProcessor and Vite proxy

### Deliverables

- backend scaffold ✓
- server-side provider routing (sharp processor; PROCESSOR=mock available for dev)
- customer-safe enhancement contract ✓ (`/api/enhance` with preset-based flow)
- separation between product mode and internal playground mode (frontend separation done; playground isolation not yet formal)

### Blockers Removed

- provider keys in browser ✓
- prompt-first UX coupling ✓

## Phase 2 — Real Image Processing

### Goal

Replace the mock processor with real, deterministic image processing via sharp.

### Status

- `Verified Fact`: complete — sharp processor implemented with 3 presets, 14 tests, processor env var selection

### Deliverables

- sharp processor with 3 distinct preset pipelines ✓
- auto-orient, resize, flatten, modulate, sharpen per preset ✓
- processor selection via PROCESSOR env var ✓
- 14 sharp-processor tests (contract, transforms, resize constraints, error handling) ✓
- `/api/enhance` contract unchanged ✓

## Phase 3 — AI-Backed Processing

### Goal

Replace or augment sharp with an AI provider for preset-based enhancement.

### Status

- `Verified Fact`: complete -- FAL.ai processor implemented; `PROCESSOR=fal` is supported; runtime can fall back to `sharp` when configured; provider/model details stay hidden from customer UI

### Deliverables

- AI provider processor behind the same `/api/enhance` seam ✓
- `PROCESSOR=fal` env var selection ✓
- preset-specific orchestration for background cleanup and marketplace enhancement ✓
- backend-owned provider secret handling via `FAL_API_KEY` ✓
- customer-safe API errors and metadata that do not expose provider/model details ✓
- explicit processor failure policy via `PROCESSOR_FAILURE_POLICY` ✓

## Phase 4 — MVP Hardening

### Goal

Make the implemented product path coherent enough for MVP preparation without changing the public enhancement contract.

### Status

- `Verified Fact`: complete -- active customer path is preset-based frontend -> `/api/enhance` -> backend processor seam (`sharp`, `fal`, or `mock`), with test coverage and customer-safe error handling
- `Verified Fact`: complete -- runtime state is durable on a single node via SQLite (sessions, credits, rate limits, locks, outputs)

### Deliverables

- stable `/api/enhance` contract across processor strategies ✓
- frontend wired only to backend adapter ✓
- provider/model details removed from customer-facing UI ✓
- runtime fallback behavior for AI processing failures ✓
- truthful `.env.example` for current runtime modes ✓
- signed session bootstrap, persisted output delivery, and credits stub ✓
- SQLite-backed runtime core, migrations, and cleanup of expired runtime state ✓
- docs synchronized to current implementation and next-step reality ✓

## Phase 5 — Automation Orchestration

### Goal

Turn enhancement execution into a deterministic-first automation pipeline instead of a direct processor call.

### Status

- `Verified Fact`: complete -- `/api/enhance` now runs an orchestration graph with deterministic fallbacks behind the stable public contract

### Deliverables

- structured image analysis for format, framing, brightness, contrast, and marketplace signals ✓
- deterministic internal prompt builder for AI execution steps ✓
- post-process verification with one retry/fallback decision ✓
- structured orchestration metadata for logs and tests ✓
- route integration preserved without frontend API redesign ✓

## Phase 6 — OpenRouter Planning Graph

### Goal

Use OpenRouter only for structured planning/intelligence while keeping FAL as the sole image-generation backend on the AI path.

### Status

- `Verified Fact`: complete -- OpenRouter planning nodes now drive the `fal` path with strict JSON outputs and deterministic fallback behavior

### Deliverables

- OpenRouter client with timeout, retry, strict schema requests, and safe error mapping ✓
- typed nodes for intent normalization, shot planning, consistency normalization, prompt packaging, and verification ✓
- graph-style orchestration where planning feeds one final FAL execution path ✓
- deterministic fallback prompt construction when OpenRouter planning fails ✓
- end-to-end route coverage with mocked OpenRouter + mocked FAL ✓

## Next Decision Layer

The next product decision is no longer "whether to add a backend" or "whether to add AI support."
It is:

- which processor strategy should be the default production mode for launch: `sharp`, `fal`, or a hybrid rollout
- what cloud storage, billing, and delivery layer should replace the current single-node SQLite runtime core
