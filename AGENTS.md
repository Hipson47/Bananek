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

## Current Filesystem Reality

- Treat the current filesystem snapshot as the primary truth for what exists now.
- `src/` contains a runnable Vite + React + TypeScript customer-mode enhancement app.
- `backend/` contains a Node.js + Hono + TypeScript server with `POST /api/enhance`.
- If a document describes code, tests, folders, or infrastructure that are not present in the filesystem, do not treat them as implemented.
- If git metadata or earlier docs suggest missing code once existed, treat that as historical or planned context, not current filesystem reality.

## Read Order

Agents should build context in this order:
1. `AI_CONTEXT.md` — single-file handoff with everything needed to start
2. `AGENTS.md` — this file; rules and constraints
3. `docs/02-architecture/current-system.md` — verified system description
4. `docs/03-progress/working-memory.md` — current objective and active constraints
5. actual filesystem, code, tests, configs
6. `docs/03-progress/priorities.md` — what to build next

## Repo Reality Rules

- Trust filesystem reality first, then code/tests/config evidence.
- Treat strategy docs as planning artifacts, not executable truth.
- If a doc conflicts with code, call it out explicitly and update the doc if part of the task.
- Do not assume the repo is production-ready.
- Do not assume the repo is runnable if the required source tree is missing.
- Never invent missing files, folders, tests, services, or infrastructure.

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
- If the filesystem snapshot is incomplete or unbuildable, stop implementation work and document the blocker first.

## Security Rules

- Provider API keys must never be exposed to the browser in product mode.
- Uploads are untrusted and must be treated as hostile input.
- Billing, auth, storage, job processing, and delivery paths require explicit caution.
- No destructive changes without explicit approval.

## Coordination Rules

- Use `docs/07-meta/agent-work-map.md` for role boundaries.
- Use `docs/03-progress/current-status.md` for shared progress.
- Use `docs/04-decisions/open-questions-register.md` for unresolved decisions.
- Use `docs/04-decisions/decision-log.md` for stable project decisions.
- Use `docs/03-progress/priorities.md` for what to build next.

## Documentation Sync Rules

- Keep `README.md` truthful about what is actually present in the repo today.
- Keep `AI_CONTEXT.md` current as the primary handoff file for new sessions.
- Keep `docs/02-architecture/current-system.md` verified against actual code.
- Keep `docs/03-progress/current-status.md` limited to present blockers and immediate next actions.
- If a document is still useful but no longer current, relabel it as planned, historical, or superseded instead of silently preserving false claims.
