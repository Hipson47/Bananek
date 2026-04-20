# Working Memory

## Current Objective

Use the newly restored runnable frontend slice as the base for the next secure backend-proxy implementation step.

## Decisions

- The default product direction is `AI product photo enhancement for e-commerce sellers` (DEC-001).
- The default customer experience is no-prompt, automation-first, and low-ticket (DEC-001).
- Customer Product Mode and Internal/Admin/Playground Mode must remain separate (DEC-003).
- Code, tests, and explicit decisions outrank strategy documents (DEC-002).
- Documentation must separate current state from target state and historical/planning material (DEC-011).
- Phase 1 backend-proxy decisions remain accepted target-state decisions, not implemented-state facts.

## Active Constraints

- The current app is frontend-only and uses a mock processor.
- Product planning material should be preserved, but not presented as implemented.
- Backend/provider integration remains deferred to the next slice.

## Files/Systems Touched

- `README.md`
- `AGENTS.md`
- `docs/README.md`
- `docs/project-overview.md`
- `docs/progress/current-status.md`
- `docs/source-of-truth-rules.md`
- `docs/decisions/decision-log.md`
- `src/`
- `index.html`
- additional user-facing planning docs that needed truth-state relabeling

## Open Risks

- The app currently relies on a browser-side mock processor rather than a real backend boundary.
- Some strategic and architecture docs may still require further relabeling as implementation catches up.
- The current test coverage is intentionally narrow.

## Next Exact Step

1. Implement the Phase 1 backend proxy.
2. Swap the mock processor seam for a backend adapter.
3. Extend tests around request/response handling once the backend exists.
