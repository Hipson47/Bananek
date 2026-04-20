# Product Photo Enhancer

Thin runnable Vite + React + TypeScript slice for an automation-first AI product photo enhancement app.

## What Exists Today

- a real `src/` application tree
- a one-page frontend flow for:
  - uploading one image
  - choosing one enhancement preset
  - running a processing step
  - viewing original vs processed output
- a mock but replaceable image-processing seam built around `ImageProcessor`
- frontend tooling via Vite, React, TypeScript, and Vitest

## What This Slice Does

The current app is a **frontend-first product slice**, not the full platform. It gives a user:

1. a landing view with product framing
2. image upload with basic validation
3. three commerce-oriented presets:
   - `Clean Background`
   - `Marketplace Ready`
   - `Studio Polish`
4. async processing with loading, success, and error states
5. a comparison result view showing original and processed output

Processing is currently implemented by a mock local pipeline that uses browser-side canvas transforms. It is intentionally structured to be replaced later by a real backend/provider integration.

## What Is Not Implemented Yet

- backend provider proxy
- real AI processing
- auth, billing, credits, storage, or jobs
- customer product mode vs internal mode split in routing
- production deployment infrastructure

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
```

## Repo Guide

- agent contract: [AGENTS.md](/mnt/c/Users/marci/Pictures/bananek/AGENTS.md:1)
- docs index: [docs/README.md](/mnt/c/Users/marci/Pictures/bananek/docs/README.md:1)
- current repo/product summary: [docs/project-overview.md](/mnt/c/Users/marci/Pictures/bananek/docs/project-overview.md:1)
- current execution snapshot: [docs/progress/current-status.md](/mnt/c/Users/marci/Pictures/bananek/docs/progress/current-status.md:1)

## Next Recommended Slice

Implement the approved Phase 1 backend proxy:

- move provider keys server-side
- add `/health` and `/api/generate`
- replace the mock processor with a backend-backed adapter seam
