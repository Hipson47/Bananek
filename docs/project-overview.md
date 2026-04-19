# Project Overview

## What This Project Is

- `Verified Fact`: an existing `Vite + React + TypeScript` repository that started as a frontend playground for image generation and image-to-image workflows
- `Verified Fact`: it currently contains a provider abstraction layer and real browser-side adapters for `Google Gemini` and `FAL`
- `Proposal`: evolve it incrementally into a monetizable, automation-first product with a predefined outcome

## What This Project Is Not

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

- Frontend SPA only
- Provider abstraction already exists
- Prompt-first playground UX still exists
- Provider keys are currently entered in the browser
- No backend, no auth, no billing, no database, no object storage, no job queue
- Tests and production build pass locally

### Current Strengths

- clean provider routing boundary
- small codebase with low coordination overhead
- test coverage around state, validation, and routing
- existing image upload and result preview flow

### Current Constraints

- provider keys currently exposed to the browser
- user-facing flow is built for experimentation, not purchase conversion
- no production asset lifecycle
- no separation yet between product mode and internal playground mode

## Customer Mode vs Internal Mode

### Customer Product Mode

- one upload
- one predefined task choice
- optional simple business-language fields only
- automatic processing
- preview
- paid delivery

### Internal/Admin/Playground Mode

- raw prompts allowed
- provider comparison allowed
- debugging tools allowed
- not the primary user path

## Non-Goals

- broad prompt engineering product for customers
- many-model exploration UI for customers
- general-purpose creative studio
- early marketplace integrations
- batch pipelines before the single-photo paid path works
- full rewrite before validating the first paid workflow
