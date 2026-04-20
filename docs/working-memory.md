# Working Memory

## Current Objective

Phase 1 backend proxy is implemented. Harden the current boundary and prepare for real backend processing.

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
- The next milestone is real backend processing, likely `sharp` first, with any later AI provider integration behind the same `/api/enhance` endpoint.
- The original Phase 1 spec is now historical context, not an implementation to-do list.

## Files/Systems Touched

- `backend/` — new directory: Hono server, mock processor, enhance route, validation, types, presets, tests
- `src/features/enhancer/processors/backendProcessor.ts` — frontend adapter calling `/api/enhance`
- `src/App.tsx` — active app wired to `BackendProcessor`
- `vite.config.ts` — modified: added dev proxy `/api` → `localhost:3001`
- `docs/working-memory.md`
- `docs/progress/current-status.md`

## Open Risks

- The mock processor does not perform actual image transformations — it returns the input image as-is with a simulated delay.
- Real processing quality, output storage, and paid delivery concerns are still unimplemented.
- AI-provider integration remains a later concern and should stay behind the established backend seam.

## Next Exact Step

1. Replace the backend mock processor with real processing, likely `sharp`.
2. Keep the same `BackendProcessor` and `/api/enhance` seam while the backend implementation changes.
3. Decide where later AI-provider integration should plug in behind that same seam.
