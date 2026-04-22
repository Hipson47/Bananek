# Target System — Not Yet Implemented

> This document describes the intended production state. Nothing here exists in code today unless explicitly noted.

## Production MVP Target

The local MVP (see `current-system.md`) needs three capabilities before it can serve paying customers:

### 1. Payments and Purchased Credits

**Current state**: sessions start with a configurable number of free credits (`DEFAULT_SESSION_CREDITS`, default 3). No money changes hands. Credit reservation and refund are transactional in SQLite.

**Target state**: integrate a payment provider (likely Stripe) so users can purchase credit packs. Reconcile purchased credits against the existing session credit system. Track paid vs. free credits separately for accounting.

**Open questions**: pricing model (per-image, subscription, pack-based), whether credits are session-scoped or account-scoped, whether to add user accounts.

### 2. Cloud Object Storage

**Current state**: processed images are stored as BLOBs in the SQLite database on disk. This works for single-node local development but cannot scale to multi-instance deployment, has no CDN delivery, and makes the database grow unboundedly.

**Target state**: move processed images to S3-compatible object storage (likely Cloudflare R2 for zero-egress cost). Signed URLs point to the storage provider instead of the local server. SQLite retains metadata only.

**Open questions**: retention policy (how long to keep processed images), whether to use presigned upload URLs for large inputs.

### 3. Async Processing for AI Traffic

**Current state**: all image processing runs synchronously in the HTTP request handler. Sharp processing completes in milliseconds, but FAL.ai inference can take 5–30 seconds, tying up the server connection.

**Target state**: for AI-heavy presets, enqueue processing as an async job. Return a job ID immediately, let the client poll or receive a webhook/SSE notification when processing completes.

**Open questions**: queue technology (BullMQ, SQS, or simpler polling), whether sharp-only presets should remain synchronous.

## Processor Strategy Decision (Pending)

The system supports three processor backends but has no production strategy for when to use which:

- **Option A**: sharp always (no AI, no API cost, fastest)
- **Option B**: fal always (highest quality, highest cost, highest latency)
- **Option C**: per-preset hybrid (some presets use sharp, some use fal, based on image analysis scores)

This decision affects pricing, infrastructure, and UX and is the most important open product question.

## Infrastructure Gaps

| Gap | Impact | Priority |
|---|---|---|
| No Dockerfile or deployment config | Cannot deploy to any cloud provider | High — blocks launch |
| No TLS/HTTPS enforcement | Insecure in production | High — blocks launch |
| Dev-only session secret fallback | Security hole if accidentally deployed | Medium — easy fix |
| No browser E2E coverage | Regressions can slip through the real upload->result flow | Medium |
| Single-node SQLite | Cannot run multiple instances | High — blocks horizontal scaling |
