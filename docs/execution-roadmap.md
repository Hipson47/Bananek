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

- `Verified Fact`: complete -- FAL.ai processor; background-removal + FLUX Kontext; 17 tests; PROCESSOR=fal; FAL_API_KEY startup validation

### Deliverables

- AI provider processor behind the same `/api/enhance` seam
- PROCESSOR=ai-{provider} env var