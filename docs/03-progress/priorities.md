# Priorities — What To Build Next

> Ordered by launch-blocking impact. Derived from code reality, not aspirational planning.

## Tier 1: Launch Blockers

These must be done before any paying customer uses the product.

1. **Payments integration** — purchased credits via Stripe or equivalent. The session credit system is already transactional; needs a payment webhook to top up credits.

2. **Cloud object storage** — move output BLOBs from SQLite to S3/R2. The current signed-URL system can be adapted to point to cloud URLs instead of local endpoints.

3. **Deployment configuration** — Dockerfile, reverse proxy (nginx/Caddy) with TLS, health check endpoint is already implemented.

4. **Session secret enforcement** — remove the dev-only fallback in `config.ts` and require a real secret in all environments.

## Tier 2: Production Readiness

These should be done before scaling beyond a handful of users.

5. **Async job queue for AI processing** — FAL.ai inference takes 5–30s. Synchronous processing blocks server connections. Enqueue AI-heavy presets as background jobs.

6. **Processor strategy decision** — choose sharp-always, fal-always, or per-preset hybrid. This determines pricing, latency SLAs, and infrastructure cost.

7. **Delete dead code** — remove `backend/src/validation.ts` and `backend/tests/validation.test.ts` (dead; real validation is in `image-validation.ts`).

## Tier 3: Scale and Polish

8. **User accounts** — currently sessions are anonymous. For credit persistence across devices, need account system.

9. **Admin/monitoring dashboard** — structured logs exist but no dashboard for viewing them.

10. **Multi-instance SQLite migration** — if scaling horizontally, move session/rate-limit state to PostgreSQL or Redis. Currently single-node only.
