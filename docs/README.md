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

## Current Reality Rule

This docs set must distinguish three things clearly:

- `Current State`: what is verified in the current filesystem snapshot
- `Target State`: what has been decided or planned but is not yet implemented here
- `Historical / Planning`: older reports, recommendations, or specs that remain useful as context

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

### Canonical / operational

- [project-overview.md](project-overview.md): canonical current-state summary plus target-state framing
- [source-of-truth-rules.md](source-of-truth-rules.md): authority hierarchy and contradiction handling
- [progress/current-status.md](progress/current-status.md): live operational status for the current filesystem snapshot
- [decisions/decision-log.md](decisions/decision-log.md): durable accepted decisions and their implementation status

### Product / target-state planning

- [product-definition.md](product-definition.md): target user, JTBD, paid flow, scope
- [architecture-overview.md](architecture-overview.md): target architecture and system boundaries, with current-state notes
- [execution-roadmap.md](execution-roadmap.md): phased target-state roadmap
- [agent-work-map.md](agent-work-map.md): role boundaries and handoffs
- [task-decomposition.md](task-decomposition.md): workstreams and dependencies
- [security-and-risk-rules.md](security-and-risk-rules.md): cross-cutting risk posture
- [open-questions-register.md](open-questions-register.md): unresolved product and architecture questions
- [progress-tracking.md](progress-tracking.md): shared status/update format
- [working-memory.md](working-memory.md): compact handoff state

### Strategic / historical

- [specs/phase1-backend-proxy.md](specs/phase1-backend-proxy.md): approved implementation spec for a future backend slice, not proof of current implementation
- [architecture-recommendation.md](architecture-recommendation.md): architecture recommendation document, partly historical
- [product-strategy-report.md](product-strategy-report.md): strategic planning report; useful, but not a source of current-state truth

## Update Discipline

- Update `working-memory.md` when the active objective or next exact step changes.
- Update `progress/current-status.md` when a workstream status changes or a blocker appears.
- Update `decision-log.md` when a significant decision is made and accepted.
- Update product and architecture docs when customer-facing scope or system boundaries change.
- Do not silently overwrite contradictions. Mark them and resolve them.
- If the working tree is incomplete, update the current-state docs before attempting implementation.
