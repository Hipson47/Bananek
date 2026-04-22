# Documentation Index

> For a quick start, read [`../AI_CONTEXT.md`](../AI_CONTEXT.md) first — it's the single-file handoff for new sessions.

## Folder Structure

```
docs/
├── 01-product/          Product definition and direction
├── 02-architecture/     System architecture, security, gaps
├── 03-progress/         Status, roadmap, priorities, working memory
├── 04-decisions/        Decision log and open questions
├── 05-specs/            Technical specs (historical only for now)
├── 06-audits/           Code review findings
├── 07-meta/             Process rules, agent coordination, project overview
└── 08-archive/          Superseded documents
```

## Read Order

For a deep read (after `AI_CONTEXT.md`):

1. [`02-architecture/current-system.md`](02-architecture/current-system.md) — what actually exists in code
2. [`03-progress/current-status.md`](03-progress/current-status.md) — workstream status and blockers
3. [`03-progress/priorities.md`](03-progress/priorities.md) — what to build next, ordered
4. [`02-architecture/target-system.md`](02-architecture/target-system.md) — what needs to be built for launch
5. [`02-architecture/known-gaps.md`](02-architecture/known-gaps.md) — security, architecture, code, and testing gaps
6. [`04-decisions/decision-log.md`](04-decisions/decision-log.md) — accepted decisions (DEC-001–DEC-013)
7. [`04-decisions/open-questions-register.md`](04-decisions/open-questions-register.md) — unresolved questions

## Document Map

### 01-product
- [`product-definition.md`](01-product/product-definition.md): target user, JTBD, paid flow, v1 scope, success metrics

### 02-architecture
- [`current-system.md`](02-architecture/current-system.md): **verified** runtime architecture, enhancement flow, key files
- [`target-system.md`](02-architecture/target-system.md): what needs to be built (payments, cloud storage, async jobs)
- [`known-gaps.md`](02-architecture/known-gaps.md): security, architecture, code quality, and testing gaps
- [`architecture-overview.md`](02-architecture/architecture-overview.md): system boundaries and orchestration overview
- [`security-and-risk-rules.md`](02-architecture/security-and-risk-rules.md): cross-cutting security posture

### 03-progress
- [`current-status.md`](03-progress/current-status.md): live workstream status, blockers, next actions
- [`working-memory.md`](03-progress/working-memory.md): compact session handoff state
- [`priorities.md`](03-progress/priorities.md): ordered list of what to build next
- [`execution-roadmap.md`](03-progress/execution-roadmap.md): phased roadmap with completion status
- [`progress-tracking.md`](03-progress/progress-tracking.md): status label definitions and update format

### 04-decisions
- [`decision-log.md`](04-decisions/decision-log.md): 13 decisions (DEC-001–DEC-013); DEC-004–008 superseded
- [`open-questions-register.md`](04-decisions/open-questions-register.md): unresolved product/arch questions

### 05-specs
- [`phase1-backend-proxy.md`](05-specs/phase1-backend-proxy.md): tombstone — original spec for `/api/generate`

### 06-audits
- `docs/06-audits/` now contains redirect notes only; the active audit files live under [`docs/audits/`](audits/)
- [`audits/latest-code-review.md`](audits/latest-code-review.md): full audit (2026-04-22)
- [`audits/latest-code-review-summary.md`](audits/latest-code-review-summary.md): top-10 issues with fix status

### 07-meta
- [`source-of-truth-rules.md`](07-meta/source-of-truth-rules.md): authority hierarchy and contradiction handling
- [`agent-work-map.md`](07-meta/agent-work-map.md): role boundaries for multi-agent coordination
- [`project-overview.md`](07-meta/project-overview.md): current-state + target-state summary

### 08-archive
Superseded documents. Not current-state truth.
- [`architecture-recommendation.md`](08-archive/architecture-recommendation.md): pre-Phase-1 stack recommendation
- [`nano-banana-playground-prd.md`](08-archive/nano-banana-playground-prd.md): original playground PRD
- [`phase1-backend-proxy.md`](08-archive/phase1-backend-proxy.md): original `/api/generate` spec
- [`product-strategy-report.md`](08-archive/product-strategy-report.md): pre-Phase-1 strategy (Polish)
- [`task-decomposition.md`](08-archive/task-decomposition.md): completed planning workstreams

## Update Rules

- Update `03-progress/working-memory.md` when the active objective changes.
- Update `03-progress/current-status.md` when a workstream completes or a blocker appears.
- Update `04-decisions/decision-log.md` when a significant decision is accepted.
- Do not silently overwrite contradictions — mark and resolve them.
