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

- `Verified Fact`: complete — Hono backend with `POST /api/enhance`, mock processor, validation, 25 passing tests (7 frontend + 18 backend), frontend wired via BackendProcessor and Vite proxy

### Deliverables

- backend scaffold ✓
- server-side provider routing (mock processor in place; real processing is next)
- customer-safe enhancement contract ✓ (`/api/enhance` with preset-based flow)
- separation between product mode and internal playground mode (frontend separation done; playground isolation not yet formal)

### Blockers Removed

- provider keys in browser ✓
- prompt-first UX coupling ✓

## Phase 2 — Real Image Processing

### Goal

Replace the mock processor with real, deterministic image processing.

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

### Deliverables

- AI provider processor behind the same `/api/enhance` seam
- PROCESSOR=ai-{provider} env var path
- API key management via requireEnv pattern
- quality comparison: sharp vs AI output

## Phase 4 — First Paid Workflow

### Goal

Ship one narrow, automation-first paid flow for product photo enhancement.

### Deliverables

- one customer-facing task
- result preview
- paid delivery or credit consumption
- minimal asset persistence

## Phase 3 — Operational Readiness

### Goal

Make the first workflow trustworthy enough for real users.

### Deliverables

- upload hardening
- delivery controls
- cost tracking
- basic analytics
- error tracking

## Now / Next / Later

### Now

- choose AI provider for Phase 3 integration
- implement AI provider processor behind the existing `/api/enhance` seam

### Next

- paid delivery / credit consumption (Phase 4)
- output storage for async delivery

### Later

- billing/credits
- auth and history
- richer presets
- batch processing

## Current Recommended Milestones

### Milestone 1

Documentation system and project coordination are in place.

### Milestone 2

Backend accepts a predefined enhancement request and hides provider details from the client.

### Milestone 3

Customer can complete one end-to-end product photo enhancement flow.

### Milestone 4

Paid delivery, tracking, and basic operational controls exist.
