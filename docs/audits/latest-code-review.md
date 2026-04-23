# Code Review Audit — 2026-04-22

> Historical audit snapshot from before the 2026-04-23 async-job and object-storage hardening pass. Use current code, tests, and `docs/03-progress/current-status.md` for present-state truth.

Scope: current working tree, active runtime paths, tests, configs, env usage, docs vs implementation.

Audit standard: technically excellent automation-first image enhancement product, not demo completeness.

Source of truth used for this audit:
- active frontend and backend code under `src/` and `backend/src/`
- active tests under `src/**.test.ts` and `backend/tests/`
- runtime/config files (`package.json`, `backend/package.json`, `backend/.env.example`, `vite.config.ts`)
- current docs in `README.md`, `docs/02-architecture`, `docs/03-progress`, `docs/04-decisions`

What was explicitly verified in code:
- candidate graph planning
- rich prompt package
- consistency memory
- verification scoring
- retry / replan behavior
- preserved deterministic fallback paths

What was not verified:
- real production deployment topology
- real OpenRouter output quality/cost behavior under live traffic
- real FAL quality/cost under user load
- browser E2E behavior in a real browser, because no Playwright/browser suite exists

## Executive Verdict
This is no longer fake architecture. The backend really does run a structured orchestration pipeline with scored candidates, rich internal prompt packages, SQLite-backed runtime state, OpenRouter JSON-only planning nodes, and preserved sharp fallback behavior. But it is still short of technical excellence because the orchestration layer is more ambitious than the product boundary around it: verification can still fail and the request still returns `200`, batch consistency is mostly an internal hook with no real product path feeding it, config is re-read on hot paths, docs are already drifting behind the code again, and there is still dead compatibility code from old phases. Right now this repo is a strong advanced MVP codebase, not a production-grade automation system.

## What Is Actually Strong
- The product surface is disciplined. The customer flow is still clean, preset-based, and hides provider details well. See [src/App.tsx](/mnt/c/Users/marci/Pictures/bananek/src/App.tsx:1), [src/features/enhancer/processors/backendProcessor.ts](/mnt/c/Users/marci/Pictures/bananek/src/features/enhancer/processors/backendProcessor.ts:1), and [backend/src/routes/enhance.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/routes/enhance.ts:1).
- Runtime durability is real now. Sessions, credits, outputs, rate limits, and processing locks all live in SQLite, not JSON files or in-memory maps. See [backend/src/storage/database.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/database.ts:1), [backend/src/storage/session-store.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/session-store.ts:1), [backend/src/storage/output-store.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/output-store.ts:1), [backend/src/security/rate-limiter.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/security/rate-limiter.ts:1), and [backend/src/security/session-locks.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/security/session-locks.ts:1).
- The FAL execution path is not toy code. It has timeout handling, provider error mapping, host allowlisting, image size checks, and sharp normalization. See [backend/src/processors/fal-processor.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/processors/fal-processor.ts:1).
- OpenRouter integration is constrained properly at the protocol level. It is planning-only, schema-shaped, temperature `0`, fixed seed, strict JSON schema, and retries only for specific failure classes. See [backend/src/orchestration/openrouter-client.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/openrouter-client.ts:1).
- The orchestration maturity pass is real in code, not just in docs:
  - candidate graph planner: [backend/src/orchestration/planner.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/planner.ts:1)
  - rich prompt package: [backend/src/orchestration/prompt-builder-node.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/prompt-builder-node.ts:1), [backend/src/orchestration/types.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/types.ts:1)
  - consistency memory: [backend/src/orchestration/consistency-memory.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/consistency-memory.ts:1)
  - verification scoring: [backend/src/orchestration/verification.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/verification.ts:1)
  - retry / replan: [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:1)
- Test coverage is meaningfully better than average for a repo at this stage. The repo currently passes `80/80` root tests and `73/73` backend tests under the current workspace verification flow.

## Critical Problems
1. `HIGH`: verification is advisory, not authoritative.
The orchestrator can return a final result even when verification still says the output failed quality checks. After one retry or replan, the code returns the result regardless of final verification failure. That means the system can claim mature verify/recover behavior while still shipping low-quality outputs as success responses.
Files:
- [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:253)
- [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:312)
- [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:361)

2. `HIGH`: consistency memory is mostly disconnected from the actual product path.
The backend supports `consistencyMemory`, but the customer product path has no batch primitive, no catalog/session style profile, and no persistence of this memory between related jobs. The frontend never sends it. In practice this means the repo can truthfully say “consistency memory exists,” but not that product users get consistent catalog styling across a batch.
Files:
- [backend/src/orchestration/types.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/types.ts:60)
- [backend/src/orchestration/consistency-memory.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/consistency-memory.ts:1)
- [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:181)
- [src/App.tsx](/mnt/c/Users/marci/Pictures/bananek/src/App.tsx:1)

3. `HIGH`: the planner mixes real strategy with fake sophistication.
For `PROCESSOR=sharp`, the planner returns multiple “candidate” plans like `premium_retouch_pipeline` and `conservative_marketplace_fix`, but they are just one-step `sharp` plans with different labels. That inflates architectural complexity without creating genuinely distinct deterministic pipelines. The same problem exists in telemetry: `attemptedStrategies` mixes candidate IDs and actual strategy names interchangeably.
Files:
- [backend/src/orchestration/planner.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/planner.ts:69)
- [backend/src/orchestration/planner.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/planner.ts:295)
- [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:213)

4. `HIGH`: config loading is still spread across hot paths.
The repo has both `readConfig()` and a module-level `config`, but active runtime paths still call `readConfig()` per request and from inside processor helpers. That means repeated env parsing, runtime inconsistency if env mutates, and avoidable startup/runtime split-brain.
Files:
- [backend/src/routes/enhance.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/routes/enhance.ts:71)
- [backend/src/storage/database.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/database.ts:79)
- [backend/src/processors/fal-processor.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/processors/fal-processor.ts:149)
- [backend/src/config.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/config.ts:1)

5. `HIGH`: active docs are already drifting behind the orchestration code.
The docs claim the automation orchestrator exists, but several current-state docs still describe the older OpenRouter graph and stale test counts, while the older audit in `docs/06-audits/` is materially outdated. The repo is recreating the same docs-vs-code problem it already had before.
Files:
- [docs/03-progress/current-status.md](/mnt/c/Users/marci/Pictures/bananek/docs/03-progress/current-status.md:1)
- [docs/03-progress/working-memory.md](/mnt/c/Users/marci/Pictures/bananek/docs/03-progress/working-memory.md:1)
- [docs/06-audits/latest-code-review.md](/mnt/c/Users/marci/Pictures/bananek/docs/06-audits/latest-code-review.md:1)

## Hidden Problems Most Teams Miss
1. `HIGH`: multi-step plans mislabel later steps as retries.
`executePlan()` marks any step after index `0` as `"retry"` stage unless the step prompt says otherwise. That is semantically wrong for planned multi-step pipelines like `background -> upscale -> normalize`. It pollutes telemetry and may affect processor behavior later if stage starts meaning more than logging.
File:
- [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:43)

2. `HIGH`: verification scoring is output-only and only lightly preset-aware.
The verifier scores the output mostly from absolute output properties. It barely reasons about whether the result is materially better than input, whether a creative pass over-corrected, or whether the output matches the candidate plan it selected. It is better than a boolean check, but still shallow relative to the orchestration ambition.
File:
- [backend/src/orchestration/verification.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/verification.ts:1)

3. `MEDIUM`: OpenRouter node quality is bounded but still under-governed operationally.
The client enforces shape well, but there are no token budgets, no latency metrics per node, no cost budgeting, no model allowlist abstraction beyond env variables, and no node-level circuit breaker. This is acceptable for an advanced MVP, not for “technically excellent automation.”
Files:
- [backend/src/orchestration/openrouter-client.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/openrouter-client.ts:1)
- [backend/src/config.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/config.ts:31)

4. `MEDIUM`: batch consistency is claimed in docs more strongly than the product can deliver.
The code supports handoff memory, but the actual browser UX is still single-image. No catalog/session grouping exists, and there is no durable batch identity. This is not a lie, but it is an overstatement if presented as a real product capability.

5. `MEDIUM`: cleanup work is on the request path.
`cleanupExpiredRuntimeState()` runs on session bootstrap, output fetch, and enhancement POST. That means deletes happen inline on user requests. Fine at this scale, but it is a bad default for a system that claims production-readiness.
Files:
- [backend/src/routes/enhance.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/routes/enhance.ts:72)
- [backend/src/storage/runtime-maintenance.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/runtime-maintenance.ts:1)

## Architecture Review

### Product Readiness
- The app solves one clear problem: preset-based enhancement of product photos for e-commerce sellers.
- The user flow is coherent and much cleaner than most AI repos: upload -> preset -> process -> preview -> download.
- It is not fake-ready anymore, but it is still not “production-excellent.” The backend has real seams and runtime durability, but the orchestration layer can still approve weak results by returning them anyway.
- Monetization is still stubbed. Credits exist, but there is no purchase flow, account system, or catalog/job model.

### Frontend Review
- Frontend architecture is intentionally small, which is good. There is no pointless state library, no fake domain layers, and the backend adapter is isolated from the UI.
- The weak spot is capability mismatch:
  - frontend is strictly single-image and session-scoped
  - backend now speaks in terms of candidate plans, consistency memory, and orchestration metadata the UI never uses
- `BackendProcessor` is fine as a transport adapter, but tests are still transport-only, not user-flow quality tests. There is still no real browser E2E coverage.
- `ComparisonPanel` downloads directly from signed URLs with no expiry recovery or user feedback if the URL has gone stale.
Files:
- [src/App.tsx](/mnt/c/Users/marci/Pictures/bananek/src/App.tsx:1)
- [src/features/enhancer/processors/backendProcessor.ts](/mnt/c/Users/marci/Pictures/bananek/src/features/enhancer/processors/backendProcessor.ts:1)
- [src/components/ComparisonPanel.tsx](/mnt/c/Users/marci/Pictures/bananek/src/components/ComparisonPanel.tsx:1)

### Backend Review
- Backend architecture is materially stronger than before:
  - explicit route boundary
  - explicit processor seam
  - SQLite runtime core
  - signed session model
  - typed orchestration contracts
- The main weakness is that there are now two competing backend personalities:
  - a clean deterministic product service
  - a sophisticated orchestration engine with partially connected capabilities
- That tension shows up in places like planner candidate inflation, stage semantics, and product claims around consistency.

## Orchestration Review

### Candidate Graph Planning
Verified in code: yes.
Files:
- [backend/src/orchestration/planner.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/planner.ts:1)

Reality:
- Candidate generation exists.
- Candidate scoring exists.
- Replan candidate selection exists.
- But some of the candidate space is shallow or synthetic, especially on deterministic paths.

Verdict:
- Real implementation, not theater.
- Still too hand-wavy for “production-grade adaptive orchestration.”

### Rich Prompt Package
Verified in code: yes.
Files:
- [backend/src/orchestration/prompt-builder-node.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/prompt-builder-node.ts:1)
- [backend/src/orchestration/node-utils.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/node-utils.ts:1)

Reality:
- `masterPrompt`, `negativePrompt`, recovery prompt, consistency/composition/brand-safety rules all exist.
- The package is auditable and deterministic fallback exists.
- But the actual FAL execution still collapses this richer package into a narrower `text + directives + guidanceScale` prompt context. The package is richer than the execution surface.

Verdict:
- Good internal contract.
- Partially unrealized execution richness.

### Consistency Memory
Verified in code: yes.
Files:
- [backend/src/orchestration/consistency-memory.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/consistency-memory.ts:1)
- [backend/src/orchestration/types.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/types.ts:60)

Reality:
- Exists as a typed object.
- Is updated after execution.
- Can be passed into the orchestrator.
- Is not yet a real product capability because no public batch/catalog flow uses it.

Verdict:
- Architecturally real.
- Product-wise mostly latent.

### Verification / Retry / Replan
Verified in code: yes.
Files:
- [backend/src/orchestration/verification.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/verification.ts:1)
- [backend/src/orchestration/verification-node.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/verification-node.ts:1)
- [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:141)

Reality:
- Verification scoring exists.
- Suggested replan exists.
- Retry once exists.
- Fallback path is preserved.
- Final hard acceptance gate does not exist.

Verdict:
- Real maturity improvement.
- Still incomplete as a quality control system.

## OpenRouter Planning Layer Review
- Strong points:
  - strict schema outputs
  - no prose contracts
  - fixed seed and temperature `0`
  - timeout and retry handling
  - safe fallback to deterministic nodes
- Weak points:
  - no per-node latency/cost telemetry
  - no model governance beyond env
  - no explicit token/response-size guardrails
  - no evidence-based quality measurement of whether OpenRouter actually improves plan quality
- Node quality varies:
  - shot planner and consistency node are clean and bounded
  - prompt builder is ambitious but partly ceremonial because execution consumes a reduced projection

Files:
- [backend/src/orchestration/openrouter-client.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/openrouter-client.ts:1)
- [backend/src/orchestration/shot-planner-node.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/shot-planner-node.ts:1)
- [backend/src/orchestration/consistency-node.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/consistency-node.ts:1)
- [backend/src/orchestration/prompt-builder-node.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/prompt-builder-node.ts:1)

## FAL Execution Path Review
- FAL remains the only image-generation backend on the AI path. That part is clean.
- The provider boundary is one of the strongest parts of the repo.
- Major positives:
  - request timeout handling
  - provider error mapping
  - HTTPS-only asset fetch
  - allowlisted asset hosts
  - max image size enforcement on provider asset downloads
  - output normalization to preserve public MIME contract
- Main weakness:
  - `ensureAllowedProviderUrl()` calls `readConfig()` at execution time instead of using immutable config.
- Secondary weakness:
  - post-processing and prompt richness are both stronger than the actual preset-specific execution semantics, meaning some orchestration sophistication is not yet translated into materially distinct FAL behaviors.

File:
- [backend/src/processors/fal-processor.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/processors/fal-processor.ts:1)

## Runtime Durability / Storage / Concurrency Review
- This area is much improved and materially credible now.
- SQLite choice is appropriate here. It is high-ROI and fits the current single-node MVP reality.
- Credit reserve/refund is transactionally safer than before.
- Processing locks are no longer just in-memory theater.
- Remaining weaknesses:
  - output payloads are still SQLite BLOBs, which is fine now but not for serious production scale
  - maintenance deletes run in the request path
  - config-driven DB path can change dynamically because DB path resolution re-reads env

Files:
- [backend/src/storage/database.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/database.ts:1)
- [backend/src/storage/session-store.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/session-store.ts:1)
- [backend/src/storage/output-store.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/output-store.ts:1)
- [backend/src/security/session-locks.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/security/session-locks.ts:1)
- [backend/src/storage/runtime-maintenance.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/runtime-maintenance.ts:1)

## Security Review
- Better than before, but not excellent.

What is strong:
- provider keys stay server-side
- signed session cookie + `X-Session-Id`
- strict image validation using `sharp`
- signed output URLs
- FAL asset host allowlist
- customer-safe public error mapping

What is still weak:
- dev secret fallback still exists in [backend/src/config.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/config.ts:74)
- no real user auth/account boundary
- no CSRF mitigation beyond `SameSite=Strict`
- no explicit origin enforcement in POST route beyond CORS configuration
- no anti-automation / abuse intelligence beyond per-session and per-IP counters
- no external observability or alerting

Severity note:
- There is no obvious catastrophic key leak in the customer path.
- The bigger security problem now is operational weakness, not naive exposure.

## Testing Review
- Test quality is good by small-product standards, but still not excellent by automation-platform standards.

What is strong:
- backend route tests are meaningful
- FAL processor tests are genuinely useful
- OpenRouter client has direct failure-path tests
- orchestration tests now check planning, fallback, and retry/replan behavior

What is weak:
- no browser E2E tests
- no load tests
- no golden quality/regression suite for orchestration decisions
- no tests asserting that failed final verification blocks success responses, because the code does not do that
- `backend/tests/validation.test.ts` still protects dead wrapper code, not real route behavior

Files:
- [backend/tests/orchestration.test.ts](/mnt/c/Users/marci/Pictures/bananek/backend/tests/orchestration.test.ts:1)
- [backend/tests/enhance-route.test.ts](/mnt/c/Users/marci/Pictures/bananek/backend/tests/enhance-route.test.ts:1)
- [backend/tests/openrouter-client.test.ts](/mnt/c/Users/marci/Pictures/bananek/backend/tests/openrouter-client.test.ts:1)
- [backend/tests/validation.test.ts](/mnt/c/Users/marci/Pictures/bananek/backend/tests/validation.test.ts:1)
- [src/features/enhancer/processors/backendProcessor.test.ts](/mnt/c/Users/marci/Pictures/bananek/src/features/enhancer/processors/backendProcessor.test.ts:1)

## Docs Truthfulness
- Active architecture docs are partly truthful and partly lagging.
- The repo has both `docs/06-audits/*` and `docs/audits/*` redirect-style duplication, which is documentation friction, not clarity.
- `current-status.md` and `working-memory.md` are already behind the code in test counts and orchestration detail.
- The previous “latest code review” in `docs/06-audits/` is stale enough to be misleading if treated as current truth.

Files:
- [docs/03-progress/current-status.md](/mnt/c/Users/marci/Pictures/bananek/docs/03-progress/current-status.md:1)
- [docs/03-progress/working-memory.md](/mnt/c/Users/marci/Pictures/bananek/docs/03-progress/working-memory.md:1)
- [docs/06-audits/latest-code-review.md](/mnt/c/Users/marci/Pictures/bananek/docs/06-audits/latest-code-review.md:1)
- [README.md](/mnt/c/Users/marci/Pictures/bananek/README.md:1)

## Dead Weight To Delete
- [backend/src/validation.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/validation.ts:1)
- [backend/tests/validation.test.ts](/mnt/c/Users/marci/Pictures/bananek/backend/tests/validation.test.ts:1)
- [backend/src/processors/index.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/processors/index.ts:1) if the repo is standardizing on explicit processor injection through the orchestrator instead of env-dispatch helper functions
- stale “latest audit” duplication between `docs/06-audits/` and `docs/audits/`
- any current-status doc sections that report stale test counts as current fact

## Fastest Path To Technical Excellence
1. Make verification authoritative. If final verification still fails after one retry/replan, return a controlled failure or deterministic fallback instead of `200`.
2. Decide whether consistency memory is a real product feature. If yes, persist it against a catalog/session/batch concept. If no, stop overselling it in docs.
3. Collapse planner theater. Remove fake candidate diversity on deterministic paths or make those pipelines genuinely different.
4. Centralize immutable config at startup and pass it downward. Stop calling `readConfig()` on hot paths.
5. Delete dead compatibility files and stale audit/doc duplicates.
6. Add a browser E2E suite and a golden orchestration regression suite.
7. Add per-node orchestration telemetry: latency, fallback rate, verification failure rate, retry/replan rate.

## If I Were CTO Tomorrow
- Freeze:
  - more orchestration feature expansion
  - more docs churn
  - any new “smart” nodes
- Keep:
  - stable `/api/enhance`
  - preset UX
  - SQLite runtime core
  - FAL-only execution seam
  - strict JSON OpenRouter nodes
- Rewrite or tighten:
  - final verification gate
  - config lifecycle
  - planner semantics on deterministic paths
  - docs that claim more maturity than the product path actually delivers
- Ship:
  - the current sharp path confidently
  - the FAL + OpenRouter path only behind tighter quality gating and observability

## Final Score
| Dimension | Score | Why |
|---|---:|---|
| Product clarity | 8.8 | The user problem and UX are disciplined. |
| Code quality | 7.4 | Good separation and tests, but still some fake sophistication and dead compatibility code. |
| Frontend quality | 6.9 | Clean and simple, but intentionally thin and not aligned with newer batch/consistency ambitions. |
| Backend quality | 7.8 | Strong runtime/core improvements, but config lifecycle and final acceptance semantics are still weak. |
| Orchestration quality | 7.1 | Real candidate graph and recovery logic, but verification authority and plan realism are not fully there. |
| Security | 6.6 | Provider-safe and materially better than before, but still missing stronger auth/anti-abuse posture. |
| Maintainability | 6.8 | Better than average code, worse than average docs hygiene. |
| Ship readiness | 6.7 | Strong advanced MVP, not yet technically excellent production automation. |
| Technical excellence | 6.9 | Serious progress, but still too many partially connected advanced concepts. |
| Investor/demo readiness | 8.3 | The repo demos well and sounds credible, but that is not the same as production hardness. |

**Estimated overall score: 7.4/10**

## Appendix: File / Module-Specific Findings

### Frontend
- [src/App.tsx](/mnt/c/Users/marci/Pictures/bananek/src/App.tsx:1)
  - clean, disciplined UI shell
  - no batch/catalog abstraction
  - no recovery flow when signed download URLs expire
- [src/features/enhancer/processors/backendProcessor.ts](/mnt/c/Users/marci/Pictures/bananek/src/features/enhancer/processors/backendProcessor.ts:1)
  - strong transport boundary
  - still only contract-tested, not browser-E2E tested
- [src/features/enhancer/processors/backendSession.ts](/mnt/c/Users/marci/Pictures/bananek/src/features/enhancer/processors/backendSession.ts:1)
  - module-level cache is fine for this app
  - `creditsUsed` is incremented client-side from response headers, which is okay only because server remains authority
- [src/components/ComparisonPanel.tsx](/mnt/c/Users/marci/Pictures/bananek/src/components/ComparisonPanel.tsx:1)
  - silent failure path if signed result URL expires

### Backend Core
- [backend/src/routes/enhance.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/routes/enhance.ts:1)
  - route boundary is solid
  - request-path cleanup and repeated config loading should be pulled out
- [backend/src/config.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/config.ts:1)
  - typed enough
  - still split between immutable startup config and repeated dynamic config reads
- [backend/src/storage/database.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/storage/database.ts:1)
  - good high-ROI choice
  - DB path should not be dynamically mutable mid-process

### Orchestration
- [backend/src/orchestration/planner.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/planner.ts:1)
  - real candidate graph
  - mixed real and ceremonial candidates
- [backend/src/orchestration/enhancement-orchestrator.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/enhancement-orchestrator.ts:1)
  - real retry/replan/fallback control flow
  - final acceptance gate still missing
  - later planned steps misclassified as retries
- [backend/src/orchestration/prompt-builder-node.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/prompt-builder-node.ts:1)
  - rich internal contract
  - richer than actual execution surface
- [backend/src/orchestration/verification.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/orchestration/verification.ts:1)
  - improved
  - still too heuristic for the ambition level

### Dead / Cleanup Debt
- [backend/src/validation.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/validation.ts:1)
- [backend/tests/validation.test.ts](/mnt/c/Users/marci/Pictures/bananek/backend/tests/validation.test.ts:1)
- [backend/src/processors/index.ts](/mnt/c/Users/marci/Pictures/bananek/backend/src/processors/index.ts:1)
- [docs/06-audits/latest-code-review.md](/mnt/c/Users/marci/Pictures/bananek/docs/06-audits/latest-code-review.md:1) as a “latest” artifact, because it is no longer latest
