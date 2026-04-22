# Decision Log

## Usage Note

These decisions record accepted direction and constraints.

They do **not** prove implementation status in the current filesystem snapshot. When a decision is accepted but not yet implemented, current-state docs must still label it as planned or target state.

## DEC-001

- Date: 2026-04-19
- Title: Default product direction
- Status: accepted
- Context: the repo started as a frontend playground and needed a monetizable product direction
- Decision: default direction is automation-first product photo enhancement for e-commerce sellers
- Consequences:
  - customer-facing prompts are out of scope
  - product mode and internal playground mode must remain separate
  - provider orchestration should stay internal
- Related docs:
  - `docs/project-overview.md`
  - `docs/product-definition.md`

## DEC-002

- Date: 2026-04-19
- Title: Source-of-truth discipline
- Status: accepted
- Context: multiple docs and repo artifacts can drift over time
- Decision: explicit user instruction, code, tests, and config outrank planning documents
- Consequences:
  - contradictions must be called out explicitly
  - strategy report is planning support, not executable truth
- Related docs:
  - `docs/source-of-truth-rules.md`

## DEC-003

- Date: 2026-04-19
- Title: Customer mode vs internal mode separation
- Status: accepted
- Context: the repo contains useful playground capabilities, but the intended product is automation-first and no-prompt
- Decision: retain the concept of internal playground mode, but do not expose it as the default customer experience
- Consequences:
  - customer UX must not expose prompts, provider choice, or model settings
  - implementation work should preserve a clean separation of concerns
- Related docs:
  - `AGENTS.md`
  - `docs/project-overview.md`
  - `docs/architecture-overview.md`

## DEC-004

- Date: 2026-04-20
- Title: Reference images cross client/server boundary as data URLs
- Status: **superseded** — the playground proxy architecture (RoutingAdapter, GenerateRequest, blob:/data: URLs) was never built. The product pivoted to preset-based enhancement with multipart file uploads via `/api/enhance`. See DEC-012, DEC-013.
- Context: the playground UI holds reference images as browser-local `blob:` URLs created via `URL.createObjectURL()`. A backend proxy cannot resolve `blob:` URLs. Both existing provider adapters (`GeminiAdapter.urlToBase64`, `FalAdapter.toDataUrl`) already short-circuit on `data:` URL input, so no adapter logic changes are needed if references arrive as `data:` URLs.
- Decision: the frontend converts `blob:` references to `data:` URLs before sending them to `POST /api/generate`. The backend never accepts or attempts to resolve `blob:` URLs.
- Consequences:
  - frontend `BackendAdapter` must serialize references before the request
  - backend validation must reject any reference whose `dataUrl` does not start with `data:`
  - payload sizes increase ~33% due to base64 encoding — requires explicit size limits (see DEC-010)
  - no changes to adapter request-building or response-parsing logic
- Related docs:
  - `docs/specs/phase1-backend-proxy.md` §8, §9, Appendix C

## DEC-005

- Date: 2026-04-20
- Title: Backend must never rely on browser-local blob references
- Status: **superseded** — same as DEC-004. The backend accepts multipart file uploads, not data: URL payloads. The spirit (no browser-local references) is preserved but the mechanism is different.
- Context: `blob:` URLs are scoped to the browser process that created them. They are not network-resolvable and would silently fail or error on the server.
- Decision: the backend treats `blob:`, `file:`, and any non-`data:` reference URL as invalid input and rejects the request with a 400 validation error.
- Consequences:
  - backend validation explicitly checks `dataUrl.startsWith("data:")`
  - this rule applies in both Phase 1 (playground proxy) and all future phases
  - future phases that introduce server-side storage (S3/R2) may accept storage-key references, but never browser-local URLs
- Related docs:
  - `docs/specs/phase1-backend-proxy.md` §9
  - `docs/security-and-risk-rules.md`

## DEC-006

- Date: 2026-04-20
- Title: Client sends modelId only; backend resolves model metadata
- Status: **superseded** — the model registry / VisibleModelId / GenerateRequest architecture was never built. The product uses preset IDs (`clean-background`, `marketplace-ready`, `studio-polish`), not model IDs. Processor selection is server-side via the `PROCESSOR` env var. See DEC-012, DEC-013.
- Context: the current frontend sends the full `ModelOption` object (including `provider`, `providerModelId`, capability arrays) as part of the `GenerateRequest`. If this were passed through to the backend, a malicious or buggy client could spoof provider routing, override capability limits, or inject arbitrary provider model IDs.
- Decision: the client sends `modelId` (a `VisibleModelId` string, e.g. `"nano-banana-2-fast"`). The backend resolves the full `ModelOption` from its own copy of the model registry. Unknown `modelId` values are rejected with 400.
- Consequences:
  - the backend owns the model registry as a security boundary — the client cannot override provider, capabilities, or internal model IDs
  - the model registry must be kept in sync between frontend (for UI rendering) and backend (for validation + dispatch)
  - the `GenerateRequestBody` wire format differs from the internal `GenerateRequest` (which still uses full `ModelOption`)
- Related docs:
  - `docs/specs/phase1-backend-proxy.md` §8, Appendix B

## DEC-007

- Date: 2026-04-20
- Title: Ported adapters preserve request/response logic; only file-reading helpers change
- Status: **superseded** — GeminiAdapter and FalAdapter were never ported to the backend. The backend has purpose-built processors (`sharp-processor.ts`, `fal-processor.ts`, `mock-processor.ts`) behind an orchestration layer. See DEC-012, DEC-013.
- Context: `GeminiAdapter` and `FalAdapter` contain two categories of code: (1) provider-specific request building, response parsing, and error handling — pure `fetch()` + JSON logic that works identically in Node.js; (2) browser-specific file-reading helpers (`FileReader` / `Blob` API) used to convert reference image URLs to base64.
- Decision: port both adapters to the backend with zero changes to category (1). Replace category (2) with Node.js `Buffer`-based equivalents: `Buffer.from(await res.arrayBuffer()).toString("base64")`.
- Consequences:
  - adapter behavior is identical to current browser behavior — no regressions in request format, response parsing, or error semantics
  - existing routing tests can be ported to backend with minimal changes (mock `fetch`, same assertions)
  - the `AppError` throw convention (`{ kind, message }`) is preserved
- Related docs:
  - `docs/specs/phase1-backend-proxy.md` §5, Appendix D

## DEC-008

- Date: 2026-04-20
- Title: GenerateResponse contract remains unchanged
- Status: **superseded** — `GenerateResponse` type does not exist in the current codebase. The `/api/enhance` endpoint returns `ProcessedImageResult` with a signed `processedUrl` served from `/api/outputs/:outputId`. See DEC-012, DEC-013.
- Context: the current `GenerateResponse` type (`{ createdAt, filename, imageUrl, mimeType, sourceModelLabel }`) is produced by both adapters and consumed by the frontend `ResultPanel`. Gemini returns `imageUrl` as a `data:` URL; FAL returns it as an `https://fal.media/...` URL.
- Decision: the backend returns the same `GenerateResponse` shape. No transformation, wrapping, or field additions in Phase 1.
- Consequences:
  - the frontend result rendering path (`ResultPanel`, `handleDownload`, `handleUseAsReference`) requires zero changes
  - FAL `https:` URLs remain directly accessible from the browser (FAL serves permissive CORS headers)
  - Gemini `data:` URLs are passed through the backend response body as-is
  - future phases may add fields (e.g. `jobId`, `storageKey`) but Phase 1 does not
- Related docs:
  - `docs/specs/phase1-backend-proxy.md` §8

## DEC-009

- Date: 2026-04-20
- Title: Backend stack for Phase 1 is Node.js + Hono + TypeScript
- Status: accepted
- Context: the strategy report recommended FastAPI (Python). However, all existing provider adapters, contracts, types, model registry, and validation logic are TypeScript. Porting to Python would require a full rewrite. Node.js allows moving these files server-side with only file-reading helper changes (DEC-007).
- Decision: Phase 1 backend uses Node.js 20 LTS, Hono framework, TypeScript, tsx for dev, Vitest for tests. No Python.
- Consequences:
  - single-language stack — one `tsconfig` convention, one test runner, shared type definitions
  - adapters port with minimal delta (Appendix D of spec)
  - future phases may introduce Python for image processing if needed, but the orchestration layer stays TypeScript
  - overrides the FastAPI recommendation in `docs/product-strategy-report.md` — that document is a planning artifact (DEC-002)
- Related docs:
  - `docs/specs/phase1-backend-proxy.md` §6
  - `docs/architecture-recommendation.md` §2.1

## DEC-010

- Date: 2026-04-20
- Title: Phase 1 enforces payload-size limits for data URL references
- Status: accepted
- Context: reference images are sent as base64-encoded `data:` URLs in the JSON request body. Base64 inflates size ~33%. Without limits, a client could send arbitrarily large payloads, exhausting server memory or causing timeouts. The current model registry allows up to 6 references (`nano-banana-pro`).
- Decision: Phase 1 enforces these limits:
  - per-reference maximum: 10 MB decoded (≈13.3 MB base64-encoded)
  - maximum references per request: governed by `model.maxReferences` (already validated, max 6)
  - total request body limit: 50 MB (Hono body-size middleware)
  - backend validation rejects references exceeding per-reference limit with a 400 error
- Consequences:
  - prevents memory exhaustion from oversized uploads
  - error message is clear: "Reference image exceeds the 10 MB size limit."
  - the 50 MB body limit is a backstop; per-reference validation catches most cases earlier
  - future phases with S3 presigned uploads will not have this constraint
- Related docs:
  - `docs/specs/phase1-backend-proxy.md` §8, §9

## DEC-011

- Date: 2026-04-20
- Title: Documentation truth model
- Status: accepted
- Context: the repository contains valuable planning docs, but the current filesystem snapshot does not contain the expected application source tree. Several documents were describing planned or historical implementation details as if they were present now.
- Decision: documentation must explicitly separate `Current State`, `Target State`, and `Historical / Planning` content. Filesystem reality outranks planning documents for present-tense claims.
- Consequences:
  - root README and current-status docs must describe the repository snapshot truthfully
  - architecture specs and recommendations may remain, but must be read as planned or historical unless backed by the filesystem
  - future agents must reconcile contradictions instead of silently preserving them
- Related docs:
  - `README.md`
  - `AGENTS.md`
  - `docs/README.md`
  - `docs/07-meta/source-of-truth-rules.md`

## DEC-012

- Date: 2026-04-21
- Title: Phase 2 real processing uses sharp (libvips); output MIME preserved from input
- Status: accepted
- Context: the mock processor proved the HTTP pipeline but returned images unchanged. Real image processing was needed for the three presets (clean-background, marketplace-ready, studio-polish).
- Decision: Phase 2 uses the `sharp` library (libvips) for deterministic image transforms. Output MIME type is always preserved from input (JPEG in → JPEG out). Each preset has specific canvas size, fit mode, and transform pipeline.
- Consequences:
  - sharp is a native dependency requiring platform-specific binaries
  - no API keys or external services needed for the default processing path
  - preset-specific transform parameters are hard-coded in `sharp-processor.ts`
  - supersedes DEC-004 through DEC-008 which described a different architecture
- Related docs:
  - `backend/src/processors/sharp-processor.ts`
  - `docs/03-progress/current-status.md` (Sharp processor preset mapping)

## DEC-013

- Date: 2026-04-21
- Title: Phase 3 AI processing uses FAL.ai; preset prompts hidden from frontend
- Status: accepted
- Context: some enhancement presets benefit from AI capabilities (true background removal, intelligent relighting). FAL.ai provides hosted inference for background-removal and FLUX Kontext image-to-image models.
- Decision: Phase 3 adds a FAL.ai processor behind the same `/api/enhance` contract. Prompt construction is deterministic, preset-driven, and internal-only — the frontend never sees model names or prompts. `PROCESSOR` env var selects between `sharp` (default), `fal`, and `mock`.
- Consequences:
  - FAL.ai is a paid service; requests cost credits (billing not yet implemented)
  - FAL output is post-processed through sharp for format/size normalization
  - `PROCESSOR_FAILURE_POLICY` controls whether FAL failures fall back to sharp or fail hard
  - CDN host allowlist (`FAL_ALLOWED_HOST_SUFFIXES`) validates provider URLs
- Related docs:
  - `backend/src/processors/fal-processor.ts`
  - `backend/src/orchestration/prompt-builder.ts`
  - `docs/03-progress/working-memory.md`
