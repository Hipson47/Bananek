# Current Status

## Current Objective

The repo is past advanced-MVP and now has a production-shaped local runtime:

- durable async FAL jobs
- filesystem-backed object storage abstraction
- persisted consistency profiles
- structured orchestration telemetry
- authoritative final verification
- browser E2E for the main customer flow
- hardened security / ops surface (trusted-proxy client IP extraction, session-secret
  strength enforcement, Origin/Host validation on state-changing routes,
  graceful worker shutdown with drain + requeue, rate-limit cleanup off hot path,
  stable ops counters for abuse / job lifecycle / verification outcomes)

## Active Milestone

Backend freeze for this phase is complete. The next milestone is
frontend-focused product development, not more backend architecture work.

## Current State

- stable customer UX: upload -> preset -> process -> result -> download
- stable public entrypoint: `POST /api/enhance`
- OpenRouter remains planning-only
- FAL remains the only image-generation backend
- sharp remains the deterministic execution/fallback path
- runtime state no longer depends on JSON files or in-memory-only counters
- binary outputs no longer live primarily inside SQLite BLOBs
- async AI work no longer blocks the request cycle end-to-end
- consistency memory is persisted per `session + preset` scope and reused internally by related jobs
- request/job telemetry is persisted and logged
- forwarded headers (`X-Forwarded-For` / `X-Real-IP`) are only trusted when the
  peer matches an explicitly configured trusted-proxy range
- `APP_SESSION_SECRET` is required in production-like environments; weak,
  short, placeholder, or low-entropy secrets are rejected at startup
- `/api/enhance` (and all state-changing routes) validate `Host` and `Origin`
- SIGINT/SIGTERM stop claiming new jobs, drain the in-flight job within the
  configured `SHUTDOWN_DRAIN_TIMEOUT_MS`, and requeue it if the drain times out
- rate-limit bucket cleanup runs in the maintenance loop (`60s`), not on the
  request hot path
- ops counters are exposed at `GET /api/ops/counters` (host-restricted) and
  emitted as structured events with stable names

## Verification Snapshot

- backend typecheck: pass
- backend tests: **105/105 pass**
- backend build: pass
- full `npm run verify`: pass

## What Was Just Upgraded

- trusted-proxy / client IP policy: forwarded headers only trusted from
  explicitly configured proxy ranges (CIDR, exact IP, or "loopback")
- session secret policy: strength + length + entropy + placeholder guard,
  required in production-like environments, generated dev secret only with
  explicit opt-in outside tests
- graceful shutdown: stop claim, drain active job, requeue on timeout, all
  lifecycle transitions recorded as ops events
- rate-limit cleanup: moved to the maintenance loop; no request hot-path cleanup
  remains
- ops metrics module: stable event names + in-process counters for abuse,
  job lifecycle, verification outcomes, orchestration retries/replans/
  fallbacks, and processor health; scraped via `/api/ops/counters`
- job worker error handling: mark-failed, refund, and input-delete now each
  wrapped in their own `try/catch` so one failure path cannot mask another
- `c.env` access in the request middleware is now fully optional-chained so
  Hono's `app.request()` test harness doesn't explode when `incoming` is
  absent

## Current Blockers

- none blocking the backend freeze for this phase

## Exact Next Step

1. stop backend feature work for this phase
2. move to frontend-focused product development
3. defer auth/accounts, payments, Supabase, cloud object storage, distributed
   queueing, and external observability until they are actual launch blockers
