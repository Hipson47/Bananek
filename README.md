# Product Photo Enhancer

Runnable product-photo enhancement slice for an automation-first e-commerce workflow.

## What Exists Today

- `src/` contains the active Vite + React + TypeScript customer flow
- `backend/` contains a Node.js + Hono + TypeScript API with:
  - `GET /api/health`
  - `POST /api/enhance`
- the active enhancement path is:
  - upload one image
  - choose one preset
  - call `BackendProcessor`
  - send the image to `/api/enhance`
  - render the processed result
- Vite proxies `/api/*` to the backend in local development
- the backend currently uses a mock processor that returns the original bytes with truthful metadata

## Current Product Flow

The app is a narrow customer-mode slice, not a prompt playground. It supports:

1. upload one product photo
2. choose one predefined enhancement preset
3. process through the backend
4. compare original vs processed output

This keeps the product aligned with the intended customer experience:

- no prompts
- no provider choice
- no API keys in the browser
- no model terminology in the primary UX

## What Is Not Implemented Yet

- real image processing in the backend
- AI-provider integration behind the backend seam
- auth, billing, credits, storage, jobs, or delivery controls
- production deployment infrastructure

## Run

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

## Verify

In this WSL environment, tests need `TMPDIR=/tmp`.

```bash
TMPDIR=/tmp npm test
TMPDIR=/tmp npm --prefix backend test
npm run build
```

## Phase Status

- Phase 1 backend proxy and frontend wiring: complete
- Current hardening milestone: complete after this cleanup pass
- Next milestone: replace the backend mock processor with real processing, most likely `sharp` first, with AI-provider integration later behind the same backend boundary

## Repo Guide

- agent contract: [AGENTS.md](/mnt/c/Users/marci/Pictures/bananek/AGENTS.md:1)
- docs index: [docs/README.md](/mnt/c/Users/marci/Pictures/bananek/docs/README.md:1)
- current repo/product summary: [docs/project-overview.md](/mnt/c/Users/marci/Pictures/bananek/docs/project-overview.md:1)
- current execution snapshot: [docs/progress/current-status.md](/mnt/c/Users/marci/Pictures/bananek/docs/progress/current-status.md:1)
