# Task Decomposition

## Workstream Rules

- Parallelize work only when ownership is disjoint.
- Do not start customer-facing implementation that depends on unresolved backend contracts.
- Track dependencies explicitly.

## WS1 — Product Definition Lock

- Objective: lock the first customer-facing paid workflow
- Dependencies: none
- Owner Agent: Product Strategy Agent
- Can run in parallel with: WS2, WS3
- Definition of Done:
  - target user is explicit
  - first task/preset is explicit
  - v1 scope and non-goals are explicit

## WS2 — Repo Reality And Contracts

- Objective: keep an accurate map of current code and adapter boundaries
- Dependencies: none
- Owner Agent: Repo Audit Agent
- Can run in parallel with: WS1, WS3
- Definition of Done:
  - current architecture map exists
  - contradictions are logged
  - reusable existing abstractions are identified

## WS3 — Target Architecture And First Slice

- Objective: define the smallest secure system change that unlocks productization
- Dependencies: WS1 inputs, WS2 inputs
- Owner Agent: Architecture Agent
- Sequential Dependency: needed before WS4 and WS5 start meaningful implementation
- Definition of Done:
  - backend boundary is defined
  - customer/internal mode split is defined
  - first implementation slice is explicit

## WS4 — Backend Orchestration Foundation

- Objective: introduce server-side orchestration for predefined enhancement tasks
- Dependencies: WS3
- Owner Agent: Backend Agent
- Can run in parallel with: WS5 after API contract freeze
- Definition of Done:
  - provider keys are server-side only
  - backend accepts a predefined task request
  - result path is testable

## WS5 — Customer Product Mode Frontend

- Objective: build the simplified upload-task-preview UX
- Dependencies: WS3, partial WS4 contract
- Owner Agent: Frontend Agent
- Can run in parallel with: WS6
- Definition of Done:
  - no customer prompts
  - no customer provider/model controls
  - clear upload-to-result flow exists

## WS6 — AI Task Pipeline Definition

- Objective: define internal workflow logic for the first paid task
- Dependencies: WS1, WS3
- Owner Agent: AI Pipeline Agent
- Can run in parallel with: WS4, WS5
- Definition of Done:
  - task contract exists
  - internal routing logic exists
  - quality expectations and failure conditions are documented

## WS7 — Verification Layer

- Objective: validate the new product flow and core failure paths
- Dependencies: WS4, WS5, WS6
- Owner Agent: QA / Verification Agent
- Definition of Done:
  - acceptance criteria are checked
  - regressions are reported
  - residual risks are documented

## WS8 — Shared Context And Program Tracking

- Objective: keep roadmap, decisions, blockers, and status current
- Dependencies: ongoing
- Owner Agent: Documentation / PM Agent
- Definition of Done:
  - workstream statuses are current
  - blockers are logged
  - decisions and open questions are current
