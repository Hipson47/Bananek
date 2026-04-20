# Project Overview

## What This Project Is

- `Verified Fact`: a runnable Vite + React + TypeScript frontend slice for product photo enhancement
- `Verified Fact`: a repository that still contains substantial planning and architecture documentation alongside the runnable frontend
- `Verified Fact`: a project that is intended to evolve into a monetizable, automation-first AI photo product

## What This Project Is Not

- `Verified Fact`: not yet a complete product platform
- `Verified Fact`: not yet a production-grade product
- `Verified Fact`: not yet a backend system
- `Verified Fact`: not yet a billing/auth/storage platform
- `Constraint`: not a general-purpose image studio for end users
- `Constraint`: not a customer-facing prompt playground

## Product Goal

- `Proposal`: build a low-friction paid workflow where a customer uploads a photo, selects a simple predefined task, and receives a polished automated result

## Strategic Direction

- `Proposal`: default wedge is `AI product photo enhancement for e-commerce sellers`
- `Proposal`: default value is turning amateur product photos into commerce-ready assets
- `Constraint`: prompting, provider routing, preprocessing, postprocessing, and quality checks remain internal

## Current Repo State

### Verified Facts

- `package.json`, `vite.config.ts`, `tsconfig*.json`, and `index.html` are present
- `src/` is present and contains the active frontend app
- `docs/` is present and contains active product, architecture, roadmap, and coordination documents
- `dist/` is present and can be regenerated from the current app
- `node_modules/` is present in the current working tree
- `npm test` passes for the current lightweight validation test coverage
- `npm run build` succeeds for the current frontend slice

### Current Strengths

- a runnable user flow now exists for upload -> preset selection -> processing -> result
- a substantial documentation and planning system exists
- accepted decisions preserve useful product and architecture direction
- the mock image processor creates a clean seam for future backend/provider integration

### Current Constraints

- current implementation is frontend-only and uses a mock browser-side processor
- there is no backend provider proxy yet
- there is no auth, billing, storage, or async job system yet

## Target State

### Planned Direction

- restore a working frontend codebase
- preserve or rebuild the provider abstraction boundary
- move provider keys server-side
- evolve from internal playground behavior toward an automation-first paid product

### Product Direction

- `Proposal`: default wedge is `AI product photo enhancement for e-commerce sellers`
- `Proposal`: default value is turning amateur product photos into commerce-ready assets
- `Constraint`: prompting, provider routing, preprocessing, postprocessing, and quality checks remain internal

## Historical / Reference Context

- `Historical / Planned`: several docs still describe a more advanced playground/provider-adapter codebase than the current runnable slice
- `Historical / Planned`: Phase 1 backend-proxy documentation remains approved target-state planning, not implemented-state fact

## Non-Goals

- broad prompt engineering product for customers
- many-model exploration UI for customers
- general-purpose creative studio
- early marketplace integrations
- batch pipelines before the single-photo paid path works
- full rewrite before validating the first paid workflow
