# Architecture Overview

## Current Architecture

### Verified Facts

- frontend-only SPA
- reducer-driven local state
- provider abstraction in `src/lib/provider/*`
- model registry in `src/lib/modelRegistry.ts`
- direct browser-to-provider API calls
- uploads and generated assets currently live in browser memory as `blob:` or `data:` URLs

## Current Architecture Summary

Frontend responsibilities today:
- collect prompt, model, settings, references
- validate state
- route generation to provider adapter
- render result and local actions

Missing today:
- server-side provider control
- auth
- billing
- persistent assets
- job processing
- observability

## Target Architecture

### Proposal

Incrementally evolve to:
- customer-facing frontend for predefined workflows
- backend API for orchestration
- server-side provider routing
- durable storage for uploads and outputs
- job state tracking
- billing/auth layer added after the secure processing path exists

## Key Systems And Boundaries

### Frontend

Owns:
- upload UI
- simple task selection
- preview UI
- customer state and task progress display

Must not own:
- provider keys
- raw prompt generation logic
- provider selection
- final pricing or credit enforcement logic

### Backend

Owns:
- request validation
- provider key management
- hidden prompt and routing logic
- preprocessing and postprocessing orchestration
- job status
- payment and entitlement checks
- final delivery authorization

### Provider Abstraction Layer

Owns:
- normalized request/response contract
- provider-specific request formatting
- provider error normalization
- routing between internal task definitions and external providers

Must not own:
- customer-facing UX semantics
- billing logic
- browser state

## Upload Flow

### Current

- browser file input
- local preview
- browser sends data directly to providers in some flows

### Target

1. Frontend submits upload intent to backend.
2. Backend authorizes and returns upload instructions.
3. Asset is stored in controlled storage.
4. Backend records a processing job.

## Processing Flow

### Target

1. Customer selects a predefined task.
2. Backend maps task to internal workflow.
3. Backend runs preprocessing.
4. Backend calls provider abstraction with hidden prompt logic.
5. Backend runs postprocessing and basic quality checks.
6. Backend stores final output and updates job state.
7. Frontend polls or subscribes to job status.

## Storage Lifecycle

### Proposal

- original upload stored temporarily
- derived working assets stored only as needed
- final customer-visible output stored long enough for preview/download
- retention and deletion policy explicitly defined later

### Constraints

- uploads are untrusted
- storage paths must not be guessable
- output delivery must be authorized

## Backend Responsibilities

- secure provider access
- workflow orchestration
- persistent job tracking
- storage coordination
- payment/credit gating
- logging and error normalization

## Frontend Responsibilities

- collect only customer-safe inputs
- render progress and results
- avoid exposing internal orchestration details
- keep internal playground isolated if retained

## Architecture Decision Constraints

- incremental evolution over rewrite
- preserve useful provider abstraction code where possible
- no provider keys in the browser
- no customer prompts in the default product flow
