# Working Memory

## Current Objective

Phase 1 backend proxy is implemented. Stabilize, extend test coverage if needed, and prepare for real provider integration.

## Decisions

- The default product direction is `AI product photo enhancement for e-commerce sellers` (DEC-001).
- The default customer experience is no-prompt, automation-first, and low-ticket (DEC-001).
- Customer Product Mode and Internal/Admin/Playground Mode must remain separate (DEC-003).
- Code, tests, and explicit decisions outrank strategy documents (DEC-002).
- Documentation must separate current state from target state and historical/planning material (DEC-011).
- Phase 1 backend uses Node.js + Hono + TypeScript (DEC-009).
- Phase 1 spec (written for the original playground codebase) was adapted to the current customer-mode enhancement app during implementation.

## Active Constraints

- The backend mock processor returns images without transformation — proving the HTTP pipeline, not image processing.
- A future phase will add real AI provider calls (Gemini, FAL) behind the same `/api/enhance` endpoint.
- The original Phase 1 spec references files/types from a previous playground codebase that no longer exists; the adapted implementation uses the current `ImageProcessor` interface.

## Files/Systems Touched

- `backend/` — new directory: Hono server, mock processor, enhance route, validation, types, presets, tests
- `src/features/enhancer/processors/backendProcessor.ts` — new: frontend adapter calling `/api/enhance`
- `src/App.tsx` — modified: swapped `MockImageProcessor` for `BackendProcessor`
- `vite.config.ts` — modified: added dev proxy `/api` → `localhost:3001`
- `docs/working-memory.md`
- `docs/progress/current-status.md`

## Open Risks

- The mock processor does not perform actual image transformations — it returns the input image as-is with a simulated delay.
- Model registry, provider adapters, and API key management from the original spec are not implemented because the current codebase is a customer-mode app without those concepts.
- The `MockImageProcessor` (canvas-based) is still in the codebase but no longer imported by App.tsx.

## Next Exact Step

1. Add real image processing to the backend (e.g. sharp-based transformations matching the canvas mock, or real AI provider integration).
2. Clean up: remove or archive the unused `MockImageProcessor` if it's no longer needed for fallback.
3. Extend tests: add frontend integration tests for `BackendProcessor`.
4. Update AGENTS.md to reflect that `src/` exists and is runnable.
