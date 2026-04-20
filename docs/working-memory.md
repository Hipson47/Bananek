# Working Memory

## Current Objective

Phase 1 backend proxy is implemented, hardened, and the repo is cleaned. Next: replace the mock processor with real image processing.

## Decisions

- The default product direction is `AI product photo enhancement for e-commerce sellers` (DEC-001).
- The default customer experience is no-prompt, automation-first, and low-ticket (DEC-001).
- Customer Product Mode and Internal/Admin/Playground Mode must remain separate (DEC-003).
- Code, tests, and explicit decisions outrank strategy documents (DEC-002).
- Documentation must separate current state from target state and historical/planning material (DEC-011).
- Phase 1 backend uses Node.js + Hono + TypeScript (DEC-009).

## Active Constraints

- The backend mock processor returns images without transformation — proving the HTTP pipeline, not image processing.
- The next milestone is real backend processing, likely `sharp` first, with any later AI provider integration behind the same `/api/enhance` endpoint.
- The original Phase 1 spec described a different system (POST /api/generate) and is archived in `docs/archive/`.

## Files/Systems Touched (recent)

- `backend/src/config.ts` — added `requireEnv` / `optionalEnv` pattern with PORT validation
- `backend/src/index.ts` — body limit raised to 20 MB
- `backend/src/validation.ts` — returns `mimeType` in parsed result (no second regex in route)
- `backend/src/routes/enhance.ts` — removed MIME duplication, added `console.error` for unexpected errors
- `backend/src/processors/mock-processor.ts` — restored from truncation, fully complete
- `backend/tests/enhance-route.test.ts` — restored from truncation, 9 tests
- `src/App.tsx` — AbortController for in-flight request cancellation on reset
- `src/components/ComparisonPanel.tsx` — download button
- `src/components/UploadPanel.tsx` — drag-and-drop support
- `src/features/enhancer/processors/backendProcessor.ts` — simplified toBase64, signal passthrough
- `docs/archive/` — created; 4 stale docs moved here

## Open Risks

- The mock processor does not perform actual image transformations — it returns the input image as-is with a simulated delay.
- Real processing quality, output storage, and paid delivery concerns are still unimplemented.
- AI-provider integration remains a later concern and should stay behind the established backend seam.

## Next Exact Step

1. Replace the backend mock processor with real processing, likely `sharp` for deterministic transforms.
2. Keep the same `BackendProcessor` and `/api/enhance` seam while the backend implementation changes.
3. Decide where later AI-provider integration should plug in behind that same seam.
