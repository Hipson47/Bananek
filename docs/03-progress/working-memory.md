# Working Memory

## Current Objective

Phase 3 AI integration is implemented via FAL.ai behind the existing `/api/enhance` seam.
The current rollout hardened the customer product path with provider-safe metadata, explicit failure policy,
and a SQLite-backed runtime core for sessions, credits, outputs, locks, and rate limits.
The enhancement path is now orchestrated as an OpenRouter planning graph plus FAL execution:
`analyze -> intent normalize -> shot plan -> consistency normalize -> prompt package -> execute -> verify`.
OpenRouter is planning-only. FAL remains the image-generation backend. Deterministic prompt construction still exists as the fallback path.
Next: move from single-node durable runtime to launch-grade infra: payments, cloud storage, and async jobs.

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
- Runtime state is persisted in SQLite at `DATABASE_PATH` (default `backend/data/app.sqlite`).
- Enhancement execution is orchestration-first, not direct generator-first.
- OpenRouter planning nodes return strict JSON only; no prose contracts are allowed.

## Active Constraints

- /api/enhance contract is stable and public; do not change response shape.
- Output MIME type is preserved from input regardless of processor.
- Provider details (model names, prompts) are hidden from customer-facing UI and response messaging.
- `PROCESSOR_FAILURE_POLICY` is now explicit: `strict` or `fallback-to-sharp`.
- Credit reserve/consume and refund must remain transactional.
- Prompt construction must remain deterministic, preset-driven, and internal-only.
- OpenRouter failures must degrade to deterministic preset-based planning, not to chat behavior.

## Processor Selection

| PROCESSOR | Behaviour | Key required |
|---|---|---|
| sharp (default) | Deterministic libvips transforms | No |
| fal | AI transforms via FAL.ai | FAL_API_KEY |
| mock | Original bytes returned unchanged | No |

## Files/Systems Touched (recent)

- `backend/src/processors/fal-processor.ts` -- new; FAL.ai AI processor
- `backend/src/processors/index.ts` -- updated; supports sharp/fal/mock selection
- `backend/src/config.ts` -- updated; session, database, limiter, output, and processor failure policy support
- `backend/tests/fal-processor.test.ts` -- new; 17 tests (presets, auth header, error mapping)
- `backend/src/storage/database.ts` -- new; SQLite bootstrap and migrations
- `backend/src/storage/session-store.ts` -- updated; SQLite-backed sessions and usage events
- `backend/src/storage/output-store.ts` -- updated; SQLite-backed output persistence
- `backend/src/security/rate-limiter.ts` -- updated; SQLite-backed counters
- `backend/src/security/session-locks.ts` -- new; SQLite-backed single-flight guard
- `backend/src/orchestration/*` -- new; OpenRouter client, intent/shot/consistency/prompt/verification nodes, deterministic fallbacks, FAL graph orchestration

## Open Risks

- FAL.ai is a paid service; requests cost credits. Transactional credit tracking exists, but real billing and purchased-credit reconciliation do not.
- OpenRouter adds another paid dependency for planning tokens; cost controls are still basic.
- FAL API latency is higher than sharp (AI inference can take 5-30s).
- SQLite blob storage is durable on one node, but not suitable for multi-instance deployment or long-lived asset delivery.
- Model IDs (fal-ai/flux-pro/kontext) may change; pin versions when stable.

## Next Exact Step

1. Decide whether OpenRouter-planned FAL should be the production default, or whether sharp stays the default launch mode.
2. Add billing/credits purchase and reconciliation if `fal` is used in production.
3. Replace SQLite blob delivery with object storage (S3/R2) before multi-instance production rollout.
