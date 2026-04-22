# Project Overview

## What This Project Is

- `Verified Fact`: a runnable Vite + React + TypeScript frontend for a preset-based product photo enhancement workflow
- `Verified Fact`: a runnable Node.js + Hono + TypeScript backend in `backend/`
- `Verified Fact`: a repository with Phase 1 (backend proxy), Phase 2 (sharp processing), and Phase 3 (FAL.ai integration) implemented
- `Verified Fact`: a project evolving toward a narrow, monetizable, automation-first e-commerce photo product

## What This Project Is Not

- `Verified Fact`: not yet a full product platform
- `Verified Fact`: not yet production-ready
- `Verified Fact`: not yet a billing/auth/storage platform
- `Constraint`: not a customer-facing prompt playground
- `Constraint`: not a general-purpose image studio

## Product Goal

- `Proposal`: build a low-friction paid workflow where a customer uploads one photo, chooses one predefined task, and receives a polished automated result

## Strategic Direction

- `Proposal`: default wedge is `AI product photo enhancement for e-commerce sellers`
- `Proposal`: customer flow remains no-prompt and automation-first
- `Constraint`: provider routing, hidden prompts, preprocessing, postprocessing, and quality checks remain internal

## Current Repo State

### Verified Facts

- `src/` is present and contains the active customer-facing app
- `backend/` is present and contains the active API server
- the active enhancement path is `App.tsx` -> `BackendProcessor` -> `/api/enhance`
- the frontend now boots a signed backend session via `/api/session` before calling `/api/enhance`
- Vite proxies `/api` to the backend in local development
- the backend supports `sharp`, `fal`, and `mock` behind the same `/api/enhance` contract
- the backend now orchestrates enhancement as `analyze -> intent normalize -> shot plan -> consistency normalize -> prompt package -> execute -> verify`
- OpenRouter is used only for structured planning/intelligence; FAL remains the image-generation backend
- processed outputs are persisted server-side and returned to the UI as `/api/outputs/:outputId` URLs
- sessions, usage events, output records, output payloads, rate-limit buckets, and processing locks are persisted in SQLite
- backend route and validation tests exist
- backend tests now cover OpenRouter client handling, node schema validation, orchestration graph behavior, prompt building, verification, and fallback behavior
- frontend tests now cover the `BackendProcessor` request/response contract

### Current Strengths

- the core customer flow exists end-to-end: upload -> preset -> process -> result
- the product path now has a real session boundary, restart-safe runtime state, persisted outputs, and server-side usage state
- the browser no longer owns the primary processing path
- the backend boundary is explicit and isolated from the UI
- the codebase now has one coherent product path with deterministic-first orchestration, OpenRouter planning nodes, and FAL execution behind the same seam

### Current Constraints

- customer auth and payments are still absent
- AI-backed processing is available, but queueing and production cost controls are still limited
- storage is durable SQLite on a single node only; no cloud object store or multi-instance retention workflow exists yet

## Near-Term Next Step

- `Verified Fact`: `sharp` and FAL.ai both sit behind the same `POST /api/enhance` seam, but OpenRouter now handles planning-only graph nodes while FAL remains the image-generation execution path
- `Verified Fact`: the backend now enforces session bootstrap, SQLite-backed rate limits, SQLite-backed credit tracking, persisted outputs, and restart-safe single-flight locks
- `Proposal`: decide whether production should prefer `sharp`, `fal`, or a per-preset hybrid strategy
- `Proposal`: replace single-node SQLite output persistence with cloud object storage and paid credit purchase before public launch

## Historical / Reference Context

- `Historical`: older docs may describe the pre-Phase-1 repo as frontend-only or backend-less
- `Historical`: older strategy and architecture recommendation documents remain useful only when explicitly labeled as historical or target-state context

## Non-Goals

- customer-facing prompt engineering
- customer-visible provider or model selection
- broad creative tooling before the narrow paid workflow is validated
- auth/billing/platform work in advance of real backend processing
