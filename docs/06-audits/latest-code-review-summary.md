# Code Review Summary — 2026-04-21

Overall score: **6.5/10** (at time of audit; issues #1–3, #6–8, #10 have since been addressed)

## Top 10 Issues

| # | Issue | Severity | Status | Notes |
|---|---|---|---|---|
| 1 | Session/credit persistence uses non-atomic local file writes | CRITICAL | **Fixed** | Now SQLite-backed (`backend/src/storage/database.ts`) |
| 2 | In-memory rate limiter resets on restart | CRITICAL | **Fixed** | Now SQLite-backed (`backend/src/security/rate-limiter.ts`) |
| 3 | Credit deduction happens after processing (crash = free result) | HIGH | **Fixed** | Transactional reserve-before-process with refund on failure |
| 4 | Session secret defaults to hardcoded string in non-production | HIGH | Open | Dev-only fallback still exists in `config.ts` |
| 5 | No HTTPS enforcement or deployment configuration | HIGH | Open | No Dockerfile or reverse proxy config yet |
| 6 | Session cache is an unbounded in-memory Map; no eviction | MEDIUM | **Fixed** | Sessions are now in SQLite with expiry cleanup |
| 7 | Output files accumulate on disk with no retention/cleanup | MEDIUM | **Fixed** | `cleanupExpiredOutputs` in `runtime-maintenance.ts` |
| 8 | `IN_FLIGHT_SESSIONS` guard is single-process only | MEDIUM | **Fixed** | SQLite-backed processing locks (`session-locks.ts`) |
| 9 | `backend/src/validation.ts` is dead code | HIGH | Open | Still exists; only consumed by its own test |
| 10 | Decision log DEC-004–DEC-008 describe dead architecture | LOW | **Fixed** | Marked superseded; DEC-012/DEC-013 added |
