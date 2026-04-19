# Architecture Recommendation — Implementation-Ready Proposal

---

## 0. Repo Reality Snapshot (what is actually true right now)

### Verified Facts `[VF]`

- `[VF]` The repo is a Vite + React 18 + TypeScript SPA. No backend exists anywhere. (`package.json`, `vite.config.ts`)
- `[VF]` Source files exist in git HEAD (`c99e7fc`) — 25 `.ts/.tsx/.css` files under `src/`. Working tree copies are currently zero-byte due to a sync/permissions artifact, but git has the full content intact.
- `[VF]` The codebase had 15 passing Vitest tests and clean TypeScript compilation as of the last working-tree session. (`src/lib/__tests__/`, `src/lib/provider/__tests__/`)
- `[VF]` Two real provider adapters exist: `GeminiAdapter` (Google Gemini API) and `FalAdapter` (FAL.AI / Flux). Both make direct browser→provider `fetch()` calls with API keys in headers.
- `[VF]` A `ProviderAdapter` interface + `RoutingAdapter` factory + `GenerateRequest/GenerateResponse` contracts exist. This is the strongest reusable asset.
- `[VF]` A `ModelRegistry` holds 5 model definitions with capability flags (aspect ratios, resolutions, MIME types, max references).
- `[VF]` A `MockNanoBananaAdapter` exists but is unreferenced in production code (dead code).
- `[VF]` State management uses `useReducer` with `localStorage` for API key persistence per provider.
- `[VF]` The UI is a single-screen playground: prompt textarea, model picker, settings, reference upload, result panel. The user controls everything.
- `[VF]` Zero backend, zero auth, zero DB, zero object storage, zero queue, zero billing, zero CI/CD.
- `[VF]` 3 git commits. No branches, no tags, no releases.
- `[VF]` A comprehensive docs system was created (`docs/`) with 16 markdown files covering product definition, architecture overview, execution roadmap, decisions, open questions, progress tracking, and role boundaries.
- `[VF]` Three decisions are formally logged: DEC-001 (product direction), DEC-002 (source-of-truth discipline), DEC-003 (customer vs internal mode separation).

### Working Tree Issue `[VF]`

The `src/` directory currently contains empty/zero-byte files that cannot be overwritten via `git checkout` (permission error in the sandbox environment). All source code is intact in `git show HEAD:src/*`. **Before any implementation begins, the working tree must be restored to match HEAD.** This is a sandbox artifact, not a code loss.

---

## 1. Constraint Extraction from Docs

### Hard Constraints (from `AGENTS.md`, `product-definition.md`, `architecture-overview.md`, decisions)

| ID | Constraint | Source | Tag |
|---|---|---|---|
| C1 | Customer flow is automation-first: upload → choose preset → auto-process → preview → pay → download | `AGENTS.md`, `product-definition.md` | `[VF]` DEC-001 |
| C2 | No prompts, no provider names, no model names, no API keys, no generation settings in customer UX | `product-definition.md` | `[VF]` DEC-003 |
| C3 | Provider API keys must be server-side only in product mode | `AGENTS.md`, `security-and-risk-rules.md` | `[VF]` |
| C4 | Uploads are untrusted input — validate server-side | `security-and-risk-rules.md` | `[VF]` |
| C5 | Incremental evolution over rewrite — preserve provider abstraction | `AGENTS.md`, `architecture-overview.md` | `[VF]` |
| C6 | Customer mode vs internal/admin playground mode must be separate | `project-overview.md` | `[VF]` DEC-003 |
| C7 | Internal prompt logic, routing, preprocessing, postprocessing stay hidden | `product-definition.md` | `[VF]` |
| C8 | Code and tests outrank planning documents | `source-of-truth-rules.md` | `[VF]` DEC-002 |

### Product Constraints (from `product-definition.md`, `execution-roadmap.md`)

| ID | Constraint | Tag |
|---|---|---|
| P1 | Target user: small/mid e-commerce seller | `[VF]` DEC-001 |
| P2 | V1 scope: single-photo upload, one narrow enhancement use case, fixed presets, auto-process, paid delivery | `[VF]` |
| P3 | Pricing: low-ticket per result (~$2–5) or credit pack. No complex subscription on day one | `[AS]` |
| P4 | Out of scope for v1: batch, API, team accounts, general studio, marketplace integrations | `[VF]` |

### Open Questions (from `open-questions-register.md`) — Blocking

| ID | Question | Impact | Tag |
|---|---|---|---|
| OQ-001 | First paid task: White Background, Studio Light, or Marketplace Ready? | Pipeline, frontend, quality bar | `[OQ]` |
| OQ-002 | Backend stack: FastAPI (Python) or Node.js? | All backend work | `[OQ]` |
| OQ-003 | Provider/model combination for first workflow? | Cost, quality, pipeline design | `[OQ]` |
| OQ-006 | Minimum quality bar for paid output? | Pipeline, QA, trust | `[OQ]` |

---

## 2. Rec: Recommended Architecture

### 2.1 Backend Stack Decision → Node.js (TypeScript) `[PR]`

**Recommendation: Node.js + Express/Hono, not FastAPI.**

Rationale:
- The entire existing codebase is TypeScript. The provider adapters (`GeminiAdapter`, `FalAdapter`), contracts (`GenerateRequest/GenerateResponse`), model registry, and validation can be **moved server-side with zero rewrite** — they are already isomorphic TypeScript with `fetch()` calls and no DOM dependencies.
- Single-language stack eliminates context-switching overhead for a solo/small team.
- The strategy report suggested FastAPI for "ML/image processing ecosystem (Pillow, OpenCV)." But the v1 product does **not** do local image processing — it orchestrates remote AI providers via HTTP. All heavy lifting happens at Gemini/FAL. If local processing is needed later (watermarking, resizing), Sharp (Node) handles it.
- Dependency count stays minimal. No Python environment, no virtualenv, no dual Dockerfiles for v1.

**Concrete stack:**

```
Runtime:     Node.js 20 LTS
Framework:   Hono (lightweight, fast, typed) or Express
ORM:         Drizzle (TypeScript-native, thin, migration-friendly)
DB:          PostgreSQL (via Neon serverless or local Docker)
Queue:       BullMQ + Redis (for async jobs)
Storage:     S3-compatible (Cloudflare R2, AWS S3, or MinIO for dev)
Auth:        Lucia (lightweight) or custom JWT + bcrypt for v1
Payments:    Stripe Checkout + Webhooks
```

### 2.2 System Boundary Design `[PR]`

```
┌─────────────────────────────────────────────────────────────┐
│                 FRONTEND  (Vite + React)                     │
│                                                             │
│  ┌───────────────────────┐  ┌────────────────────────────┐  │
│  │  Customer Product Mode │  │  Internal Playground Mode  │  │
│  │  (default route)       │  │  (/internal, gated)        │  │
│  │                        │  │                            │  │
│  │  Upload → Preset →     │  │  Prompt → Model → Settings │  │
│  │  Progress → Preview →  │  │  → Generate → Result       │  │
│  │  Pay → Download        │  │  (existing UI, preserved)  │  │
│  └───────────┬───────────┘  └──────────┬─────────────────┘  │
│              │ POST /api/enhance        │ POST /api/generate │
└──────────────┼──────────────────────────┼───────────────────┘
               │                          │
┌──────────────▼──────────────────────────▼───────────────────┐
│                    BACKEND  (Node.js + Hono)                 │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │                    API Layer                           │   │
│  │  POST /api/enhance    — customer enhancement request  │   │
│  │  GET  /api/jobs/:id   — job status polling            │   │
│  │  POST /api/download   — authorized download (credits) │   │
│  │  POST /api/generate   — internal playground proxy     │   │
│  │  POST /api/auth/*     — login, signup, session        │   │
│  │  POST /api/billing/*  — Stripe webhooks, balance      │   │
│  │  GET  /health                                         │   │
│  └───────────────────┬───────────────────────────────────┘   │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐   │
│  │              Enhancement Orchestrator                  │   │
│  │                                                       │   │
│  │  preset → hidden prompt template                      │   │
│  │         → provider selection (internal)               │   │
│  │         → optional multi-step pipeline                │   │
│  │         → postprocessing (resize, watermark)          │   │
│  │         → quality gate                                │   │
│  └───────────────────┬───────────────────────────────────┘   │
│                      │                                       │
│  ┌───────────────────▼───────────────────────────────────┐   │
│  │         Provider Abstraction Layer                     │   │
│  │         (ported from existing TS code)                 │   │
│  │                                                       │   │
│  │  ProviderAdapter interface                            │   │
│  │  ├── GeminiAdapter  (from geminiAdapter.ts)           │   │
│  │  ├── FalAdapter     (from falAdapter.ts)              │   │
│  │  └── RoutingAdapter (from createProviderAdapter.ts)   │   │
│  │                                                       │   │
│  │  GenerateRequest / GenerateResponse contracts         │   │
│  │  (from contracts.ts — used as-is)                     │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │PostgreSQL│  │  Redis   │  │ S3/R2    │  │  Stripe    │  │
│  │(users,   │  │(BullMQ   │  │(uploads, │  │(payments,  │  │
│  │ jobs,    │  │ jobs,    │  │ outputs) │  │ webhooks)  │  │
│  │ credits) │  │ sessions)│  │          │  │            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 The Two API Contracts `[PR]`

**Customer Enhancement Contract** (`POST /api/enhance`):

```typescript
// Request — what the customer sees
interface EnhanceRequest {
  preset: "white-background" | "studio-light" | "marketplace-ready";
  imageId: string;           // reference to uploaded asset
  options?: {
    category?: string;       // optional product category hint
  };
}

// Response
interface EnhanceResponse {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
}
```

**Internal Playground Contract** (`POST /api/generate`):

```typescript
// Mirrors existing GenerateRequest — just proxied through backend
// Existing contracts.ts can be used as-is
interface GenerateRequest {
  // ... existing fields minus apiKey
  mode: "txt>img" | "img>img";
  model: ModelOption;
  prompt: string;
  aspectRatio: AspectRatioId;
  resolution: ResolutionId;
  quality: QualityId;
  references: ReferenceImage[];
}
```

This separation means: the customer never sees the internal contract. The internal playground uses the same provider path but with explicit controls.

### 2.4 Enhancement Orchestrator Design `[PR]`

The orchestrator is the **new** layer between customer presets and provider adapters:

```typescript
// New code — does not exist yet
interface EnhancementPipeline {
  name: string;
  steps: PipelineStep[];
}

interface PipelineStep {
  id: string;
  provider: "gemini" | "fal";
  promptTemplate: string;          // hidden, parameterized
  modelId: string;                 // internal provider model ID
  preprocessor?: (input: Buffer) => Promise<Buffer>;
  postprocessor?: (output: Buffer) => Promise<Buffer>;
}

// Example: "white-background" preset
const whiteBackgroundPipeline: EnhancementPipeline = {
  name: "white-background",
  steps: [
    {
      id: "bg-remove",
      provider: "fal",
      promptTemplate: "", // bg removal models don't need prompts
      modelId: "fal-ai/bria/rmbg",  // or similar
    },
    {
      id: "relight-compose",
      provider: "gemini",
      promptTemplate: "Product photo on pure white background, professional studio lighting, centered composition, e-commerce ready. Original product: {{productDescription}}",
      modelId: "gemini-3.1-flash-image-preview",
    },
  ],
};
```

This keeps the customer flow automation-first while giving the AI Pipeline Agent full control over hidden prompt engineering, model selection, and multi-step chaining.

### 2.5 Data Model `[PR]`

```sql
-- Minimal v1 schema
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,                    -- null if OAuth-only
  oauth_provider TEXT,
  credits       INTEGER NOT NULL DEFAULT 5,  -- free tier
  stripe_customer_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) NOT NULL,
  preset        TEXT NOT NULL,           -- 'white-background', etc.
  status        TEXT NOT NULL DEFAULT 'queued',
    -- queued | processing | completed | failed
  input_key     TEXT NOT NULL,           -- S3 key for original upload
  output_key    TEXT,                    -- S3 key for result (null until done)
  error_message TEXT,
  credits_charged INTEGER DEFAULT 0,
  provider_cost_cents INTEGER,           -- track actual cost
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE TABLE credit_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) NOT NULL,
  amount        INTEGER NOT NULL,        -- positive = credit, negative = debit
  reason        TEXT NOT NULL,           -- 'signup_bonus', 'job_charge', 'purchase', 'subscription_renewal'
  job_id        UUID REFERENCES jobs(id),
  stripe_payment_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 2.6 Upload + Processing + Delivery Flow `[PR]`

```
UPLOAD:
  1. Frontend: user selects image, client-side validates (type, size ≤ 10MB)
  2. Frontend: POST /api/upload → backend validates auth + rate limit
  3. Backend: generates presigned S3 PUT URL, returns { uploadUrl, imageId }
  4. Frontend: PUT to S3 directly (presigned)
  5. Frontend: POST /api/enhance { preset, imageId }

PROCESSING:
  6. Backend: validates request, checks credits ≥ 1
  7. Backend: creates Job record (status: queued)
  8. Backend: enqueues BullMQ job
  9. Worker: picks job, downloads input from S3
  10. Worker: runs EnhancementPipeline steps sequentially
  11. Worker: uploads result to S3
  12. Worker: updates Job (status: completed, output_key)

DELIVERY:
  13. Frontend: polls GET /api/jobs/:id every 2s
  14. Frontend: on completed → shows before/after preview (low-res from S3)
  15. User clicks "Download HD"
  16. Backend: POST /api/download/:jobId → checks auth + deducts 1 credit → returns presigned GET URL (full-res, 5min expiry)
  17. Frontend: downloads via presigned URL
```

### 2.7 Credit Deduction Logic `[PR]`

Credits are charged at download time, not at processing time. Rationale:
- If processing fails, the user is never charged
- If quality is poor, the user can choose not to download (no charge)
- This builds trust: "you only pay for what you keep"

```typescript
// Atomic credit check + deduction
async function authorizeDownload(userId: string, jobId: string): Promise<string> {
  return db.transaction(async (tx) => {
    const user = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (user.credits < 1) throw new InsufficientCreditsError();

    const job = await tx.select().from(jobs).where(eq(jobs.id, jobId));
    if (job.status !== "completed") throw new JobNotReadyError();
    if (job.credits_charged > 0) {
      // Already paid — return download URL without re-charging
      return generatePresignedGet(job.output_key);
    }

    await tx.update(users).set({ credits: user.credits - 1 });
    await tx.update(jobs).set({ credits_charged: 1 });
    await tx.insert(credit_transactions).values({
      user_id: userId, amount: -1, reason: "job_charge", job_id: jobId
    });

    return generatePresignedGet(job.output_key);
  });
}
```

---

## 3. Why This Architecture Fits Docs and Product Direction

| Requirement (from docs) | How this architecture satisfies it |
|---|---|
| C1: Automation-first flow | Customer hits one endpoint (`/api/enhance`) with a preset name. All AI complexity is behind `EnhancementOrchestrator`. |
| C2: No prompts/providers in customer UX | `EnhanceRequest` has `preset` + `imageId` only. Prompts are hidden templates server-side. |
| C3: API keys server-side | Backend holds keys in env vars. Frontend never sees them. |
| C4: Uploads untrusted | Presigned URL upload → server-side validation before processing. |
| C5: Incremental evolution | Provider adapters port directly from existing TS. Frontend keeps Vite+React. No rewrite. |
| C6: Customer vs internal mode | Two separate routes: `/` (product) and `/internal` (playground). Two separate API contracts. |
| C7: Hidden orchestration | `EnhancementPipeline` with hidden prompt templates lives only on backend. |
| P2: Single photo, fixed presets, auto-process | `EnhanceRequest` enforces this: one `imageId`, one `preset`, done. |
| P3: Low-ticket per result | Credit deduction at download, transactional, auditable. |
| OQ-002 resolved | Node.js chosen — zero-rewrite port of existing TS adapters. |

---

## 4. Risks

### Blockers (must resolve before implementation)

| Risk | Impact | Mitigation | Tag |
|---|---|---|---|
| **Working tree is corrupted** — `src/` files are zero-byte, `git checkout` fails with permission errors | Cannot build, test, or modify frontend code | Restore from git outside sandbox, or re-clone repo fresh. This is the #1 operational blocker. | `[VF]` |
| **OQ-001 unresolved** — first paid task not chosen | Pipeline design, prompt templates, and quality bar cannot be finalized | Recommend: **White Background Cleanup** as first task. It's the simplest pipeline (bg removal + white compose), highest-demand for e-commerce, and easiest to define quality for. | `[PR]` |
| **OQ-003 unresolved** — provider/model combination not chosen | Cannot estimate per-job cost or design pipeline steps | Recommend: FAL `bria/rmbg` for background removal + Gemini Flash for relight/compose. Cost estimate: ~$0.01–0.05 per job. | `[PR]` |
| **OQ-006 unresolved** — quality bar not defined | Cannot QA outputs or decide if paid delivery is acceptable | Recommend: minimum bar = "clean background separation with no visible artifacts on product edges, properly lit product, ≥1024px output." Human-reviewed sample of first 50 outputs before launch. | `[PR]` |

### Contradictions Found

| Contradiction | Sources | Resolution | Tag |
|---|---|---|---|
| Strategy report recommends FastAPI (Python) | `product-strategy-report.md` | Overridden by this recommendation: Node.js (TypeScript) for zero-rewrite adapter port and single-language stack. Report is planning artifact, not decision `[VF]` DEC-002. | `[PR]` |
| Strategy report says "6-8 weeks to MVP" | `product-strategy-report.md` | Optimistic if including Stripe integration + auth + frontend redesign. More realistic: 8-10 weeks with one full-stack dev, or 5-6 weeks with focused scope cuts (defer auth to session-only, defer Stripe to credit pack purchase only). | `[AS]` |
| `architecture-overview.md` says "durable storage for uploads and outputs" but no storage decision exists | `architecture-overview.md`, `open-questions-register.md` OQ-007 | Recommend: Cloudflare R2 (S3-compatible, zero egress fees, cheap). 7-day retention for free tier, 30-day for paid. | `[PR]` |
| Existing model registry has 5 models for playground but product needs hidden preset→pipeline mapping | `modelRegistry.ts` (in git) vs `product-definition.md` | The model registry stays for internal playground mode. A new `EnhancementPipeline` registry is added for product mode. They share provider adapters but differ in how requests are constructed. | `[PR]` |

### Architectural Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Multi-step pipeline reliability (bg removal → relight) — if step 1 fails, step 2 can't run | Medium | BullMQ job with step tracking. On failure: retry step, then mark job as failed. Show "processing failed, no charge" to user. |
| Provider latency variance (Gemini: 3–15s, FAL: 2–8s) | Medium | Set 60s timeout per step, 120s total. Show progress bar with "Removing background..." / "Enhancing lighting..." |
| Cost blowup from bad actors on free tier | High | Rate limit: 5 free jobs/day per IP. Require email verification before free credits activate. |
| Output quality inconsistency | High | Run A/B quality checks on first 100 jobs. Build a reject-and-retry mechanism for the orchestrator. Long-term: add output quality scoring. |

---

## 5. Plan: Current State → Target State → Implementation Order

### Current State

```
[Frontend SPA] → browser fetch() → [Google Gemini / FAL APIs]
     ↑ user enters API keys, prompts, model choices
     └─ no backend, no auth, no storage, no billing
```

### Target State (MVP)

```
[Customer Frontend] → /api/enhance → [Backend: orchestrator + providers]
                                            ↓
                                    [S3: uploads + outputs]
                                    [PostgreSQL: users + jobs + credits]
                                    [Redis: job queue]
                                    [Stripe: payments]
```

### Implementation Order (dependency-driven)

```
Phase 0: Prerequisites
  ├── 0.1 Fix working tree (restore src/ from git)
  └── 0.2 Add CI baseline (GitHub Actions: test + tsc)

Phase 1: Backend Foundation (unblocks everything)
  ├── 1.1 Backend scaffold (Node + Hono + health check + .env)
  ├── 1.2 Port provider adapters to backend (zero-rewrite TS move)
  ├── 1.3 POST /api/generate (internal playground proxy)
  ├── 1.4 Frontend: backendAdapter.ts → calls /api/generate
  │        (playground still works, but keys are now server-side)
  └── 1.5 Tests: backend adapter routing, frontend integration

Phase 2: Enhancement Pipeline (the product core)
  ├── 2.1 Enhancement orchestrator + pipeline registry
  ├── 2.2 "White Background" pipeline: FAL bg-remove → Gemini relight
  ├── 2.3 POST /api/enhance endpoint
  ├── 2.4 S3 upload flow (presigned URLs)
  ├── 2.5 BullMQ async job processing
  ├── 2.6 GET /api/jobs/:id polling
  └── 2.7 Tests: pipeline execution, job lifecycle

Phase 3: Customer Frontend
  ├── 3.1 React Router: / (product) vs /internal (playground)
  ├── 3.2 Product upload page (drag & drop, preset picker)
  ├── 3.3 Job progress + before/after preview
  ├── 3.4 Download flow
  └── 3.5 Tests: customer flow E2E

Phase 4: Auth + Billing
  ├── 4.1 PostgreSQL schema + Drizzle migrations
  ├── 4.2 Auth: signup/login (email + password for v1)
  ├── 4.3 Credit system: balance, deduction at download
  ├── 4.4 Stripe Checkout: credit pack purchase
  ├── 4.5 Stripe webhooks: payment confirmation → credit add
  └── 4.6 Tests: auth, credit transactions, Stripe webhook handling

Phase 5: Launch Readiness
  ├── 5.1 Rate limiting (Redis-based, per-user + per-IP)
  ├── 5.2 Error tracking (Sentry)
  ├── 5.3 Basic analytics events (PostHog)
  ├── 5.4 Landing page with before/after examples
  ├── 5.5 Docker Compose for production
  └── 5.6 Deploy to Fly.io / Railway
```

---

## 6. DOD: Definition of Done Before Implementation Starts

Implementation can start **confidently** when ALL of these are true:

| # | Condition | Status | Action Needed |
|---|---|---|---|
| 1 | Working tree matches git HEAD — all `src/` files are readable and tests pass | **NOT MET** | Restore `src/` from git (re-clone or fix permissions outside sandbox) |
| 2 | First paid task is chosen | **NOT MET** | Decision needed. Recommendation: "White Background Cleanup" `[PR]` |
| 3 | Backend stack is chosen | **NOT MET** | Decision needed. Recommendation: Node.js + Hono + TypeScript `[PR]` |
| 4 | Provider combination for first pipeline is chosen | **NOT MET** | Decision needed. Recommendation: FAL bria/rmbg + Gemini Flash `[PR]` |
| 5 | Customer enhancement API contract is frozen | **NOT MET** | Freeze `EnhanceRequest/EnhanceResponse` from section 2.3 above `[PR]` |
| 6 | Internal playground API contract is frozen | **READY** — existing `GenerateRequest/GenerateResponse` in `contracts.ts` can be used as-is | Port to backend, add auth header |
| 7 | Credit-at-download model is accepted | **NOT MET** | Decision needed. Recommendation in section 2.7 `[PR]` |
| 8 | Storage provider is chosen | **NOT MET** | Decision needed. Recommendation: Cloudflare R2 `[PR]` |

**Minimum viable DOD for Phase 1 only:** conditions 1, 3, and 6.
Phase 1 (backend proxy for existing playground) doesn't need product decisions — it just moves provider calls server-side.

---

## 7. NX: Immediate Next Steps

### Step 1 — Fix Working Tree `[BLOCKER]`

Outside the sandbox environment, run:
```bash
cd /path/to/nano-banana-playground
git checkout -- src/
npm test          # should pass 15 tests
npm run build     # should compile clean
```

If permissions are truly broken, re-clone:
```bash
git clone <origin-url> nano-banana-playground-fresh
cd nano-banana-playground-fresh
cp -r ../nano-banana-playground/docs .
cp ../nano-banana-playground/AGENTS.md .
npm install && npm test
```

### Step 2 — Lock 4 Decisions

The following decisions resolve all blocking open questions and unblock implementation:

| Decision | Recommendation | Rationale |
|---|---|---|
| **Backend stack** (OQ-002) | Node.js + Hono + TypeScript | Zero-rewrite adapter port, single-language stack |
| **First paid task** (OQ-001) | White Background Cleanup | Simplest pipeline, highest demand, clearest quality bar |
| **Provider combo** (OQ-003) | FAL `bria/rmbg` (bg removal) + Gemini Flash (relight/compose) | Good cost/quality balance, both already have adapters |
| **Credit model** (OQ-004) | Pay-at-download, 5 free credits on signup | Builds trust, simple to implement |

Once accepted, these should be logged in `docs/decisions/decision-log.md` as DEC-004 through DEC-007.

### Step 3 — Start Phase 1 Implementation

Phase 1 (backend scaffold + provider port + playground proxy) can start immediately after Step 1 and the backend stack decision. It requires **no product decisions** — it's pure infrastructure that makes the playground work through a secure backend.

Estimated effort: 2–3 days for one developer.

Deliverables:
- `backend/` directory with Hono app
- Provider adapters moved from `src/lib/provider/` to `backend/src/providers/`
- `POST /api/generate` endpoint
- `src/lib/provider/backendAdapter.ts` on frontend
- Vite proxy config
- API keys removed from browser
- All existing tests still passing

---

## Appendix: File-Level Impact Map for Phase 1

| File | Action | Details |
|---|---|---|
| `backend/package.json` | CREATE | hono, drizzle-orm, bullmq, @aws-sdk/s3 (devDeps: vitest, tsx) |
| `backend/src/index.ts` | CREATE | Hono app, CORS, routes |
| `backend/src/providers/contracts.ts` | MOVE | from `src/lib/provider/contracts.ts` — no changes |
| `backend/src/providers/providerAdapter.ts` | MOVE | from `src/lib/provider/providerAdapter.ts` — no changes |
| `backend/src/providers/geminiAdapter.ts` | MOVE | from `src/lib/provider/geminiAdapter.ts` — replace browser `fetch` with Node `fetch` (native in Node 20) |
| `backend/src/providers/falAdapter.ts` | MOVE | from `src/lib/provider/falAdapter.ts` — same treatment |
| `backend/src/providers/routingAdapter.ts` | MOVE | from `src/lib/provider/createProviderAdapter.ts` |
| `backend/src/routes/generate.ts` | CREATE | POST /api/generate handler |
| `backend/src/config.ts` | CREATE | env vars: GEMINI_API_KEY, FAL_API_KEY, ALLOWED_ORIGINS |
| `backend/.env.example` | CREATE | template |
| `backend/tests/routing.test.ts` | CREATE | port from existing `routing.test.ts` |
| `src/lib/provider/backendAdapter.ts` | CREATE | fetch("/api/generate", ...) |
| `src/lib/provider/createProviderAdapter.ts` | MODIFY | return BackendAdapter instead of RoutingAdapter |
| `src/App.tsx` | MODIFY | remove API key field and persistence |
| `src/lib/state.ts` | MODIFY | remove apiKey from state, remove localStorage key logic |
| `src/lib/types.ts` | MODIFY | remove apiKey from PlaygroundState |
| `src/lib/validation.ts` | MODIFY | remove apiKey validation |
| `vite.config.ts` | MODIFY | add proxy: { "/api": "http://localhost:3001" } |
| `src/lib/provider/mockNanoBananaAdapter.ts` | DELETE | dead code |
| `docker-compose.yml` | CREATE | frontend + backend dev setup |
