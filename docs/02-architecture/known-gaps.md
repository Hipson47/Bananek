# Known Gaps — Code-Verified

> Every gap listed here has been verified against the actual codebase as of 2026-04-22.

## Security Gaps

| Gap | Location | Risk | Mitigation |
|---|---|---|---|
| Dev session secret fallback | `backend/src/config.ts` line ~75 | Session forgery in production if env var is unset | Require `APP_SESSION_SECRET` always; fail startup without it |
| No HTTPS enforcement | `backend/src/routes/enhance.ts` cookie flags | Session cookie sent in cleartext on non-TLS connections | Deploy behind TLS-terminating reverse proxy |
| No CSRF protection | `POST /api/enhance` | Cross-site request forgery possible via multipart form | Add CSRF token or validate Origin header |

## Architecture Gaps

| Gap | Impact | Notes |
|---|---|---|
| SQLite BLOB storage for outputs | DB grows unboundedly; no CDN; single-node only | Replace with S3/R2 before multi-instance |
| Synchronous AI processing | 5–30s request hold for FAL.ai presets | Add async queue for AI-heavy traffic |
| No horizontal scaling path | Single-process SQLite locks, single-node BLOBs | Need external DB + storage before second instance |
| No graceful shutdown | In-flight requests dropped on SIGTERM | Add drain logic to `index.ts` serve function |

## Code Quality Gaps

| Gap | Location | Action |
|---|---|---|
| Dead code: `validation.ts` | `backend/src/validation.ts` + `backend/tests/validation.test.ts` | Delete both files; real validation is `image-validation.ts` |
| DEC-010 references dead architecture | `docs/04-decisions/decision-log.md` | DEC-010 talks about 50MB body limit for data URLs; actual limit is 20MB for multipart. Consider superseding. |
| Audit findings doc partially stale | `docs/06-audits/latest-code-review.md` | Full audit text still describes pre-SQLite state; summary has been updated |

## Testing Gaps

| Gap | Impact | Notes |
|---|---|---|
| No orchestration unit tests | Orchestrator, planner, and verifier are tested only through route integration tests | Add unit tests for analysis, plan selection, verification thresholds |
| No load/stress testing | Unknown behavior under concurrent load | Add k6 or artillery test suite before production |
| No E2E browser tests | Frontend tested only at unit level (fetch mocking) | Add Playwright tests for full upload→result flow |
