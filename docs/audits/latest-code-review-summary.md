# Code Review Summary — 2026-04-21

Overall score: **6.5/10**

## Top 10 Issues

| # | Issue | Severity | File(s) | Recommended Action |
|---|---|---|---|---|
| 1 | Session/credit persistence uses non-atomic local file writes; crash = data loss | CRITICAL | `backend/src/storage/session-store.ts`, `output-store.ts` | Replace with SQLite; wrap credit deduction in a transaction |
| 2 | In-memory rate limiter resets on every server restart | CRITICAL | `backend/src/security/rate-limiter.ts` | Move to SQLite-backed or Redis-backed counters |
| 3 | Credit deduction happens after processing + storage; crash between = free result | HIGH | `backend/src/routes/enhance.ts:259-282` | Reserve credit before processing; release on failure |
| 4 | Session secret defaults to hardcoded string in non-production | HIGH | `backend/src/config.ts:75-80` | Require secret always; validate entropy at startup |
| 5 | No HTTPS enforcement or deployment configuration | HIGH | `backend/src/routes/enhance.ts:115` | Add Dockerfile + reverse proxy config with TLS |
| 6 | Session cache is an unbounded in-memory Map; no eviction | MEDIUM | `backend/src/storage/session-store.ts:23` | Add LRU eviction or move to SQLite |
| 7 | Output files accumulate on disk with no retention/cleanup | MEDIUM | `backend/src/storage/output-store.ts` | Add cleanup job for files older than TTL |
| 8 | `IN_FLIGHT_SESSIONS` guard is single-process only | MEDIUM | `backend/src/routes/enhance.ts:30` | Acceptable for now; document limitation |
| 9 | `backend/src/validation.ts` is dead code; only tested by its own test | HIGH | `backend/src/validation.ts`, `tests/validation.test.ts` | Delete both files |
| 10 | Decision log DEC-004–DEC-008 describe architecture that does not exist | LOW | `docs/decisions/decision-log.md` | Mark as superseded |
