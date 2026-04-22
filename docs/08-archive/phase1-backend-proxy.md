# Phase 1 Spec: Secure Backend Provider Proxy

Status: **completed and now historical reference**
Owner: Architecture Agent → Backend Agent

## Document Status

- `Historical / Reference`: this spec described Phase 1 before implementation
- `Implemented`: the repository now has an active backend in `backend/` and the frontend is wired to it
- `Current Next Step`: real processing behind `POST /api/enhance`

---

## 1. Objective

This objective has been completed for the current customer-mode repo shape: the browser/backend seam now exists and the frontend enhancement path goes through the backend.

The next milestone is not another backend proxy pass. It is replacing the mock processor behind `POST /api/enhance` with real processing.

## 2. In Scope

- Backend HTTP server that accepts a generation request and proxies it to the correct provider `[PR]`
- Server-side storage of provider API keys via environment variables `[PR]`
- Port of existing `GeminiAdapter`, `FalAdapter`, and `RoutingAdapter` to the backend — same TypeScript, same logic `[PR]`
- A single new frontend adapter (`BackendAdapter`) that replaces direct provider calls with `fetch("/api/generate", ...)` `[PR]`
- Removal of the API key field from the playground UI `[PR]`
- Removal of `localStorage` API key persistence logic `[PR]`
- Vite dev proxy from `/api` to the backend `[PR]`
- Deletion of `mockNanoBananaAdapter.ts` (dead code) `[PR]`
- Backend validation that mirrors the existing frontend validation rules `[PR]`
- Backend error responses that map to the existing `AppError` shape `[PR]`
- Tests for backend routing, adapter dispatch, error mapping, and the new frontend adapter `[PR]`

## 3. Out of Scope

- Auth, sessions, user accounts
- Billing, credits, Stripe
- Database, migrations, ORM
- Object storage (S3/R2)
- Async job queue (BullMQ)
- Customer product mode (enhancement presets, no-prompt UX)
- Frontend UI redesign
- New providers or models
- Docker / deployment config (dev-only for now)
- Rate limiting beyond basic sanity (can be `[AS]` a simple in-memory counter for dev)

## 4. Current Verified Facts

### Provider contracts `[VF]`

```typescript
// src/lib/provider/contracts.ts — 26 lines, unchanged since init
type GenerateRequest = {
  apiKey: string;              // ← will be stripped from frontend, injected by backend
  aspectRatio: AspectRatioId;
  mode: "txt>img" | "img>img";
  model: ModelOption;          // full model object including provider, providerModelId, capabilities
  prompt: string;
  quality: QualityId;
  references: ReferenceImage[];  // ← currently blob: URLs, must become data: URLs for backend
  resolution: ResolutionId;
};

type GenerateResponse = {
  createdAt: number;
  filename: string;
  imageUrl: string;   // Gemini: data: URL (base64). FAL: https: URL.
  mimeType: string;
  sourceModelLabel: string;
};
```

### Provider adapters `[VF]`

- `GeminiAdapter`: calls `https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent`. Auth via `x-goog-api-key` header. Returns base64 inline data. References converted via `urlToBase64()` which already handles `data:` URLs.
- `FalAdapter`: calls `https://fal.run/{modelId}`. Auth via `Authorization: Key {apiKey}` header. Returns `https://fal.media/...` URL. References converted via `toDataUrl()` which already handles `data:` URLs. img2img uses `model.providerImg2ImgModelId`.
- `RoutingAdapter`: switches on `request.model.provider` (`"google"` | `"fal"`), exhaustive check.
- Both adapters throw `AppError` objects: `{ kind: "validation"|"provider"|"network"|"malformed"|"empty", message: string }`.

### Reference image handling `[VF]`

- Upload: `URL.createObjectURL(file)` → `blob:` URL stored as `reference.previewUrl`
- Generated (use-as-reference): result `imageUrl` stored as `reference.previewUrl` — already `data:` URL (Gemini) or `https:` URL (FAL)
- Adapters: both convert `previewUrl` to base64/data URL internally. Both short-circuit if input is already `data:`.
- **Key fact**: `blob:` URLs are browser-local. The backend cannot resolve them. The frontend must convert `blob:` to `data:` before sending to `/api/generate`.

### Validation `[VF]`

`validatePlaygroundState()` checks (in order):
1. `apiKey` not blank — **will be removed** (keys are server-side)
2. `prompt` not blank
3. `img>img` mode: model.maxReferences > 0
4. `img>img` mode: references.length > 0
5. references.length ≤ model.maxReferences
6. aspectRatio in model.supportedAspectRatios
7. resolution in model.supportedResolutions
8. quality in model.supportedQualities
9. all reference mimeTypes in model.supportedMimeTypes

### State management `[VF]`

- `PlaygroundState` includes `apiKey: string` — **will be removed from state**
- `getStoredApiKey(provider)` / `persistApiKey(apiKey, provider)` — **will be removed**
- `createInitialState()` reads `apiKey` from localStorage — **will be simplified**
- `playgroundReducer` handles 7 action types; none need changes except removing apiKey from `sync_state` payloads

### Test inventory `[VF]`

| File | Tests | What it covers |
|---|---|---|
| `state.test.ts` | 6 | `getStoredApiKey` (4), `persistApiKey` (2) — **all 6 become obsolete** |
| `validation.test.ts` | 5 | valid state (1), empty apiKey (1), empty prompt (1), img2img no-support (1), img2img no-refs (1) — **apiKey test becomes obsolete, 4 remain** |
| `routing.test.ts` | 4 | google dispatch (1), fal dispatch (1), fal auth header (1), google auth header (1) — **all 4 move to backend** |

### Model registry `[VF]`

5 models defined. The `ModelOption` type includes `provider: ProviderName` which drives routing. The registry is the source of truth for model capabilities. **The full registry is needed on both frontend (for UI rendering) and backend (for validation + adapter dispatch).**

### Working tree status `[Historical]`

This warning is historical. The current repo state includes a working `src/` tree and implemented backend.

## 5. Architecture Delta

### Before (current)

```
Browser                          External APIs
┌────────────────────┐           ┌──────────┐
│ App.tsx            │           │ Gemini   │
│  └─ RoutingAdapter │──fetch──▶│ FAL      │
│      apiKey in req │           └──────────┘
│      blob: refs    │
└────────────────────┘
```

### After (Phase 1)

```
Browser                          Backend (localhost:3001)        External APIs
┌────────────────────┐           ┌──────────────────────┐       ┌──────────┐
│ App.tsx            │           │ POST /api/generate   │       │ Gemini   │
│  └─ BackendAdapter │──fetch──▶│  ├─ validate request │──────▶│ FAL      │
│      NO apiKey     │           │  ├─ inject apiKey    │       └──────────┘
│      data: refs    │           │  └─ RoutingAdapter   │
└────────────────────┘           │      (ported TS)     │
         ▲                       └──────────────────────┘
         │ Vite proxy /api → :3001
```

### What moves

| Component | From | To | Changes |
|---|---|---|---|
| `RoutingAdapter` | `src/lib/provider/createProviderAdapter.ts` | `backend/src/providers/routing-adapter.ts` | None — exact same class |
| `GeminiAdapter` | `src/lib/provider/geminiAdapter.ts` | `backend/src/providers/gemini-adapter.ts` | Replace `FileReader` base64 conversion with `Buffer.from().toString("base64")` |
| `FalAdapter` | `src/lib/provider/falAdapter.ts` | `backend/src/providers/fal-adapter.ts` | Replace `FileReader` data URL conversion with Buffer equivalent |
| `contracts.ts` | `src/lib/provider/contracts.ts` | `backend/src/providers/contracts.ts` | Remove `apiKey` from `GenerateRequest` |
| `providerAdapter.ts` | `src/lib/provider/providerAdapter.ts` | `backend/src/providers/provider-adapter.ts` | None |
| `types.ts` (subset) | `src/lib/types.ts` | `backend/src/shared-types.ts` | Only model/settings/error types. No UI state types. |
| `modelRegistry.ts` | `src/lib/modelRegistry.ts` | `backend/src/model-registry.ts` | Exact copy |

### What stays on frontend (modified)

| Component | Change |
|---|---|
| `types.ts` | Remove `apiKey` from `PlaygroundState` |
| `state.ts` | Remove `getStoredApiKey`, `persistApiKey`, `LEGACY_API_KEY`, apiKey from `createInitialState` |
| `validation.ts` | Remove apiKey check |
| `App.tsx` | Remove API key field, `handleApiKeyChange`, `showApiKey` state, apiKey in `handleGenerate` |
| `createProviderAdapter.ts` | Replace `RoutingAdapter` with `BackendAdapter` |

### What gets deleted

| File | Reason |
|---|---|
| `mockNanoBananaAdapter.ts` | Dead code, never imported by production code |
| `geminiAdapter.ts` (frontend copy) | Logic moves to backend |
| `falAdapter.ts` (frontend copy) | Logic moves to backend |

## 6. Backend File Plan

```
backend/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                        ← entry: Hono app, CORS, mount routes
│   ├── config.ts                       ← env var loader (GEMINI_API_KEY, FAL_API_KEY, PORT, ALLOWED_ORIGINS)
│   ├── shared-types.ts                 ← subset of frontend types.ts (ModelOption, AspectRatioId, etc.)
│   ├── model-registry.ts              ← exact copy of frontend modelRegistry.ts
│   ├── providers/
│   │   ├── contracts.ts               ← GenerateRequest (sans apiKey), GenerateResponse
│   │   ├── provider-adapter.ts        ← ProviderAdapter interface
│   │   ├── gemini-adapter.ts          ← ported GeminiAdapter (Node-native fetch + Buffer)
│   │   ├── fal-adapter.ts             ← ported FalAdapter (Node-native fetch + Buffer)
│   │   └── routing-adapter.ts         ← ported RoutingAdapter
│   ├── routes/
│   │   └── generate.ts                ← POST /api/generate handler
│   └── validation.ts                  ← server-side request validation
└── tests/
    ├── generate-route.test.ts         ← route-level tests (happy path, validation, errors)
    ├── gemini-adapter.test.ts         ← ported + adapted from routing.test.ts
    ├── fal-adapter.test.ts            ← ported + adapted from routing.test.ts
    └── validation.test.ts             ← server-side validation tests
```

### Dependencies (backend/package.json)

```json
{
  "name": "nano-banana-backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x"
  },
  "devDependencies": {
    "tsx": "^4.x",
    "typescript": "^5.6.3",
    "vitest": "^4.1.4",
    "@types/node": "^20.x"
  }
}
```

Rationale for each dependency:
- `hono`: lightweight HTTP framework, typed, zero-config CORS middleware, runs on Node without adapter boilerplate
- `@hono/node-server`: serves Hono on plain Node.js http module
- `tsx`: run TypeScript directly in dev without a build step
- `vitest`: same test runner as frontend, consistent tooling

No unnecessary dependencies. No ORM, no Redis, no S3 SDK. Those come in later phases.

## 7. Frontend File Plan

### New files

| File | Purpose |
|---|---|
| `src/lib/provider/backendAdapter.ts` | `BackendAdapter` class implementing `ProviderAdapter` — calls `POST /api/generate` |

### Modified files

| File | Changes |
|---|---|
| `src/lib/types.ts` | Remove `apiKey` from `PlaygroundState`. Remove `apiKey`-related action if any. |
| `src/lib/state.ts` | Remove `getStoredApiKey`, `persistApiKey`, `LEGACY_API_KEY`, `providerStorageKey`. Remove `apiKey` from `createInitialState`. |
| `src/lib/validation.ts` | Remove `apiKey` check (first rule). |
| `src/lib/provider/createProviderAdapter.ts` | Import and return `BackendAdapter` instead of `RoutingAdapter`. Remove Gemini/FAL imports. |
| `src/App.tsx` | Remove: `showApiKey` state, `handleApiKeyChange`, API key `<Field>` block, `apiKey` from `handleGenerate` call, `apiKey` from `persistApiKey` effect, `getStoredApiKey` import. Add: reference pre-serialization before generate (convert `blob:` → `data:`). |
| `vite.config.ts` | Add `server.proxy: { "/api": "http://localhost:3001" }` |

### Deleted files

| File | Reason |
|---|---|
| `src/lib/provider/geminiAdapter.ts` | Moved to backend |
| `src/lib/provider/falAdapter.ts` | Moved to backend |
| `src/lib/provider/mockNanoBananaAdapter.ts` | Dead code |

## 8. API Contract: POST /api/generate

### Request

```typescript
// Content-Type: application/json
// Max body size: 50 MB (to accommodate base64 reference images)

interface GenerateRequestBody {
  mode: "txt>img" | "img>img";
  modelId: VisibleModelId;         // "nano-banana-2-fast" etc. — NOT the full ModelOption object
  prompt: string;
  aspectRatio: AspectRatioId;
  resolution: ResolutionId;
  quality: QualityId;
  references: Array<{
    mimeType: string;
    dataUrl: string;               // data:image/png;base64,... — NOT blob: URLs
  }>;
}
```

Design decisions:
- **`modelId` not full `ModelOption`**: the client sends a model ID string. The backend resolves it via its own `modelRegistry` copy. This prevents the client from spoofing model capabilities or provider details.
- **`references[].dataUrl`**: the frontend converts `blob:` URLs to `data:` URLs before sending. The backend adapters already handle `data:` URL input. This avoids multipart uploads for Phase 1.
- **No `apiKey` field**: the backend injects keys from env vars based on `model.provider`.
- **50 MB body limit**: base64 encoding inflates image size ~33%. 4 reference images at ~8 MB each = ~42 MB worst case. Generous limit for playground use.

### Payload-Size Enforcement (DEC-010)

Three layers of protection, enforced in order:

**Layer 1 — Hono body-size middleware (backstop)**
- Reject any request body > 50 MB before JSON parsing
- HTTP 413 Payload Too Large
- Prevents memory exhaustion from arbitrarily large payloads

```typescript
// backend/src/index.ts
import { bodyLimit } from "hono/body-limit";
app.use("/api/*", bodyLimit({ maxSize: 50 * 1024 * 1024 }));  // 50 MB
```

**Layer 2 — Per-reference size validation (in `validateGenerateRequest`)**
- Each `references[].dataUrl` is checked: decoded base64 size must not exceed 10 MB
- Size is estimated from the base64 portion: `Math.ceil(base64String.length * 3 / 4)` (avoids decoding the full buffer just to measure)
- Rejection: 400 `{ kind: "validation", message: "Reference image exceeds the 10 MB size limit." }`

```typescript
// backend/src/validation.ts — added to validation function
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024; // 10 MB decoded

for (const ref of body.references ?? []) {
  if (!ref.dataUrl?.startsWith("data:"))
    return { kind: "validation", message: "Reference images must be provided as data: URLs." };

  const commaIndex = ref.dataUrl.indexOf(",");
  if (commaIndex === -1)
    return { kind: "validation", message: "Malformed data URL in reference image." };

  const base64Part = ref.dataUrl.slice(commaIndex + 1);
  const estimatedBytes = Math.ceil(base64Part.length * 3 / 4);
  if (estimatedBytes > MAX_REFERENCE_BYTES)
    return { kind: "validation", message: "Reference image exceeds the 10 MB size limit." };
}
```

**Layer 3 — Reference count validation (existing)**
- `references.length` must not exceed `model.maxReferences` (already validated, max value is 6 for `nano-banana-pro`)
- Combined with Layer 2: worst case = 6 × 10 MB × 1.33 ≈ 80 MB base64, caught by Layer 1 backstop at 50 MB
- This means effective max per-reference at 6 refs is ~6.25 MB decoded, which is more than enough for playground use

**Worst-case analysis:**

| Model | maxReferences | Max decoded per ref | Max base64 total | Within 50 MB body? |
|---|---|---|---|---|
| nano-banana-pro | 6 | 10 MB | ~80 MB | No — Layer 1 catches at 50 MB, effective ~6.2 MB/ref |
| nano-banana-2-fast/thinking | 4 | 10 MB | ~53 MB | Borderline — Layer 1 catches |
| nano-banana-fal-quality | 4 | 10 MB | ~53 MB | Borderline — Layer 1 catches |
| nano-banana-fal-fast | 0 | n/a | 0 | Always OK |

For Phase 1 (internal playground), this is acceptable. The 50 MB body limit naturally constrains effective per-reference size when multiple references are used. Future phases with S3 presigned uploads remove this constraint entirely.

### Response — Success (200)

```typescript
interface GenerateResponseBody {
  createdAt: number;
  filename: string;
  imageUrl: string;          // data: URL (Gemini) or https: URL (FAL)
  mimeType: string;
  sourceModelLabel: string;
}
```

This is the existing `GenerateResponse` contract, passed through unchanged.

### Response — Validation Error (400)

```typescript
{
  "error": {
    "kind": "validation",
    "message": "Prompt is required."
  }
}
```

### Response — Provider Error (502)

```typescript
{
  "error": {
    "kind": "provider",    // or "network" | "malformed" | "empty"
    "message": "Gemini API error 429: Resource exhausted."
  }
}
```

### Response — Internal Error (500)

```typescript
{
  "error": {
    "kind": "provider",
    "message": "Internal server error."
  }
}
```

### Error mapping to HTTP status

| `AppError.kind` | HTTP status | Rationale |
|---|---|---|
| `validation` | 400 | Client sent bad data |
| `provider` | 502 | Upstream provider failed |
| `network` | 502 | Could not reach upstream |
| `malformed` | 502 | Upstream returned unparseable response |
| `empty` | 502 | Upstream returned no image |

## 9. Validation + Error Mapping Rules

### Backend validation (in `backend/src/validation.ts`)

Runs before any provider call. Mirrors frontend validation minus the apiKey check.

```typescript
function validateGenerateRequest(body: GenerateRequestBody): AppError | null {
  // 1. modelId must resolve in registry
  const model = tryGetModelOption(body.modelId);
  if (!model) return { kind: "validation", message: `Unknown model: ${body.modelId}` };

  // 2. prompt required
  if (!body.prompt?.trim()) return { kind: "validation", message: "Prompt is required." };

  // 3. img>img: model supports it
  if (body.mode === "img>img" && model.maxReferences === 0)
    return { kind: "validation", message: `${model.label} does not support image-to-image mode.` };

  // 4. img>img: at least one reference
  if (body.mode === "img>img" && (!body.references || body.references.length === 0))
    return { kind: "validation", message: "At least one reference image is required for img>img mode." };

  // 5. reference count ≤ max
  if ((body.references?.length ?? 0) > model.maxReferences)
    return { kind: "validation", message: `This model allows up to ${model.maxReferences} reference image${model.maxReferences === 1 ? "" : "s"}.` };

  // 6–8. setting compatibility
  if (!model.supportedAspectRatios.includes(body.aspectRatio))
    return { kind: "validation", message: "The selected aspect ratio is not supported." };
  if (!model.supportedResolutions.includes(body.resolution))
    return { kind: "validation", message: "The selected resolution is not supported." };
  if (!model.supportedQualities.includes(body.quality))
    return { kind: "validation", message: "The selected quality is not supported." };

  // 9. reference format, mime types, and size limits (DEC-004, DEC-005, DEC-010)
  const MAX_REFERENCE_BYTES = 10 * 1024 * 1024; // 10 MB decoded

  for (const ref of body.references ?? []) {
    // DEC-005: reject non-data: URLs
    if (!ref.dataUrl?.startsWith("data:"))
      return { kind: "validation", message: "Reference images must be provided as data: URLs." };

    // mime type check
    if (!model.supportedMimeTypes.includes(ref.mimeType))
      return { kind: "validation", message: `Unsupported reference type for ${model.label}: ${ref.mimeType}.` };

    // DEC-010: per-reference size limit
    const commaIndex = ref.dataUrl.indexOf(",");
    if (commaIndex === -1)
      return { kind: "validation", message: "Malformed data URL in reference image." };
    const base64Part = ref.dataUrl.slice(commaIndex + 1);
    const estimatedBytes = Math.ceil(base64Part.length * 3 / 4);
    if (estimatedBytes > MAX_REFERENCE_BYTES)
      return { kind: "validation", message: "Reference image exceeds the 10 MB size limit." };
  }

  return null;
}
```

### Error flow through the stack

```
Frontend BackendAdapter
  └─ fetch("/api/generate", { body })
       │
       ▼
Backend route handler
  ├─ validateGenerateRequest(body) → 400 { error: AppError }
  ├─ resolve model from registry
  ├─ inject apiKey from env
  ├─ build internal GenerateRequest
  ├─ routingAdapter.generate(request)
  │    ├─ adapter throws AppError → catch → 502 { error: AppError }
  │    └─ adapter returns GenerateResponse → 200 { ...response }
  └─ unexpected throw → 500 { error: { kind: "provider", message: "Internal server error." } }

Frontend BackendAdapter
  ├─ response.ok → parse JSON → return GenerateResponse
  └─ !response.ok → parse JSON → throw AppError from response body
```

### Frontend BackendAdapter error handling

```typescript
class BackendAdapter implements ProviderAdapter {
  async generate(request: FrontendGenerateRequest): Promise<GenerateResponse> {
    const body = serializeRequest(request);  // convert blob: refs to data: URLs, strip apiKey

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw errorBody?.error ?? { kind: "network", message: `Server error: ${response.status}` };
    }

    return response.json();
  }
}
```

The thrown error is an `AppError` — the existing `App.tsx` catch block already handles `AppError` via `isAppError()`. **No changes needed to error display logic.**

## 10. Test Migration Plan

### Tests that become obsolete (delete)

| Test | File | Reason |
|---|---|---|
| `getStoredApiKey` (4 tests) | `state.test.ts` | localStorage key persistence removed |
| `persistApiKey` (2 tests) | `state.test.ts` | localStorage key persistence removed |
| "fails when api key is empty" (1 test) | `validation.test.ts` | apiKey validation removed from frontend |

→ **Delete `state.test.ts` entirely.** All 6 tests test removed functionality.
→ **Remove 1 test from `validation.test.ts`.** 4 remain.

### Tests that move to backend

| Current test | Current file | Backend equivalent |
|---|---|---|
| "dispatches to google adapter" | `routing.test.ts` | `gemini-adapter.test.ts` — same mock, same assertion |
| "dispatches to fal adapter" | `routing.test.ts` | `fal-adapter.test.ts` — same mock, same assertion |
| "correct auth header for fal" | `routing.test.ts` | `fal-adapter.test.ts` — verify `Authorization: Key {env_key}` |
| "correct auth header for google" | `routing.test.ts` | `gemini-adapter.test.ts` — verify `x-goog-api-key: {env_key}` |

→ **Delete frontend `routing.test.ts`.** All 4 tests move to backend.

### New backend tests

| Test | File | What it verifies |
|---|---|---|
| returns 200 + GenerateResponse for valid google request | `generate-route.test.ts` | Happy path, Gemini |
| returns 200 + GenerateResponse for valid fal request | `generate-route.test.ts` | Happy path, FAL |
| returns 400 for missing prompt | `generate-route.test.ts` | Validation |
| returns 400 for unknown modelId | `generate-route.test.ts` | Validation |
| returns 400 for img>img with no references | `generate-route.test.ts` | Validation |
| returns 400 for unsupported aspect ratio | `generate-route.test.ts` | Validation |
| returns 400 for reference with non-data: URL | `generate-route.test.ts` | Security — reject blob:/http: references (DEC-005) |
| returns 400 for reference exceeding 10 MB size limit | `generate-route.test.ts` | Payload-size enforcement (DEC-010) |
| returns 400 for malformed data URL (no comma) | `generate-route.test.ts` | Payload-size enforcement (DEC-010) |
| returns 502 when provider returns error | `generate-route.test.ts` | Upstream failure |
| returns 502 when provider returns empty result | `generate-route.test.ts` | Empty output |
| injects correct Gemini key from env | `gemini-adapter.test.ts` | Key isolation |
| injects correct FAL key from env | `fal-adapter.test.ts` | Key isolation |
| routes google model to GeminiAdapter | `gemini-adapter.test.ts` | Routing |
| routes fal model to FalAdapter | `fal-adapter.test.ts` | Routing |

### New frontend tests

| Test | File | What it verifies |
|---|---|---|
| BackendAdapter calls /api/generate with correct body shape | `backendAdapter.test.ts` | Request serialization |
| BackendAdapter returns GenerateResponse on success | `backendAdapter.test.ts` | Response deserialization |
| BackendAdapter throws AppError on non-ok response | `backendAdapter.test.ts` | Error propagation |
| BackendAdapter converts blob: references to data: URLs | `backendAdapter.test.ts` | Reference serialization |

### Test count change

| Phase | Frontend tests | Backend tests | Total |
|---|---|---|---|
| Before | 15 (6 state + 5 validation + 4 routing) | 0 | 15 |
| After | 8 (4 validation + 4 backendAdapter) | 15 (11 route + 2 gemini + 2 fal) | 23 |

## 11. Rollout Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Working tree corruption blocks all work** | P0 blocker | Restore outside sandbox (re-clone + copy docs). This is a prerequisite. |
| **Reference images as base64 in JSON body → large payloads** | Medium | 50 MB body limit. 4 refs × 8 MB × 1.33 (base64 overhead) ≈ 42 MB max. Acceptable for playground; product mode (Phase 2+) will use S3 presigned uploads. |
| **`blob:` → `data:` conversion adds latency on frontend** | Low | Conversion is ~100ms per image (FileReader). Happens once before request. Acceptable. |
| **Gemini response is base64 data → large response body** | Medium | Already the case today (browser-direct). No change in payload size. Product mode will store results server-side. |
| **FAL response is an https URL → possible CORS issues for preview** | Low | Already works today: FAL URLs have permissive CORS. No change. |
| **Frontend tests break if working tree isn't clean** | Low | Restore working tree first. Run `npm test` before any code changes. |
| **Model registry drift between frontend and backend copies** | Medium | Phase 1: literal copy. Phase 2+: extract to shared package or generate from single source. For now, a comment in both files: `// SYNC: keep in sync with backend/src/model-registry.ts` |
| **Missing env var at startup → confusing runtime error** | Low | `config.ts` validates required env vars at startup and throws immediately with a clear message. |

## 12. Acceptance Criteria

Phase 1 is **done** when all of the following are true:

### Functional

1. `npm run dev` in frontend + `npm run dev` in backend starts the full stack locally.
2. The playground UI shows no API key field.
3. User can generate an image using any of the 5 existing models via the playground UI.
4. The browser network tab shows requests only to `/api/generate` — no direct calls to `generativelanguage.googleapis.com` or `fal.run`.
5. Provider API keys do not appear in any browser-visible request, response, localStorage, or source code.
6. `img>img` mode works: user uploads a reference, generates with it, result is displayed.
7. "Use as reference" works: generated result can be added as reference for next generation.
8. Error states display correctly: provider errors, empty results, and validation errors show the same user-visible messages as before.
9. Download still works for generated images.

### Security

10. `GEMINI_API_KEY` and `FAL_API_KEY` are read from `.env` / environment variables only.
11. Backend rejects requests with `references[].dataUrl` that are not `data:` URLs (no `blob:`, `http:`, `file:` URLs accepted). (DEC-005)
12. Backend returns 400 for invalid/unknown `modelId` values. (DEC-006)
13. `GET /health` returns 200.
14. Backend rejects references exceeding 10 MB decoded size with 400. (DEC-010)
15. Backend rejects requests with total body > 50 MB with 413. (DEC-010)

### Tests

16. All backend tests pass: `cd backend && npm test` (≥15 tests).
17. All frontend tests pass: `npm test` (≥8 tests).
18. TypeScript compiles clean: `npx tsc --noEmit` in both frontend and backend.

### Code quality

19. No `apiKey` field in `PlaygroundState` type.
20. No `localStorage` API key logic in `state.ts`.
21. No `geminiAdapter.ts` or `falAdapter.ts` in `src/lib/provider/`.
22. No `mockNanoBananaAdapter.ts` anywhere.
23. `backend/.env.example` exists with `GEMINI_API_KEY=`, `FAL_API_KEY=`, `PORT=3001`, `ALLOWED_ORIGINS=http://localhost:5173`.

---

## Appendix A: Backend `config.ts` Pattern

```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export const config = {
  geminiApiKey: requireEnv("GEMINI_API_KEY"),
  falApiKey: requireEnv("FAL_API_KEY"),
  port: parseInt(process.env.PORT ?? "3001", 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(","),
};
```

## Appendix B: Backend Route Handler Sketch

```typescript
// backend/src/routes/generate.ts
import { Hono } from "hono";
import { config } from "../config.js";
import { getModelOption } from "../model-registry.js";
import { createRoutingAdapter } from "../providers/routing-adapter.js";
import { validateGenerateRequest } from "../validation.js";
import type { AppError } from "../shared-types.js";

const router = new Hono();
const providerAdapter = createRoutingAdapter();

const apiKeyForProvider = (provider: "google" | "fal"): string => {
  return provider === "google" ? config.geminiApiKey : config.falApiKey;
};

router.post("/generate", async (c) => {
  const body = await c.req.json();

  const validationError = validateGenerateRequest(body);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  const model = getModelOption(body.modelId);
  const apiKey = apiKeyForProvider(model.provider);

  const references = (body.references ?? []).map((ref: { mimeType: string; dataUrl: string }) => ({
    id: `server-ref-${Date.now()}`,
    mimeType: ref.mimeType,
    name: "reference",
    previewUrl: ref.dataUrl,      // adapters handle data: URLs natively
    source: "upload" as const,
  }));

  try {
    const result = await providerAdapter.generate({
      apiKey,
      mode: body.mode,
      model,
      prompt: body.prompt.trim(),
      aspectRatio: body.aspectRatio,
      resolution: body.resolution,
      quality: body.quality,
      references,
    });

    return c.json(result, 200);
  } catch (err) {
    const appError = isAppError(err)
      ? err
      : { kind: "provider" as const, message: "Internal server error." };
    return c.json({ error: appError }, isAppError(err) ? 502 : 500);
  }
});

function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) return false;
  return "kind" in value && "message" in value;
}

export { router as generateRouter };
```

## Appendix C: Frontend `BackendAdapter` Sketch

```typescript
// src/lib/provider/backendAdapter.ts
import type { GenerateResponse } from "./contracts.js";
import type { ProviderAdapter } from "./providerAdapter.js";
import type { AppError, ModelOption, ReferenceImage } from "../types.js";

interface BackendGenerateBody {
  mode: "txt>img" | "img>img";
  modelId: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  quality: string;
  references: Array<{ mimeType: string; dataUrl: string }>;
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;  // FAL output URLs — pass through
  // blob: URL — must convert
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Note: the frontend GenerateRequest still has apiKey for compatibility,
// but BackendAdapter ignores it.
interface FrontendRequest {
  mode: "txt>img" | "img>img";
  model: ModelOption;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  quality: string;
  references: ReferenceImage[];
}

export class BackendAdapter implements ProviderAdapter {
  async generate(request: FrontendRequest & { apiKey?: string }): Promise<GenerateResponse> {
    const serializedRefs = await Promise.all(
      request.references.map(async (ref) => ({
        mimeType: ref.mimeType,
        dataUrl: await blobUrlToDataUrl(ref.previewUrl),
      })),
    );

    const body: BackendGenerateBody = {
      mode: request.mode,
      modelId: request.model.id,
      prompt: request.prompt,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
      quality: request.quality,
      references: serializedRefs,
    };

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const appError: AppError = errorBody?.error ?? {
        kind: "network",
        message: `Server error: ${response.status}`,
      };
      throw appError;
    }

    return response.json();
  }
}
```

## Appendix D: Adapter Porting — Node.js Delta

The only browser-specific code in the adapters is the base64 conversion utilities.

### GeminiAdapter: `urlToBase64` replacement

```typescript
// Browser version (current):
async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) return url.split(",")[1];
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Node version:
async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) return url.split(",")[1];
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.toString("base64");
}
```

### FalAdapter: `toDataUrl` replacement

```typescript
// Browser version (current):
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Node version:
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}
```

Everything else in both adapters (request building, response parsing, error handling) uses standard `fetch()` and JSON — works identically in Node 20.
