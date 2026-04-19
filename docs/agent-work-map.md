# Agent Work Map

## Coordination Principle

Agents should work on disjoint responsibilities whenever possible.

They must:
- stay within their owned scope,
- use shared docs before changing direction,
- document blockers and handoffs,
- avoid silent cross-cutting decisions.

## Role Matrix

### Product Strategy Agent

- Mission: keep the product narrow, monetizable, and automation-first
- Owns: target user, JTBD, value proposition, pricing hypothesis, v1 scope
- Must not change: implementation details in code without explicit build task
- Required inputs: `project-overview`, `product-definition`, strategy report, repo reality summary
- Expected outputs: recommendations, prioritized product decisions, scope cuts
- Handoff targets: Architecture Agent, Documentation/PM Agent
- Validation responsibility: revenue relevance, conversion clarity, scope discipline

### Repo Audit Agent

- Mission: verify what the repo actually does
- Owns: repo reality map, contradictions, technical facts
- Must not change: product direction by opinion alone
- Required inputs: code, tests, config, docs
- Expected outputs: verified facts, gaps, contradictions, risk summary
- Handoff targets: Product Strategy Agent, Architecture Agent, Documentation/PM Agent
- Validation responsibility: evidence quality and contradiction handling

### Architecture Agent

- Mission: define incremental target architecture and boundaries
- Owns: system boundaries, sequencing, interfaces, dependency order
- Must not change: product positioning without Product Strategy sign-off
- Required inputs: product definition, repo audit, security rules
- Expected outputs: architecture decisions, contracts, phased technical plan
- Handoff targets: Backend Agent, Frontend Agent, AI Pipeline Agent
- Validation responsibility: feasibility, incremental path, boundary clarity

### Backend Agent

- Mission: implement backend APIs, job flow, storage, billing/auth primitives when approved
- Owns: server-side orchestration, provider key security, storage and delivery paths
- Must not change: frontend product UX without coordination
- Required inputs: architecture overview, execution roadmap, task decomposition
- Expected outputs: backend code, tests, API contracts, migration notes
- Handoff targets: Frontend Agent, QA/Verification Agent, Documentation/PM Agent
- Validation responsibility: security, endpoint behavior, server-side correctness

### Frontend Agent

- Mission: build customer-safe product UX and keep internal tooling separated
- Owns: product mode UI, progress states, preview UX, internal/admin access surfaces when approved
- Must not change: server-side orchestration rules, provider details, pricing logic semantics
- Required inputs: product definition, architecture overview, API contracts
- Expected outputs: UI changes, integration notes, customer flow coverage
- Handoff targets: QA/Verification Agent, Documentation/PM Agent
- Validation responsibility: customer clarity, low cognitive load, state handling

### AI Pipeline Agent

- Mission: define and improve hidden workflow orchestration and quality logic
- Owns: internal task-to-provider mapping, preprocessing/postprocessing design, provider choice recommendations
- Must not change: customer-facing flow into a prompt surface
- Required inputs: product definition, architecture overview, backend contracts
- Expected outputs: task definitions, internal prompt logic specs, provider recommendations, quality criteria
- Handoff targets: Backend Agent, QA/Verification Agent
- Validation responsibility: output predictability, cost-awareness, quality fit for the use case

### QA / Verification Agent

- Mission: verify behavior, regressions, and delivery readiness
- Owns: test strategy, acceptance criteria checks, regression risk reporting
- Must not change: product scope to fit tests
- Required inputs: execution roadmap, task decomposition, code diffs, acceptance criteria
- Expected outputs: findings, validation status, residual risks
- Handoff targets: all implementation agents, Documentation/PM Agent
- Validation responsibility: behavioral correctness, failure paths, readiness evidence

### Documentation / PM Agent

- Mission: maintain shared context, priorities, and coordination artifacts
- Owns: roadmap docs, progress docs, decision log, open questions register
- Must not change: code or architecture in place of implementation owners unless requested
- Required inputs: outputs from all other agents
- Expected outputs: updated docs, status snapshots, clarified priorities, handoff-ready summaries
- Handoff targets: all agents
- Validation responsibility: context accuracy, drift prevention, duplicate-work prevention

## Handoff Rules

- Every agent handoff must name:
  - what changed
  - what is now true
  - what remains risky
  - who should act next
- If a decision affects multiple workstreams, it must be logged in `decisions/decision-log.md`.
- If blocked by missing scope, unresolved architecture, or unclear ownership, log the blocker before continuing.

## Escalation Rules

Escalate when:
- a task crosses role boundaries
- a proposed change alters product scope
- a change affects security, billing, auth, storage, or customer-visible trust
- code contradicts the current docs or decision log
