# Working Memory

## Current Objective

Phase 3 AI integration is implemented via FAL.ai behind the existing /api/enhance seam.
The frontend, route contract, and sharp processor are all unchanged.
Next: choose whether to route specific presets to FAL vs sharp in production, or add billing/delivery.

## Decisions

- The default product direction is `AI product photo enhancement for e-commerce sellers` (DEC-001).
- The default customer experience is no-prompt, automation-first, and low-ticket (DEC-001).
- Customer Product Mode and Internal/Admin/Playground Mode must remain separate (DEC-003).
- Code, tests, and explicit decisions outrank strategy documents (DEC-002).
- Documentation must separate current state from target state and historical/planning material (DEC-011).
- Phase 1 backend uses Node.js + Hono + TypeScript (DEC-009).
- Phase 2 real processing uses sharp (libvips). Output MIME is preserved from input (DEC-012).
- Phase 3 AI processing uses FAL.ai. Preset prompts hidden from frontend (DEC-013).
- Processor selected via PROCESSOR env var: "sharp" (default), "fal", or "mock".

## Active Constraints

- /api/enhance contract is stable and public; do not change response shape.
- Output MIME type is preserved from input regardless of processor.
- FAL_API_KEY must be set when PROCESSOR=fal; validated at server startup.
- Provider details (model names, prompts) are hidden from frontend.

## Processor Selection

| PROCESSOR | Behaviour | Key required |
|---|---|---|
| sharp (default) | Deterministic libvips transforms | No |
| fal | AI transforms via FAL.ai | FAL_API_KEY |
| mock | Original bytes returned unchanged | No |

## Files/Systems Touched (recent)

- `backend/src/processors/fal-processor.ts` -- new; FAL.ai AI processor
- `backend/src/processors/index.ts` -- updated; supports sharp/fal/mock selection
- `backend/src/config.ts` -- updated; "fal" valid PROCESSOR value, startup FAL_API_KEY check
- `backend/tests/fal-processor.test.ts` -- new; 17 tests (presets, auth header, error mapping)

## Open Risks

- FAL.ai is a paid service; requests cost credits. No billing/credit tracking yet.
- FAL API latency is higher than sharp (AI inference can take 5-30s).
- No output storage -- results returned inline as data URLs.
- Model IDs (fal-ai/flux-pro/kontext) may change; pin versions when stable.

## Next Exact Step

1. Decide on production processor strategy: sharp always, fal always, or per-preset hybrid.
2. Add billing/credits tracking if FAL is used in production.
3. Add output storage (S3/R2) for larger results if needed.
