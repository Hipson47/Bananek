# Code Review Audit — 2026-04-21

Auditor: Architecture Agent (automated full-repo inspection)
Scope: every file outside `node_modules/`, `.git/`, `dist/`

---

## 1. Executive Verdict

This is a real, working local MVP with a clean product concept. The frontend is minimal and correct. The backend is thoughtfully layered — sessions, rate limits, signed output URLs, structured logs, three swappable processors behind a stable contract. For a solo/small-team project at this stage, the code quality is above average.

That said: it is not production-ready and has several structural issues that would bite hard if you tried to ship it as-is. The session/credit system is built on local JSON files and in-memory maps — one restart or one concurrent request and state is lost or corrupted. The docs-to-code ratio is extreme (3,700 lines of docs for 2,700 lines of source), and a significant portion of the docs reference a codebase that no longer exists. The decision log contains 11 decisions, of which at least 5 (DEC-004 through DEC-008) describe a dead architecture.

Ship readiness: demo-able locally, not deployable to real users.

---

## 2. What Is Actually Good

The product concept is sharp: upload → preset → process → compare → download. No prompts, no model pickers, no configuration anxiety. This is the right UX for the target customer.

The `ImageProcessor` interface on the frontend and the matching processor selection on the backend (`sharp` / `fal` / `mock` via env var) is a clean abstraction. Swapping processors requires zero code changes. The FAL processor has proper error mapping (401/422/429/5xx/timeout/network), a CDN host allowlist, and sharp post-processing for format normalisation. The sharp processor has real per-preset pipelines — not placeholders.

Session bootstrap via signed cookie + `X-Session-Id` header is a reasonable scheme for an anonymous credit-gated product. The `IN_FLIGHT_SESSIONS` guard prevents double-submit at the session level. Abort controller wiring on the frontend prevents stale response handling.

The test suite (59 tests) covers the important paths: route-level happy/sad paths, processor-specific behaviour, validation edge cases, frontend adapter contract. The FAL processor tests (17 tests) are particularly thorough — they mock the full fetch→CDN→postprocess pipeline and test every error branch.

The CI pipeline exists and runs the full verify chain.

---

## 3. Critical Problems

### 3.1 Session/credit persistence is not crash-safe — CRITICAL

`session-store.ts` and `output-store.ts` use `writeFile` to local JSON files. There is no locking, no atomic write (write-then-rename), and no WAL. If the process crashes mid-write, session files become corrupt. If two requests for different sessions write to `usage-events.ndjson` concurrently, `appendFile` can interleave lines (Node.js does not guarantee atomic append for large writes).

Worse: `consumeSessionCredit` is called AFTER `processImage` and `storeOutput` succeed (line 278 of `enhance.ts`). If the process crashes between storing the output and deducting the credit, the user gets a free enhancement. With FAL (which costs real money), this is a financial leak.

Files: `backend/src/storage/session-store.ts`, `backend/src/storage/output-store.ts`, `backend/src/routes/enhance.ts:259-282`

### 3.2 In-memory rate limiter resets on restart — CRITICAL

`rate-limiter.ts` stores all rate limit state in a `Map`. Every server restart clears all limits. An attacker can exhaust credits, restart the server (or wait for a deploy), and start over. In production, this is equivalent to having no rate limiting.

File: `backend/src/security/rate-limiter.ts`

### 3.3 Session secret defaults to a hardcoded string in dev — HIGH

`config.ts:76-77`: if `APP_SESSION_SECRET` is not set (and `NODE_ENV` is not `production`), the secret falls back to `"dev-only-session-secret-change-me"`. Any attacker who reads the source can forge session cookies. The production guard only checks for the env var's presence, not its entropy.

File: `backend/src/config.ts:75-80`

### 3.4 `validation.ts` is a dead-code wrapper — HIGH

`backend/src/validation.ts` exports `validateEnhanceRequest` and re-exports `isAppError`. The only consumer is `backend/tests/validation.test.ts`. The route (`enhance.ts`) imports directly from `image-validation.ts`. This file exists purely to keep the old test file working. It adds indirection for no production purpose.

Files: `backend/src/validation.ts`, `backend/tests/validation.test.ts`

### 3.5 No HTTPS enforcement — HIGH

The session cookie sets `Secure` only when `NODE_ENV === "production"` (line 115 of `enhance.ts`). There is no documentation or mechanism for running the backend behind TLS. If deployed without a reverse proxy, session cookies transmit in cleartext.

File: `backend/src/routes/enhance.ts:115`

---

## 4. Hidden Problems Most Teams Miss

### 4.1 Credit deduction is not atomic with processing — MEDIUM

The enhance route does: validate → check credits → process → store output → deduct credit. If processing succeeds but credit deduction fails (disk full, permission error), the user gets a free result. The credit check and deduction should be a single atomic operation, or at minimum the credit should be reserved before processing begins.

File: `backend/src/routes/enhance.ts:207-282`

### 4.2 `IN_FLIGHT_SESSIONS` does not survive horizontal scaling — MEDIUM

The double-submit guard is an in-memory `Set`. It only works on a single process. With multiple backend instances (or even Node.js cluster mode), two concurrent requests for the same session will both pass the guard.

File: `backend/src/routes/enhance.ts:30, 214-221`

### 4.3 Session cache never evicts — MEDIUM

`SESSION_CACHE` in `session-store.ts` is an unbounded `Map`. Every session created is cached forever for the lifetime of the process. With 10,000 sessions, this is ~2MB of memory; with 1M sessions (after a viral moment), it's 200MB and growing. No TTL, no LRU, no max size.

File: `backend/src/storage/session-store.ts:23`

### 4.4 Output files accumulate with no cleanup — MEDIUM

`storeOutput` writes to `backend/data/outputs/` with no retention policy. Each enhancement creates two files (image + metadata JSON). With FAL processing, output images can be 1-5MB each. 1,000 enhancements = 5GB of local disk with no cleanup. The signed URL has a TTL (`outputUrlTtlSeconds`, default 3600), but the files themselves are never deleted.

File: `backend/src/storage/output-store.ts`

### 4.5 `processImage` returns full data URL through the route even though output is stored — LOW

The processor returns `processedUrl` as a `data:` URL (base64-encoded full image). The route then decodes it back to bytes (`decodeProcessedDataUrl`), stores the bytes, and replaces `processedUrl` with a `/api/outputs/` URL. The base64 round-trip wastes ~33% memory and CPU. The processor should return a `Buffer` directly.

File: `backend/src/routes/enhance.ts:265-300`, all processors

### 4.6 Decision log contains 5 decisions about dead architecture — LOW

DEC-004 through DEC-008 describe decisions about `RoutingAdapter`, `GeminiAdapter`, `FalAdapter`, `GenerateResponse`, `GenerateRequest`, and `blob:` URL serialisation. None of these concepts exist in the current codebase. The decisions are technically not wrong (they're "accepted"), but they describe a system that was never built in this repo. They should be marked as superseded.

File: `docs/decisions/decision-log.md:55-127`

### 4.7 Vitest environment is `node` for frontend tests — LOW

`vite.config.ts:11` sets `test.environment: "node"`. The frontend tests (`backendProcessor.test.ts`, `validateImageFile.test.ts`) use `File`, `FormData`, and `Response` which are available in Node 20+ but not identical to browser implementations. This works, but it means tests won't catch browser-specific API differences (e.g., `FormData.get` returning `string | File | null` vs browser's `FormDataEntryValue`).

File: `vite.config.ts:11`

---

## 5. Dead Weight To Delete

| Item | Type | Reason |
|---|---|---|
| `backend/src/validation.ts` | Source file | Dead wrapper; only used by its own test. Route uses `image-validation.ts` directly. |
| `backend/tests/validation.test.ts` | Test file | Tests the dead wrapper. Move assertions to `enhance-route.test.ts` or delete. |
| `vite.config.ts.timestamp-*.mjs` (×2) | Build artifact | Vite dev-server leftovers. Already in `.gitignore` but present on disk. |
| `.codex` | Empty file | Zero bytes. Serves no purpose. |
| `docs/decisions/decision-log.md` DEC-004–DEC-008 | Doc section | Describe a dead architecture (RoutingAdapter/GeminiAdapter/FalAdapter). Should be marked superseded. |
| `docs/architecture-overview.md` | Doc file | Check if it still references playground-era architecture. If so, archive it. |
| `docs/execution-roadmap.md` | Doc file | Check if it still describes the old phased roadmap. If so, archive it. |
| `docs/agent-work-map.md` | Doc file | Agent role boundaries for a multi-agent workflow that may no longer be active. |
| `docs/task-decomposition.md` | Doc file | Workstream breakdown likely stale. |
| `docs/progress-tracking.md` | Doc file | Tracking format doc — value unclear if not actively used. |
| `docs/source-of-truth-rules.md` | Doc file | Meta-rules about documentation; useful but adds to the docs-to-code weight. |

Estimated dead weight: ~200 lines of code, ~1,500+ lines of docs.

---

## 6. Fastest Path To MVP

The product is already an MVP in shape. What's missing is durability and payment.

1. Replace local file persistence with SQLite (single file, crash-safe, concurrent-read-safe, zero-config). One `sessions` table, one `outputs` table, one `usage_events` table. This fixes the crash-safety, atomicity, and unbounded-cache problems in one move. Do NOT jump to Postgres/Redis yet.

2. Make credit deduction atomic: wrap "check credits + deduct + store output" in a SQLite transaction. If processing fails, roll back.

3. Add a Stripe Checkout session for credit packs. The session already has `creditsRemaining`; you just need a webhook to add purchased credits.

4. Add a scheduled cleanup for expired outputs (cron or a simple `setInterval` that deletes files older than `outputUrlTtlSeconds`).

5. Deploy behind a reverse proxy (Caddy or nginx) with automatic TLS. The app is already structured for this — just needs a `Caddyfile` or `nginx.conf`.

That's it. Five changes. Everything else (queues, S3, multi-region) is premature.

---

## 7. Fastest Path To Production

Everything in section 6, plus:

1. Move output storage to S3/R2. Local disk doesn't survive container restarts in most deployment platforms.

2. Replace in-memory rate limiter with Redis or SQLite-backed counters.

3. Add `APP_SESSION_SECRET` to deployment secrets with sufficient entropy (32+ random bytes). Add startup validation for entropy.

4. Add health check that verifies database connectivity (not just `{ status: "ok" }`).

5. Add a `Dockerfile` with multi-stage build (build frontend, build backend, serve both from one container or two).

6. Set `NODE_ENV=production` in deployment. This enables `Secure` cookie flag and enforces `APP_SESSION_SECRET`.

7. Pin FAL model IDs to specific versions when they stabilise.

---

## 8. If I Were CTO Tomorrow

First day: delete 60% of the docs. The docs-to-code ratio is 1.4:1. Most of the docs describe planning processes, agent coordination rules, and a previous architecture. Keep: README, AGENTS.md, decision-log (with dead decisions marked superseded), current-status, working-memory. Archive or delete everything else.

First week: SQLite migration. Replace all three storage files (session-store, output-store, usage-events) with a single SQLite database. This is the highest-leverage change — it fixes crash-safety, atomicity, unbounded caches, and concurrent access in one move.

First month: Stripe integration, deploy to Fly.io or Railway with R2 for outputs, set up basic monitoring (structured logs are already JSON — just pipe to a log aggregator).

What I would NOT do: add auth (anonymous sessions with credits are fine for launch), add a queue (FAL latency is 5-30s which is acceptable for synchronous requests), add a database ORM (raw SQLite queries are fine at this scale), rewrite anything.

---

## 9. Final Score

| Dimension | Score | Notes |
|---|---|---|
| Product clarity | 9/10 | Sharp concept, clean UX, no feature bloat. |
| Code quality | 7/10 | Clean TypeScript, good separation, but the persistence layer is a liability. |
| Frontend quality | 8/10 | Minimal, correct, proper abort handling, session-aware. Could use error boundary. |
| Backend quality | 6/10 | Good structure and processor abstraction, but persistence/atomicity issues are serious. |
| Security | 5/10 | Session signing is correct, but hardcoded dev secret, no HTTPS enforcement, rate limiter resets on restart. |
| Maintainability | 6/10 | Code is maintainable; docs are not. Too many docs, too many stale references. |
| Ship readiness | 4/10 | Works locally, not deployable. No Dockerfile, no database, no payment, no TLS. |
| Investor/demo readiness | 7/10 | Demos well locally with the sharp processor. Shows a clear product concept. |

**Overall: 6.5/10** — a solid local prototype with a clear product direction, held back by a persistence layer that was designed for development and docs that grew faster than code.

---

## 10. Appendix: File/Module-Specific Findings

### Frontend

| File | Lines | Finding |
|---|---|---|
| `src/App.tsx` | 258 | Clean. Session bootstrap on mount, abort controller, proper cleanup. No error boundary — an unhandled throw in any child crashes the whole app. |
| `src/features/enhancer/processors/backendProcessor.ts` | 70 | Good. Type guard on response, AbortError re-throw, FormData upload. |
| `src/features/enhancer/processors/backendSession.ts` | 79 | Module-level `cachedSession` variable. Works but is not testable in isolation without `clearBackendSessionCache`. The `creditsUsed` field is incremented client-side in `syncSessionFromEnhanceResponse` — this is a trust-the-client pattern; fine since the server is the authority. |
| `src/features/enhancer/types.ts` | 21 | `ImageProcessor` interface doesn't include `signal?: AbortSignal` in `ProcessImageInput`. The `BackendProcessor` extends the type inline with `& { signal?: AbortSignal }`. This should be in the interface. |
| `src/features/enhancer/lib/validateImageFile.ts` | 19 | Clean, correct. 10MB limit matches backend. |
| `src/components/ComparisonPanel.tsx` | 56 | Download link uses `<a href={result.processedUrl} download={result.filename}>`. Since `processedUrl` is now `/api/outputs/:id?expires=...&sig=...`, the `download` attribute works but the browser must re-fetch the URL. If the signed URL has expired, the download silently fails. No error handling for this case. |
| `src/components/UploadPanel.tsx` | 91 | Accessible (role="button", tabIndex, keyboard handler). Minor: `aria-disabled={processing}` is set but the click handler doesn't check `processing` — the inner `<input>` has `disabled={processing}` which handles it. |
| `src/styles.css` | 427 | Not audited in depth. No CSS modules or scoping — all global classes. Fine at this scale. |

### Backend

| File | Lines | Finding |
|---|---|---|
| `backend/src/index.ts` | 105 | `createApp()` is pure (no side effects), `serve()` only runs when file is the entry point. Good for testing. Request ID middleware is well-structured. |
| `backend/src/config.ts` | 107 | `readConfig()` is called on every request in some paths (e.g., inside `fal-processor.ts` via `readConfig()` for `falAllowedHostSuffixes`). Config should be read once at startup. The `config` export at line 103 does this, but not all consumers use it. |
| `backend/src/image-validation.ts` | 173 | Thorough. Checks: format, dimensions, pixel count, animated frames, MIME match, size. Uses sharp metadata inspection. Good. |
| `backend/src/routes/enhance.ts` | 318 | The heaviest file. Handles session bootstrap, output serving, and enhancement in one router. Could be split into three route files, but not urgent. The `toPublicErrorResponse` function correctly hides internal error details from the client. |
| `backend/src/processors/fal-processor.ts` | 321 | Best-written module in the repo. Proper timeout handling, CDN host allowlist, HTTP error mapping, post-processing normalisation. One concern: `readConfig()` is called inside `ensureAllowedProviderUrl` on every request — should use cached config. |
| `backend/src/processors/sharp-processor.ts` | 133 | Clean per-preset pipelines. `sharpen(0.5, 1, 2)` on line 79 uses the deprecated 3-argument form — should use `sharpen({ sigma: 0.5, m1: 1, m2: 2 })`. |
| `backend/src/processors/mock-processor.ts` | 51 | Fine. Does what it says. |
| `backend/src/processors/index.ts` | 65 | Reads `process.env.PROCESSOR` on every call. Fine for dev flexibility but adds overhead. In production, processor should be selected once at startup. |
| `backend/src/storage/session-store.ts` | 133 | See section 3.1 and 4.3. Needs replacement. |
| `backend/src/storage/output-store.ts` | 117 | See section 3.1 and 4.4. Needs replacement. |
| `backend/src/security/rate-limiter.ts` | 52 | See section 3.2. `pruneExpired` iterates the entire map on every call — O(n) per request. Fine at low scale, problematic at high scale. |
| `backend/src/utils/signing.ts` | 37 | Correct use of HMAC-SHA256 with timing-safe comparison. Good. |
| `backend/src/utils/log.ts` | 53 | Simple structured JSON logging. Adequate. |
| `backend/src/validation.ts` | 23 | Dead wrapper. See section 3.4. |
| `backend/src/presets.ts` | 32 | Clean. Duplicated from frontend (`src/features/enhancer/presets.ts`) — same 3 presets. No shared package. A drift risk, but acceptable at this scale. |

### Tests

| File | Tests | Finding |
|---|---|---|
| `backend/tests/enhance-route.test.ts` | ~15 | Comprehensive: session bootstrap, auth rejection, persisted output, corrupt file, MIME mismatch, credit enforcement, rate limiting, processor failure policy. Uses `PROCESSOR=mock` which is correct — tests the HTTP layer, not image processing. |
| `backend/tests/fal-processor.test.ts` | 17 | Excellent coverage. Tests every preset, every error code, timeout, network failure, malformed response, and host allowlist. |
| `backend/tests/sharp-processor.test.ts` | 14 | Good: contract shape, output-differs-from-input, valid decodable output, resize constraints, error handling for corrupt input. |
| `backend/tests/validation.test.ts` | 9 | Tests the dead `validation.ts` wrapper. Should be migrated or deleted. |
| `src/features/enhancer/processors/backendProcessor.test.ts` | 4 | Covers: success, 4xx error, malformed response, network failure. Missing: abort signal test. |
| `src/features/enhancer/lib/validateImageFile.test.ts` | 3 | Covers: valid file, unsupported format, oversized file. Missing: edge cases (0-byte file, missing type). |

### Docs

17 active docs + 4 archived. The `docs/README.md` is a 90-line meta-document about how to use the documentation system. The documentation system has more process than the application has features. Several active docs (`agent-work-map.md`, `task-decomposition.md`, `progress-tracking.md`, `source-of-truth-rules.md`) describe coordination processes that appear to be aspirational rather than actively used.

The `decision-log.md` contains 13 decisions (DEC-001 through DEC-013). DEC-004 through DEC-008 describe decisions about `RoutingAdapter`, `GeminiAdapter`, `FalAdapter`, and `GenerateRequest`/`GenerateResponse` — types and modules that do not exist in the current codebase. These should be marked as superseded by DEC-012 and DEC-013.
