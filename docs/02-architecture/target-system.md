# Target System — Next Milestone

> This file describes what still needs to be built after the current hardening pass.

## 1. Real customer identity

Current state:

- signed anonymous sessions
- session-scoped credits
- no account ownership

Target state:

- real auth/accounts
- account-owned credits and outputs
- clearer abuse and billing boundaries

## 2. Purchased credits / payments

Current state:

- credits are granted at session creation
- reservation/refund is real
- no payment event creates those credits

Target state:

- purchased credit packs
- billing ledger / reconciliation
- paid vs promotional credits tracked separately

## 3. Cloud object storage

Current state:

- local filesystem object-store abstraction
- signed backend delivery still goes through `/api/outputs/:outputId`

Target state:

- S3/R2-compatible storage implementation behind the same abstraction
- retention and delivery policies suitable for multi-instance deployment

## 4. External observability + safer deploys

Current state:

- structured logs
- SQLite node telemetry
- no external metrics or traces

Target state:

- exported metrics/tracing/alerts
- graceful shutdown / worker drain logic
- deployment/runtime manifests
