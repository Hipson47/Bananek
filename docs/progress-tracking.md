# Progress Tracking

## Purpose

Use this document and `progress/current-status.md` to coordinate long-running multi-agent execution.

## Status Labels

- `not_started`
- `in_progress`
- `blocked`
- `needs_review`
- `done`
- `archived`

## Required Tracking Fields

Each tracked item should include:
- ID
- title
- owner
- status
- last updated
- dependencies
- blockers
- next action
- evidence

## Blocker Format

Use:

```md
- Blocker: <short title>
  - Impact: <what cannot proceed>
  - Needed from: <role or decision owner>
  - Unblock action: <specific next action>
```

## Assumption Format

Use:

```md
- Assumption: <claim>
  - Confidence: low | medium | high
  - Evidence: <what supports it>
  - Validation needed: <how to prove or disprove it>
```

## Progress Update Format

Use:

```md
## Update <YYYY-MM-DD>
- Workstream:
- Owner:
- Status:
- Completed:
- In Progress:
- Blocked:
- Risks:
- Next:
```

## Decision Log Format

Use `docs/decisions/decision-log.md` with:
- ID
- date
- title
- status
- context
- decision
- consequences
- related docs/workstreams

## Folding Completed Work Back Into Shared Context

When work is done:
1. update the relevant workstream status
2. record any stable decision
3. update open questions if one was resolved
4. update `working-memory.md` if the current objective or next exact step changed
