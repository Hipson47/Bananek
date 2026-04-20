# Architecture Overview

## Document Status

- `Current State`: use this document only for verified filesystem-level facts about what exists now
- `Target State`: this document also captures the intended architecture after the missing application baseline is restored
- `Historical / Planned`: where this document refers to `src/` implementation details, treat them as planned or historical reference unless the filesystem proves they exist

## Current Architecture

### Verified Facts

- the current filesystem snapshot has no `src/` tree
- the repo contains frontend tooling/config files (`package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`)
- the repo contains documentation that plans a frontend playground and later backend architecture
- the current working tree is not sufficient to run, build, or test the intended app

## Current Architecture Summary

Current-state summary:
- documentation and configuration exist
- application source is missing from the filesystem snapshot
- implementation architecture cannot be verified from the current working tree alone

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

### Current State

- not verifiable from the current filesystem snapshot because the application source tree is absent

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

### Target State

- secure provider access
- workflow orchestration
- persistent job tracking
- storage coordination
- payment/credit gating
- logging and error normalization

## Frontend Responsibilities

### Target State

- collect only customer-safe inputs
- render progress and results
- avoid exposing internal orchestration details
- keep internal playground isolated if retained

## Architecture Decision Constraints

- incremental evolution over rewrite
- preserve useful provider abstraction code where possible
- no provider keys in the browser
- no customer prompts in the default product flow
