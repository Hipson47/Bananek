# Working Memory

## Current Objective

Phase 2 real image processing is implemented via sharp. The `/api/enhance`
endpoint now returns genuinely transformed images. Next: decide on AI-provider
integration path behind the same `/api/enhance` seam.

## Decisions

- The default product direction is `AI product photo enhancement for e-commerce sellers` (DEC-001).
- The default customer experience is no-prompt, automation-first, and low-ticket (DEC-001).
- Customer Product Mode and Internal/Admin/Playground Mode must remain separate (DEC-003).
- Code, tests, and explicit decisions outrank strategy documents (DEC-002).
- Documentation must separate current state from target state and historical/planning material (DEC-011).
- Phase 1 backend uses Node.js + Hono + TypeScript (DEC-009).
- Phase 2 real processing uses sharp (libvips). Output MIME is preserved from input (DEC-012).
- Processor is selected via PROCESSOR env var: "sharp" (default) or "mock" (dev/test).

## Active Constraints

- The sharp processor returns genuinely transformed output -- not the original bytes.
- Output MIME type is preserved from input (PNG in -> PNG out, etc.).
- The `/api/enhance` contract is stable and unchanged from Phase 1.
- AI-provider integration is the next concern and must plug in behind the same seam.

## Files/Systems Touched (recent)

- `backend/src/processors/sharp-processor.ts` -- new; real preset transforms via sharp
- `backend/src/processors/index.ts` -- new; selects mock or sharp via PROCESSOR env var
- `backend/src/routes/enhance.ts` -- import updated to processors/index.js
- `backend/src/config.ts` -- added processor field, PROCESSOR env var validation
- `backend/package.json` -- added sharp ^0.34.5
- `backend/tests/enhance-route.test.ts` -- updated fixtures + descriptions; uses PROCESSOR=mock
- `backend/tests/sharp-processor.test.ts` -- new; 14 tests covering contract, transforms, resize, errors

## Open Risks

- Real processing quality is deterministic (sharp) but not AI-backed yet.
- No output storage -- processed images are returned inline as data URLs only.
- AI-provider integration remains the next major backend milestone.

## Next Exact Step

1. Decide which AI provider to integrate first (Gemini, FAL, OpenAI Image, etc.).
2. Implement the AI provider as a new processor behind the existing `/api/enhance` seam.
3. Add PROCESSOR=ai-{provider} env var path to processors/index.ts.
4. Add API key loading to config.ts (requireEnv pattern already in place).
