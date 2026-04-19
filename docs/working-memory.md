# Working Memory

## Current Objective

Establish a shared documentation and coordination system so multiple agents can evolve the repo from an internal playground into an automation-first paid product foundation.

## Decisions

- The default product direction is `AI product photo enhancement for e-commerce sellers`.
- The default customer experience is no-prompt, automation-first, and low-ticket.
- Customer Product Mode and Internal/Admin/Playground Mode must remain separate.
- Code, tests, and explicit decisions outrank strategy documents.
- Repo-level guidance starts in `AGENTS.md`, then `docs/README.md`.

## Active Constraints

- The repo is not yet production-ready.
- Provider keys must move server-side in product mode.
- Uploads must be treated as untrusted input.
- Prompt and model controls must not appear in the default customer experience.

## Files/Systems Touched

- `AGENTS.md`
- `docs/README.md`
- `docs/project-overview.md`
- `docs/product-definition.md`
- `docs/architecture-overview.md`
- `docs/execution-roadmap.md`
- `docs/agent-work-map.md`
- `docs/task-decomposition.md`
- `docs/source-of-truth-rules.md`
- `docs/security-and-risk-rules.md`
- `docs/progress-tracking.md`
- `docs/progress/current-status.md`
- `docs/open-questions-register.md`
- `docs/decisions/decision-log.md`

## Open Risks

- The first paid task is not yet locked.
- The first backend stack is not yet locked.
- The current codebase still reflects a prompt-first playground UX.
- Quality and cost of the first hidden AI pipeline are not yet validated.

## Next Exact Step

Lock the first customer-facing paid task and the backend implementation slice, then assign the first parallel workstreams against the new docs system.
