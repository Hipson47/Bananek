# Nano Banana Playground

Private single-user playground for rapid image-model testing, built as a front-end-first Vite + React + TypeScript app.

## Run locally

1. `npm install`
2. `npm run dev`
3. Open the local Vite URL shown in the terminal

## Current product scope

- Single-screen playground for fast `txt>img` and `img>img` iteration
- Two supported providers in the current codebase:
  - `Google Gemini`
  - `FAL`
- Current visible model list in the UI:
  - `Nano Banana 2 — Fast`
  - `Nano Banana 2 — Thinking`
  - `Nano Banana Pro`
  - `Nano Banana FAL — Fast`
  - `Nano Banana FAL — Quality`
- Result actions remain intentionally small:
  - `Download`
  - `Use as reference`

## Current provider boundary

- The UI depends on a normalized internal request/response contract, not provider-specific payloads.
- `src/lib/modelRegistry.ts` holds the user-facing model list, capabilities, and provider mapping.
- `src/lib/provider/createProviderAdapter.ts` routes requests to the correct provider adapter.
- Real provider adapters currently exist for:
  - `src/lib/provider/geminiAdapter.ts`
  - `src/lib/provider/falAdapter.ts`
- `src/lib/provider/mockNanoBananaAdapter.ts` remains useful for local playground behavior and error-state simulation, but it is not the active default route.
- The generate flow requires an API key in the visible input field and stores it locally per provider.

## Architecture summary

- `src/App.tsx`: top-level orchestration for UI, generation flow, and reducer-backed state updates
- `src/lib/state.ts`: initial state and reducer logic
- `src/lib/validation.ts`: normalized client-side validation
- `src/lib/provider/contracts.ts`: provider-agnostic request/response contract
- `src/lib/provider/*`: provider-specific API wiring
- `src/components/*`: small presentational building blocks

## Notes

- The app intentionally exposes one raw prompt textarea only.
- Result actions are limited to `Download` and `Use as reference`.
- Visible aspect-ratio options match the playground reference set.
- Visible resolution options are `Default`, `0.5K`, `1K`, `2K`, and `4K`.
- The original PRD was written for a narrower Google-only MVP. The current codebase has an approved broader multi-provider scope.
- For local error-state checks, the mock adapter recognizes these prompt tokens:
  - `::network-error`
  - `::provider-error`
  - `::malformed`
  - `::empty`
