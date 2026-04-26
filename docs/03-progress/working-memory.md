# Working Memory

## Current Objective

Keep the existing automation-first enhancement system stable while shifting the remaining work from local-runtime hardening to launch-grade infrastructure.

## Verified Reality

- `/api/enhance` is still the product entrypoint
- frontend UX is still preset-based and provider-safe
- `PROCESSOR=fal` now uses durable async jobs
- OpenRouter remains planning-only
- output metadata is stored in SQLite
- output bytes are stored in filesystem-backed object storage
- consistency profiles are persisted per `session + preset`
- final verification is authoritative
- Host/Origin checks, trusted-proxy IP extraction, strong session-secret policy,
  and worker drain/requeue behavior are implemented
- frontend polling is hidden inside `BackendProcessor`

## Constraints

- do not expose prompts or provider details in the customer UI
- do not break the `/api/enhance` contract
- keep FAL as the only image-generation backend
- keep OpenRouter structured and planning-only
- keep config frozen at startup
- keep credit reservation/refund transactional

## Known Remaining Gaps

- no real auth/accounts
- no real payments
- no cloud object storage
- no distributed workers / external queue infra
- no external metrics/tracing/alerts

## Current Test Baseline

- root tests: `115`
- backend tests: `105`
- Playwright E2E: `10`

## Next Exact Milestone

Frontend-focused product development. Backend-only launch infrastructure remains
deferred on purpose:

1. auth/account boundary
2. paid credits
3. cloud storage swap
4. external observability
