# AGENTS.md

## Purpose

This repository is evolving from an internal image-model playground into a narrowly scoped, monetizable product.

The default product direction is:
- automation-first,
- no-prompt customer experience,
- low-ticket paid outcomes,
- product photo enhancement for e-commerce sellers.

The default user-facing workflow is:
- upload one photo,
- choose one predefined task,
- wait for automated processing,
- preview,
- pay or spend credits,
- download the finished result.

The raw prompt playground remains allowed only as an internal/admin workflow.

## Read Order

Agents should build context in this order:
1. `AGENTS.md`
2. `docs/README.md`
3. `docs/working-memory.md`
4. actual code, tests, configs
5. `docs/product-strategy-report.md`
6. older docs only if still needed

## Repo Reality Rules

- Trust code and tests over docs.
- Treat strategy docs as planning artifacts, not executable truth.
- If a doc conflicts with code, call it out explicitly and update the doc if part of the task.
- Do not assume the repo is production-ready.

## Product Mode Rules

### Customer Product Mode

- No prompts
- No provider choice
- No API keys
- No advanced generation settings
- No model terminology in the primary UX
- Predefined workflows only
- Predictable, automation-first outcomes

### Internal/Admin/Playground Mode

- Prompt testing allowed
- Provider comparison allowed
- Debugging tools allowed
- Model experimentation allowed
- Not the default product experience

## Architecture Rules

- Preserve and extend the provider abstraction boundary.
- Move provider keys and provider calls server-side.
- Keep upload handling, processing orchestration, and delivery explicit.
- Prefer incremental evolution over rewrite.
- Separate customer-facing product flow from internal tooling flow.

## Execution Rules

- Work from the smallest high-leverage slice.
- Prioritize blocker removal, security, monetization readiness, and dependency order.
- Keep changes localized and reversible.
- Update docs when architecture, product scope, or work ownership changes.

## Security Rules

- Provider API keys must never be exposed to the browser in product mode.
- Uploads are untrusted and must be treated as hostile input.
- Billing, auth, storage, job processing, and delivery paths require explicit caution.
- No destructive changes without explicit approval.

## Coordination Rules

- Use `docs/agent-work-map.md` for role boundaries.
- Use `docs/task-decomposition.md` for workstream ownership.
- Use `docs/progress-tracking.md` and `docs/progress/current-status.md` for shared progress.
- Use `docs/open-questions-register.md` for unresolved decisions.
- Use `docs/decisions/decision-log.md` for stable project decisions.
