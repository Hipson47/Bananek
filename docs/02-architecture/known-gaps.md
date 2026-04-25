# Known Gaps — Code Verified

> Verified against the repo on 2026-04-24.

## Security

| Gap | Risk | Next action |
|---|---|---|
| Anonymous session model only | No real user/account ownership | Add auth/accounts before paid launch |
| No full CSRF token system | Browser boundary currently relies on same-site cookies, `X-Session-Id`, and Host/Origin checks | Add token-based CSRF only when auth/account sessions are introduced |
| No TLS enforcement in repo | Cookies unsafe without proper deployment | Terminate TLS in front of the app |

## Architecture

| Gap | Risk | Next action |
|---|---|---|
| Filesystem object storage is still single-node | No multi-instance delivery path | Swap storage adapter to S3/R2 |
| SQLite + in-process worker is still single-node | No horizontal job scaling | Introduce external queue / worker topology |
| Graceful shutdown is single-node only | Process shutdown drains or requeues one local worker, but does not coordinate multiple nodes | Add external queue / worker topology before multi-instance deployment |

## Operations

| Gap | Risk | Next action |
|---|---|---|
| No external metrics/tracing/alerts | Hard to tune or triage production incidents | Export telemetry to a real observability stack |
| No deployment config in repo | Launch path remains manual | Add deployment/runtime manifests |

## Product Readiness

| Gap | Risk | Next action |
|---|---|---|
| Credits are still a stub | No monetization path | Add purchased credits/payments |
| No real auth/accounts | No persistent customer identity | Add account model before charging users |
