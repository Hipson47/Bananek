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

## Phase 2 — First Paid Workflow

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

- replace backend mock processor with real image processing (`sharp`-based transforms)
- keep the same `/api/enhance` contract while evolving backend internals

### Next

- decide whether first real-processing step is deterministic ops only or an AI-backed preset pipeline
- wire AI provider behind the established backend seam (not in browser)

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
