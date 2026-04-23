# Current Status

## Current Objective

The repo is past advanced-MVP and now has a production-shaped local runtime:

- durable async FAL jobs
- filesystem-backed object storage abstraction
- persisted consistency profiles
- structured orchestration telemetry
- authoritative final verification
- browser E2E for the main customer flow

## Active Milestone

Operational hardening pass complete. The next milestone is launch infrastructure, not more orchestration features.

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

## Verification Snapshot

- root tests: `91/91`
- backend tests: `81/81`
- Playwright E2E: `2/2`
- frontend typecheck: pass
- backend typecheck: pass
- frontend build: pass
- backend build: pass
- `npm run verify`: pass

## What Was Just Upgraded

- FAL-heavy work moved to durable async jobs
- output bytes moved behind a storage abstraction
- backend job status endpoint added for polling
- job/node telemetry persisted in SQLite
- local-dev session secret is generated per workspace instead of hardcoded
- request-path maintenance is no longer the primary cleanup mechanism

## Current Blockers

No repo-local blocker remains for the current single-node product path.

## Exact Next Step

1. add real auth/accounts
2. add purchased credits / payments
3. swap filesystem object storage for cloud object storage
4. add external metrics, tracing, and graceful shutdown/drain handling
