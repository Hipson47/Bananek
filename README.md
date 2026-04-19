# Nano Banana Playground

Private single-user playground for rapid Gemini image-model testing, built as a front-end-first Vite + React + TypeScript app.

## Run locally

1. `npm install`
2. `npm run dev`
3. Open the local Vite URL shown in the terminal

## Current provider boundary

- The UI, registry, and contracts are final MVP structure.
- The active provider is a mock adapter in `src/lib/provider/mockNanoBananaAdapter.ts`.
- Replace `createProviderAdapter()` in `src/lib/provider/createProviderAdapter.ts` when real Gemini wiring is ready.
- The generate flow requires an API key in the visible input field and passes that key into the adapter request.

## Notes

- The app intentionally exposes one raw prompt textarea only.
- Result actions are limited to `Download` and `Use as reference`.
- Visible aspect-ratio options match the playground reference set.
- Visible resolution options are `Default`, `0.5K`, `1K`, `2K`, and `4K`.
- For local error-state checks, the mock adapter recognizes these prompt tokens:
  - `::network-error`
  - `::provider-error`
  - `::malformed`
  - `::empty`
