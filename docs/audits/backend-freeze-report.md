# Backend Freeze Report

> Verified: 2026-04-24

## Executive Verdict

FREEZE NOW.

The backend is ready to stop for this phase. The main product path is coherent:
upload -> preset -> durable job/result -> signed download. The remaining backend
work is launch infrastructure or product monetization, not a responsible blocker
for moving into frontend-focused development.

## Fixed Before Freeze

1. Trusted proxy / client IP spoofing boundary
   - Files: `backend/src/security/request-trust.ts`, `backend/src/index.ts`, `backend/src/routes/enhance.ts`, `backend/tests/request-trust.test.ts`
   - Why it mattered: rate limits and abuse controls are meaningless if any client can spoof `X-Forwarded-For`.
   - Result: forwarded IP headers are trusted only when the peer matches configured trusted proxy rules. Untrusted forwarded headers are ignored.

2. Host and Origin boundary for state-changing routes
   - Files: `backend/src/routes/enhance.ts`, `backend/tests/enhance-route.test.ts`
   - Why it mattered: the app uses session-backed browser routes, so accepting arbitrary browser origins would create avoidable cross-site abuse risk.
   - Result: `POST /api/enhance` rejects disallowed Host/Origin values and records stable abuse counters.

3. Session secret hardening
   - Files: `backend/src/config.ts`, `backend/.env.example`, `backend/tests/config.test.ts`, `playwright.config.ts`
   - Why it mattered: weak or placeholder signing secrets make session boundaries fake.
   - Result: production-like runtime requires an explicit high-entropy secret. Local generated secrets require explicit opt-in. Placeholder, short, and low-entropy values fail startup. E2E now uses a valid test secret instead of weakening the rule.

4. Graceful worker shutdown and restart safety
   - Files: `backend/src/index.ts`, `backend/src/jobs/job-worker.ts`, `backend/tests/job-worker.test.ts`
   - Why it mattered: in-flight async jobs must not be silently abandoned during local deploys/restarts.
   - Result: shutdown stops new claims, drains the active job within `SHUTDOWN_DRAIN_TIMEOUT_MS`, and requeues running jobs on timeout/startup.

5. Rate limiter cleanup moved off the request path
   - Files: `backend/src/security/rate-limiter.ts`, `backend/tests/rate-limiter.test.ts`
   - Why it mattered: hot-path cleanup creates unpredictable request latency and misleading runtime behavior.
   - Result: expired bucket cleanup is maintenance-driven. The unused opportunistic cleanup path was removed.

6. Operational telemetry for freeze-level debugging
   - Files: `backend/src/utils/ops-metrics.ts`, `backend/src/routes/enhance.ts`, `backend/src/jobs/job-worker.ts`, `backend/src/orchestration/enhancement-orchestrator.ts`, `backend/tests/ops-metrics.test.ts`
   - Why it mattered: async orchestration failures need visible request/job correlation and outcome counters.
   - Result: stable counters/log events now cover abuse rejections, job lifecycle, worker shutdown, processor failures/fallbacks, retries/replans, and verification outcomes.

7. Test isolation and verification stability
   - Files: `backend/vitest.config.ts`, `vite.config.ts`
   - Why it mattered: shared SQLite/runtime files made parallel test execution capable of producing false failures.
   - Result: Vitest file-level parallelism is disabled for deterministic runtime tests.

8. Documentation truthfulness
   - Files: `README.md`, `AI_CONTEXT.md`, `docs/README.md`, `docs/02-architecture/current-system.md`, `docs/02-architecture/known-gaps.md`, `docs/03-progress/current-status.md`, `docs/03-progress/working-memory.md`, `docs/03-progress/priorities.md`
   - Why it mattered: stale docs were still describing already-fixed backend risks as future work or reporting obsolete test blockers.
   - Result: active docs now describe the current backend state and separate deferred launch work from freeze blockers.

## Deferred On Purpose

- Auth/accounts: deferred because the current phase explicitly excludes account ownership and identity. Required before paid launch.
- Payments/Stripe: deferred because monetization is out of scope for this backend freeze. Required before charging users.
- Supabase migration: deferred because SQLite is durable enough for the current single-node phase and the task explicitly excludes Supabase.
- Cloud object storage: deferred because filesystem-backed object storage is coherent for single-node development. Swap to S3/R2 before multi-instance production.
- Distributed queue/workers: deferred because the current async worker is single-node but durable enough for this phase.
- External metrics/tracing/alerts: deferred because structured logs, SQLite telemetry rows, and `/api/ops/counters` are sufficient for local/MVP debugging, not full production operations.
- Token-based CSRF: deferred until real authenticated account sessions exist. Current route boundary uses SameSite cookies, `X-Session-Id`, Host checks, and Origin checks.
- Admin protection for `/api/ops/counters`: deferred because it exposes aggregate counters only and is host-restricted. It should move behind auth before public production.

## Remaining Risks Accepted

- Single-node SQLite + local object storage means no horizontal scaling yet.
- If a process is force-killed during a provider call, the startup requeue path handles the job row, but external provider side effects may still have happened.
- Missing `Origin` headers are allowed for non-browser clients; browser-origin abuse is blocked by configured origins and custom session headers.
- `/api/ops/counters` is not an authenticated admin endpoint yet.
- E2E uses `PROCESSOR=fal` with `fallback-to-sharp` and no real `FAL_API_KEY`; this validates failure/fallback coherence, not live provider quality.

## Backend Freeze Checklist

- [x] Main flow stable: upload -> preset -> job -> result -> download
- [x] No known high-severity backend/security/runtime blocker remains
- [x] Async AI path is operationally coherent
- [x] Critical state is durable in SQLite and filesystem object storage
- [x] Spoofable forwarded-IP abuse path is closed for configured trusted proxies
- [x] Weak session-secret/config trap is closed
- [x] Host/Origin boundary exists for state-changing routes
- [x] Shutdown/restart behavior is safe enough for this phase
- [x] Rate-limit cleanup is not on the request hot path
- [x] Docs do not materially lie about backend state
- [x] Tests/typecheck/build/verify pass

## Verification

- `TMPDIR=/tmp npm --prefix backend run typecheck`: pass
- `TMPDIR=/tmp npm --prefix backend test`: 105/105 pass
- `TMPDIR=/tmp npm --prefix backend run verify`: pass
- `TMPDIR=/tmp npm run verify`: pass
  - root typecheck: pass
  - root tests: 115/115 pass
  - frontend build: pass
  - backend verify: pass
  - Playwright E2E: 2/2 pass
  - dependency audit: 0 production vulnerabilities

## Final Recommendation

Stop backend work for this phase. Move to frontend-focused development. Reopen
backend only for real defects found by frontend integration work or for the
explicitly deferred launch items: auth/accounts, payments, cloud object storage,
external observability, deployment manifests, and multi-node runtime design.
