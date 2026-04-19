# Documentation System

## Purpose

This folder is the operating system for coordinated human and AI-agent work on the project.

It is designed to:
- keep product direction narrow and monetizable,
- separate verified repo reality from proposals,
- prevent duplicated effort,
- reduce architectural drift,
- support parallel execution across multiple agent roles,
- preserve context across long-running tasks.

## Product Default

Unless new evidence clearly contradicts it, the default product direction is:
- `AI product photo enhancement for e-commerce sellers`
- automation-first
- no prompts in the customer flow
- low-ticket pricing per completed result or credit pack

## Read Order

1. [../AGENTS.md](../AGENTS.md)
2. [working-memory.md](working-memory.md)
3. [project-overview.md](project-overview.md)
4. [product-definition.md](product-definition.md)
5. [architecture-overview.md](architecture-overview.md)
6. [execution-roadmap.md](execution-roadmap.md)
7. [agent-work-map.md](agent-work-map.md)
8. [task-decomposition.md](task-decomposition.md)
9. [source-of-truth-rules.md](source-of-truth-rules.md)
10. [security-and-risk-rules.md](security-and-risk-rules.md)
11. [progress-tracking.md](progress-tracking.md)
12. [open-questions-register.md](open-questions-register.md)
13. [product-strategy-report.md](product-strategy-report.md)

## Source Labels

Every major document should use these labels when relevant:

- `Verified Fact`: confirmed in code, tests, config, or infrastructure artifacts
- `Assumption`: plausible but not yet confirmed
- `Proposal`: recommended future state or change
- `Open Question`: unresolved item requiring a decision
- `Outdated or Contradicted`: claim superseded by code or a later decision

## Document Map

- [project-overview.md](project-overview.md): project framing, current state, non-goals
- [product-definition.md](product-definition.md): target user, JTBD, paid flow, scope
- [architecture-overview.md](architecture-overview.md): current and target system design
- [execution-roadmap.md](execution-roadmap.md): phased plan and priorities
- [agent-work-map.md](agent-work-map.md): roles, ownership boundaries, handoffs
- [task-decomposition.md](task-decomposition.md): workstreams, dependencies, definition of done
- [source-of-truth-rules.md](source-of-truth-rules.md): contradiction handling and assumption discipline
- [security-and-risk-rules.md](security-and-risk-rules.md): security constraints and risk posture
- [progress-tracking.md](progress-tracking.md): shared update format and status conventions
- [progress/current-status.md](progress/current-status.md): compact live project snapshot
- [open-questions-register.md](open-questions-register.md): unresolved product, architecture, and launch questions
- [decisions/decision-log.md](decisions/decision-log.md): durable decision history
- [product-strategy-report.md](product-strategy-report.md): planning artifact, not source of truth

## Update Discipline

- Update `working-memory.md` when the active objective or next exact step changes.
- Update `progress/current-status.md` when a workstream status changes or a blocker appears.
- Update `decision-log.md` when a significant decision is made and accepted.
- Update product and architecture docs when customer-facing scope or system boundaries change.
- Do not silently overwrite contradictions. Mark them and resolve them.
