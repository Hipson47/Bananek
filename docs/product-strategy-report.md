# Nano Banana Playground — Audyt repozytorium i strategia produktowa

---

# Executive Summary

- **Repozytorium zawiera działający, prywatny playground do generowania obrazów** — front-end-first SPA (Vite + React 18 + TypeScript) z dwoma prawdziwymi providerami: Google Gemini i FAL (Flux).
- **Kod jest czysty, dobrze zorganizowany i kompiluje się bez błędów.** 15 testów przechodzi, TypeScript nie zgłasza problemów.
- **Architektura provider-abstraction jest najsilniejszym zasobem** — `ProviderAdapter` + `ModelRegistry` + znormalizowane kontrakty to dobra baza pod produkt multi-provider.
- **Repo NIE jest produktem — to narzędzie deweloperskie dla jednego użytkownika.** Brak backendu, brak auth, brak billingU, brak bazy danych, brak kolejek, brak persystencji.
- **Najlepsza monetyzowalna nisza to "AI Product Photo Enhancer dla e-commerce sellerów"** — cleanup zdjęć produktowych (tło, oświetlenie, retusz) z modelem kredytowym.
- **MVP powinien być wąski:** upload → automatyczny enhancement (background removal + relight + cleanup) → download — z Stripe credits i max 3 kliknięciami.
- **Kluczowa decyzja architektoniczna: dodanie backendu (FastAPI lub Node)** do obsługi kluczy API, jobów asynchronicznych i billingu. Frontend może zostać jako Vite+React.
- **Największe ryzyko: klucze API wystawione w przeglądarce** — to pierwszy blocker do naprawienia.
- **Szacowany czas do MVP: 6–8 tygodni** przy jednym full-stack deweloperze.

---

# Repo Reality Check

## Czym to repozytorium JEST

Prywatny, jednoekranowy playground do szybkiego testowania modeli generowania obrazów. Architektura front-end-first, bez backendu, bez persystencji poza `localStorage` (klucze API). Obsługuje tryby `txt>img` i `img>img` z dwoma realnymi providerami (Google Gemini, FAL/Flux) oraz jednym mock adapterem.

## Czym to repozytorium NIE JEST

- Nie jest produktem komercyjnym
- Nie ma auth, multi-tenancy, rate limitingu, billingU
- Nie ma backendu — API keys lecą prosto z przeglądarki do providerów `[RISK]`
- Nie ma bazy danych, historii generacji, persystencji sesji
- Nie ma CI/CD pipeline, Dockera, infrastruktury deploymentowej
- Nie ma monitoringu, analytics, error trackingu
- Nie obsługuje batch processing, kolejek, webhooków

## Najsilniejsze istniejące zasoby

1. **Provider Abstraction Layer** (`src/lib/provider/`) — czysta separacja UI od providerów, routing po `model.provider`, znormalizowane kontrakty request/response. Łatwo dodać nowego providera.
2. **Model Registry** (`src/lib/modelRegistry.ts`) — centralna definicja modeli z capability flags, limity referencji, wspierane formaty. Gotowe pod rozszerzenie.
3. **Validation Layer** (`src/lib/validation.ts`) — model-aware walidacja z testem pokrycia.
4. **Czysta architektura komponentów** — `App.tsx` jako orkiestrator, wydzielone komponenty UI, reducer-based state management.
5. **Działające testy** — 15 testów (state, validation, routing) przechodzących z Vitest.

## Największe słabości

1. **Brak backendu** — klucze API w przeglądarce, zero server-side processing
2. **Brak billingU / auth** — nie ma fundamentów pod monetyzację
3. **Brak persystencji** — żadna historia, żadne dane użytkownika
4. **Brak CI/CD** — tylko 3 commity, zero automatyzacji
5. **Dokumentacja nie zgadza się z kodem** — PRD opisuje 3 modele Google-only, kod ma 5 modeli z dwóch providerów

---

# Architecture Map

## Apps / Packages / Services

```
nano-banana-playground/          ← monolityczny SPA, zero backendu
├── src/
│   ├── App.tsx                  ← główny orkiestrator
│   ├── main.tsx                 ← entry point (React root)
│   ├── styles.css               ← globalne style (dark theme)
│   ├── components/
│   │   ├── Field.tsx            ← generic form field wrapper
│   │   ├── SegmentedControl.tsx ← radio-like mode picker
│   │   ├── ReferenceUploader.tsx← drag & drop + file input
│   │   ├── ReferenceList.tsx    ← lista referencji z thumbnailami
│   │   └── ResultPanel.tsx      ← panel wynikowy (preview + actions)
│   └── lib/
│       ├── types.ts             ← centralne typy TypeScript
│       ├── state.ts             ← reducer + localStorage persistence
│       ├── modelRegistry.ts     ← definicje modeli, capabilities
│       ├── validation.ts        ← walidacja przed generacją
│       ├── download.ts          ← helper do pobierania obrazów
│       ├── referenceImages.ts   ← tworzenie/zwalnianie referencji
│       ├── provider/
│       │   ├── contracts.ts     ← GenerateRequest / GenerateResponse
│       │   ├── providerAdapter.ts ← interfejs ProviderAdapter
│       │   ├── createProviderAdapter.ts ← RoutingAdapter (factory)
│       │   ├── geminiAdapter.ts ← Google Gemini API adapter
│       │   ├── falAdapter.ts    ← FAL.AI (Flux) adapter
│       │   └── mockNanoBananaAdapter.ts ← mock do testów manualnych
│       └── __tests__/
│           ├── state.test.ts
│           ├── validation.test.ts
│           └── provider/__tests__/routing.test.ts
├── package.json                 ← Vite + React 18 + Vitest
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── docs/working-memory.md       ← handoff notes
├── AGENTS.md                    ← agent guidance
└── nano_banana_playground_prd.md← PRD (outdated)
```

## Data Flow

```
[Użytkownik] 
  → wypełnia formularz (prompt, model, aspect ratio, resolution, references)
  → klik "Generate"
  → App.tsx: validatePlaygroundState()
  → RoutingAdapter.generate(normalizedRequest)
  → [Google? → GeminiAdapter] lub [FAL? → FalAdapter]
  → fetch() bezpośrednio z przeglądarki do providera API
  → response → GenerateResponse → dispatch(generate_success)
  → ResultPanel renderuje obraz
  → [Download] lub [Use as Reference]
```

## Integration Map

| Integracja | Status | Plik |
|---|---|---|
| Google Gemini API | Działa (frontend-direct) | `geminiAdapter.ts` |
| FAL.AI (Flux) API | Działa (frontend-direct) | `falAdapter.ts` |
| Auth / OAuth | Brak | — |
| Baza danych | Brak | — |
| Object Storage (S3/GCS) | Brak | — |
| Stripe / billing | Brak | — |
| Background jobs / queues | Brak | — |
| CI/CD | Brak | — |
| Error tracking | Brak | — |
| Analytics | Brak | — |

---

# What Already Works

| Feature | Dowód (plik) | Status |
|---|---|---|
| txt>img generation via Gemini | `geminiAdapter.ts` L30–L95, `routing.test.ts` | Działa, przetestowane |
| txt>img generation via FAL Flux | `falAdapter.ts` L65–L115, `routing.test.ts` | Działa, przetestowane |
| img>img generation (oba providery) | `geminiAdapter.ts` L40–50, `falAdapter.ts` L75–85 | Działa |
| Provider routing | `createProviderAdapter.ts` RoutingAdapter | Działa, przetestowane |
| Model registry z capability flags | `modelRegistry.ts` 5 modeli zdefiniowanych | Działa |
| Input validation (prompt, API key, refs, mime types, model limits) | `validation.ts`, 5 testów | Działa |
| Reference image upload + drag&drop | `ReferenceUploader.tsx` | Działa |
| Use-as-reference (generated → input) | `App.tsx` handleUseAsReference | Działa |
| Download generated image | `download.ts` | Działa |
| Per-provider API key persistence | `state.ts` localStorage per provider | Działa, przetestowane |
| Responsive dark-theme UI | `styles.css` media queries | Działa |
| TypeScript strict compilation | `tsconfig.app.json` | Czyste |
| 15 testów Vitest | 3 pliki testowe | Wszystkie przechodzą |

---

# What Is Broken / Missing / Risky

| Problem | Plik / Obszar | Severity | Blocker MVP? |
|---|---|---|---|
| `[RISK]` API keys w przeglądarce — wystawione w network tab | `geminiAdapter.ts`, `falAdapter.ts` — fetch z kluczem w headerze | **Krytyczny** | TAK |
| Brak backendu — zero server-side processing | Cały repo | **Krytyczny** | TAK |
| Brak auth / user management | — | **Krytyczny** | TAK |
| Brak billingU / credits | — | **Krytyczny** | TAK |
| Brak persystencji (DB, history) | — | **Wysoki** | TAK |
| Brak rate limiting / abuse prevention | — | **Wysoki** | TAK |
| Brak object storage dla uploadów/wyników | Obrazy w `blob:` URL i `data:` URL | **Wysoki** | TAK |
| Brak CI/CD | — | **Średni** | NIE |
| Brak error tracking / observability | — | **Średni** | NIE |
| Dokumentacja niezgodna z kodem | `README.md`, `nano_banana_playground_prd.md` vs. rzeczywisty stan | **Niski** | NIE |
| SVG w model capabilities ale nie w upload accept | `modelRegistry.ts` `image/svg+xml` vs `ReferenceUploader.tsx` accept | **Niski** | NIE |
| Mock adapter nieużywany (dead code) | `mockNanoBananaAdapter.ts` | **Niski** | NIE |
| Brak `image_size` pass-through dla "auto" w Gemini | `geminiAdapter.ts` — `auto` nie wysyła aspectRatio | **Niski** | NIE |

---

# Best Monetization Options

## 1. E-commerce Product Photo Enhancer (REKOMENDOWANY)

| Wymiar | Ocena |
|---|---|
| **Kto płaci** | Sellerzy na Allegro, Amazon, Etsy, Shopify |
| **Za co płacą** | Automatyczny cleanup zdjęć produktowych: usunięcie tła, poprawa oświetlenia, retusz, standaryzacja |
| **Dlaczego wracają** | Nowe produkty do wystawienia co tydzień/miesiąc, sezonowe odświeżenia |
| **Urgency** | Wysoka — złe zdjęcia = niższa konwersja, platformy wymagają białego tła |
| **Willingness to pay** | Wysoka — $5–30/mies. za drobnych sellerów, $50–200/mies. za sklepy |
| **Repeat frequency** | Wysoka — każdy nowy produkt to nowe zdjęcia |
| **Implementation complexity** | Średnia — background removal + relight + prompt-driven enhancement |
| **Operational complexity** | Niska — deterministyczne workflow, mało moderacji |
| **Acquisition difficulty** | Niska — jasny ROI, łatwo targetować na marketplace forach |
| **Retention** | Wysoka — narzędzie pracy, nie zabawka |
| **Legal/privacy risk** | Niski — zdjęcia produktów, nie twarze |
| **Fit z repo** | Dobry — provider abstraction, image upload, multi-model routing już istnieją |
| **Rekomendacja** | **NAJLEPSZA OPCJA** |

## 2. Professional Headshot / Portrait Enhancement

| Wymiar | Ocena |
|---|---|
| **Kto płaci** | Freelancerzy, LinkedIn users, małe firmy |
| **Za co płacą** | AI-enhanced portret z selfie — profesjonalne tło, oświetlenie, retusz |
| **Dlaczego wracają** | Sezonowo (nowe stanowisko, nowy profil), niski repeat |
| **Urgency** | Średnia |
| **Willingness to pay** | Średnia — $5–15 jednorazowo |
| **Repeat frequency** | Niska |
| **Implementation complexity** | Średnia-wysoka — wymaga face detection, konsystentnej jakości |
| **Legal/privacy risk** | **Wysoki — dane biometryczne, RODO, moderacja twarzy** |
| **Rekomendacja** | **DOBRA ALTERNATYWA, ale nie na start** |

## 3. Real-Estate Photo Enhancement

| Wymiar | Ocena |
|---|---|
| **Kto płaci** | Agenci nieruchomości, deweloperzy, portale ogłoszeniowe |
| **Za co płacą** | Virtual staging, poprawa oświetlenia, sky replacement |
| **Dlaczego wracają** | Każde nowe ogłoszenie = nowe zdjęcia |
| **Urgency** | Wysoka — konkurencja na portalach ogłoszeniowych |
| **Willingness to pay** | Wysoka — $20–100 za listę zdjęć |
| **Implementation complexity** | Wysoka — virtual staging wymaga precyzji i kontroli |
| **Rekomendacja** | **SILNA ALTERNATYWA, ale trudniejsze MVP** |

## 4. Background Removal for Sellers (standalone)

Zbyt wąska nisza jako samodzielny produkt — remove.bg i Canva mają silną pozycję. Lepiej jako feature w opcji #1.

## 5. Social Media Creative Generation

| **Rekomendacja** | **UNIKAĆ** — niski ARPU, wysoka konkurencja (Canva, Adobe Express), słaba retencja, trudne do wyróżnienia |

## 6. "Do Everything" Image Studio

| **Rekomendacja** | **UNIKAĆ** — zbyt szeroki scope, za dużo na v1, niejasna wartość, długi czas do rynku |

---

# Recommended MVP

## Target User

**Drobny/średni seller e-commerce** — sprzedaje na Allegro, Amazon, Etsy lub własnym Shopify. Robi zdjęcia telefonem w domu/garażu. Potrzebuje profesjonalnie wyglądających zdjęć produktowych bez studia fotograficznego.

## JTBD (Job To Be Done)

"Chcę zamienić moje amatorskie zdjęcia produktów na profesjonalne zdjęcia e-commerce w kilka sekund, żeby moje oferty wyglądały lepiej i sprzedawały więcej."

## Value Proposition (jedno zdanie)

**Wrzuć zdjęcie produktu — dostaniesz profesjonalne zdjęcie e-commerce z czystym tłem i poprawionym oświetleniem w 10 sekund.**

## V1 Flow (minimalny)

```
1. Użytkownik rejestruje się (email + hasło lub Google OAuth)
2. Widzi dashboard z credit balance
3. Klik "Enhance photo" → upload zdjęcia produktu
4. Wybiera preset: "White Background" / "Lifestyle" / "Studio Light"
5. System przetwarza asynchronicznie (3–15s):
   a. Background removal (dedykowany model)
   b. Relight / color correction (AI model)
   c. Composition na czystym tle
6. Widzi before/after preview
7. Klik "Download HD" (kosztuje 1 kredit)
8. Opcjonalnie: "Enhance another" lub "Batch upload"
```

## Pricing Hypothesis

| Plan | Cena | Kredyty | Target |
|---|---|---|---|
| Free | $0 | 5 zdjęć/miesiąc | Trial + onboarding |
| Starter | $9/mies. | 50 zdjęć/miesiąc | Drobni sellerzy |
| Pro | $29/mies. | 200 zdjęć/miesiąc | Aktywni sellerzy |
| Business | $79/mies. | 1000 zdjęć/miesiąc | Sklepy z dużym katalogiem |
| Pay-as-you-go | $0.25/zdjęcie | Bez subskrypcji | Okazjonalni użytkownicy |

## Usage / Credit Model

- 1 enhancement = 1 kredit
- Batch upload = 1 kredit × N zdjęć
- Free tier: 5 kredytów/miesiąc, nie kumulują się
- Płatne plany: kredyty resetują się co miesiąc, niewykorzystane przepadają

## In Scope (v1)

- Rejestracja / logowanie (email + Google OAuth)
- Upload single image (JPEG/PNG/WebP, max 20MB)
- 3 enhancement presets (white bg, lifestyle, studio light)
- Before/after preview
- HD download (watermark na free tier)
- Credit system + Stripe checkout
- Dashboard z historią
- Basic rate limiting

## Out of Scope (v1)

- Batch upload (v1.1)
- Custom prompt / manual editing
- API access
- Team accounts
- White-label / embed
- Mobile app
- Marketplace integrations (Allegro/Amazon API)
- Video processing
- Multiple output variants per image

## Dlaczego to najlepszy pierwszy wedge

1. **Jasny ROI** — lepsze zdjęcia = wyższa konwersja = więcej sprzedaży
2. **Powtarzalność** — nowy produkt = nowe zdjęcia, co tydzień
3. **Prosty onboarding** — upload → wow moment w 10 sekund
4. **Niski support burden** — deterministyczny workflow, mało edge cases
5. **Silny upsell path** — batch → API → integrations → white-label
6. **Niska konkurencja w PL** — remove.bg jest drogi, Canva nie specjalizuje się w product photos
7. **Repo fit** — provider abstraction, model routing, image upload już istnieją

---

# Technical Recommendation

## Keep / Change / Remove Decisions

| Element | Decyzja | Uzasadnienie |
|---|---|---|
| Vite + React 18 + TypeScript frontend | **KEEP** | Solidna baza, czysta architektura |
| Provider abstraction (`ProviderAdapter`, `contracts.ts`) | **KEEP + EXTEND** | Najsilniejszy zasób, gotowy na nowe modele |
| Model registry (`modelRegistry.ts`) | **KEEP + EXTEND** | Dodać enhancement-specific modele/presets |
| Validation layer | **KEEP + EXTEND** | Dodać limity plików, credit checks |
| State management (reducer) | **KEEP** | Dobrze działa dla playground, rozszerzyć o auth state |
| Direct browser→provider API calls | **REMOVE** | Zastąpić backend proxy `[RISK: KRYTYCZNY]` |
| Mock adapter | **REMOVE** | Dead code, niepotrzebny z prawdziwymi adapterami |
| `nano_banana_playground_prd.md` | **ARCHIVE** | Outdated, zastąpić nowym PRD |
| `localStorage` API key persistence | **REMOVE** | Klucze API muszą być server-side only |
| Dark playground UI | **CHANGE** | Przeprojektować na product-oriented UX (jasny, czysty, e-commerce feel) |

## Architecture Proposal

```
┌──────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vite + React)               │
│  Upload → Enhancement Preview → Before/After → Download      │
│  Auth UI → Dashboard → Credit Balance → History              │
│  ↕ fetch() do same-origin /api/*                             │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTPS (same origin via proxy)
┌──────────────────────────▼───────────────────────────────────┐
│                   BACKEND (FastAPI lub Next.js API Routes)    │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Auth        │  │ Upload       │  │ Enhancement Jobs    │ │
│  │ (JWT/OAuth) │  │ (S3/GCS     │  │ (async queue)       │ │
│  │             │  │  presigned)  │  │                     │ │
│  └─────────────┘  └──────────────┘  └─────────┬───────────┘ │
│                                                │             │
│  ┌──────────────┐  ┌──────────────┐           │             │
│  │ Credits /    │  │ Rate Limiter │  ┌────────▼──────────┐ │
│  │ Billing      │  │              │  │ Provider Router   │ │
│  │ (Stripe)     │  │              │  │ (from existing    │ │
│  └──────────────┘  └──────────────┘  │  ProviderAdapter) │ │
│                                      └────────┬──────────┘ │
│  ┌──────────────┐  ┌──────────────┐           │             │
│  │ PostgreSQL   │  │ Redis        │           │             │
│  │ (users,      │  │ (queue,      │           │             │
│  │  jobs,       │  │  rate limits,│           │             │
│  │  credits)    │  │  cache)      │           │             │
│  └──────────────┘  └──────────────┘           │             │
└───────────────────────────────────────────────┼─────────────┘
                                                │
               ┌────────────────────────────────┤
               │                                │
    ┌──────────▼──────────┐          ┌──────────▼──────────┐
    │   Google Gemini     │          │   FAL.AI (Flux)     │
    │   (relight, edit)   │          │   (bg removal,      │
    │                     │          │    generation)       │
    └─────────────────────┘          └─────────────────────┘
```

## Upload + Processing + Delivery Design

### Upload Flow
1. Frontend: user selects image → validates client-side (type, size ≤20MB)
2. Frontend: `POST /api/upload` → backend returns presigned S3 URL
3. Frontend: uploads directly to S3 via presigned URL
4. Backend: confirms upload, creates `Job` record in PostgreSQL
5. Backend: enqueues enhancement job in Redis queue

### Processing Flow
1. Worker picks job from queue
2. Worker downloads original from S3
3. Worker calls AI provider(s) via `ProviderAdapter` (server-side, with server-held API keys)
4. Worker uploads result to S3
5. Worker updates job status in PostgreSQL
6. Frontend polls `GET /api/jobs/{id}` or receives WebSocket update

### Delivery Flow
1. Frontend: fetches `GET /api/jobs/{id}` → gets result URL
2. Before/after preview rendered client-side
3. "Download HD" → `GET /api/download/{id}` → deducts credit → returns presigned download URL
4. Watermark applied server-side for free-tier users

## AI Provider Abstraction

Przenieść istniejący `ProviderAdapter` pattern z frontendu na backend, zachowując interfejs:

```typescript
// Istniejący interfejs — przenieść na server-side
interface ProviderAdapter {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}

// Nowy routing layer na backendzie
class EnhancementRouter {
  // Route by job type, not just provider
  async enhance(job: EnhancementJob): Promise<EnhancementResult> {
    switch (job.preset) {
      case "white-background":
        return this.bgRemoval.process(job)     // FAL/Flux lub dedykowany model
          .then(r => this.relight.process(r));  // Gemini do oświetlenia
      case "studio-light":
        return this.relight.process(job);       // Gemini
      case "lifestyle":
        return this.sceneGen.process(job);      // Flux img2img
    }
  }
}
```

## Billing and Credits Design

| Komponent | Technologia | Uwagi |
|---|---|---|
| Subscription management | Stripe Subscriptions | Plany miesięczne z credit allotment |
| One-time purchases | Stripe Checkout | Pay-as-you-go credit packs |
| Credit ledger | PostgreSQL table | `user_id, credits_remaining, credits_used, period_start, period_end` |
| Credit deduction | Transactional SQL | Deduct in same transaction as job completion |
| Webhook handling | Stripe webhooks → backend | Subscription renewal → reset credits |
| Free tier | Default plan | 5 credits/month, no payment method required |

## Security Requirements

| Obszar | Wymaganie | Priority |
|---|---|---|
| API keys | Server-side only, encrypted at rest, never sent to browser | **P0** |
| Auth | JWT + refresh tokens, OAuth2 (Google), email verification | **P0** |
| File upload | Validate MIME type server-side, scan for malware, max 20MB | **P0** |
| Rate limiting | Per-user: 10 req/min, per-IP: 30 req/min | **P0** |
| CORS | Strict same-origin, no wildcard | **P1** |
| Content policy | No NSFW detection needed (product photos), but add basic check | **P2** |
| Data retention | Delete processed images after 30 days, originals after 90 | **P1** |
| RODO compliance | Privacy policy, data export, deletion on request | **P1** |

---

# Gap Analysis

## Product Gaps

| Gap | Severity | Why It Matters | Fix | MVP Blocker? |
|---|---|---|---|---|
| Brak value proposition dla end-usera | Krytyczny | Playground ≠ produkt | Redesign UX na "upload → enhance → download" | TAK |
| Brak onboarding flow | Krytyczny | User nie wie co robić | Landing page + guided first-use | TAK |
| Brak enhancement presets | Wysoki | "Generate" ≠ "Enhance my product photo" | Zdefiniować 3 presets + prompt templates server-side | TAK |
| Brak before/after UX | Wysoki | Kluczowy "wow" moment | Dodać slider comparison component | TAK |

## Frontend Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| UI zaprojektowane jako playground, nie produkt | Wysoki | Nowy layout: landing → dashboard → enhance → result | TAK |
| Brak auth UI (login/signup/forgot password) | Krytyczny | Dodać auth pages | TAK |
| Brak dashboard z historią i credit balance | Wysoki | Nowa strona | TAK |
| Brak routingu (single page) | Średni | Dodać React Router | TAK |
| Prompt textarea widoczny dla usera | Średni | Ukryć — enhancement presets zamiast raw promptów | TAK |

## Backend Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| Backend nie istnieje | Krytyczny | Dodać FastAPI lub Next.js API Routes | TAK |
| Brak API proxy dla provider calls | Krytyczny | `/api/enhance` endpoint | TAK |
| Brak async job processing | Wysoki | Redis + worker (Celery/BullMQ) | TAK |
| Brak health check / readiness | Niski | `/health` endpoint | NIE |

## Data Model Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| Brak bazy danych | Krytyczny | PostgreSQL: users, jobs, credits, images | TAK |
| Brak schema / migracji | Krytyczny | Alembic (FastAPI) lub Prisma/Drizzle (Next.js) | TAK |

## Infra Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| Brak Dockera | Średni | Dockerfile + docker-compose | NIE (ale wkrótce) |
| Brak CI/CD | Średni | GitHub Actions: lint + test + build | NIE |
| Brak object storage | Wysoki | S3/GCS bucket + presigned URLs | TAK |
| Brak secrets management | Wysoki | `.env` + Doppler/Vault w produkcji | TAK |

## AI Pipeline Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| Brak background removal pipeline | Krytyczny | Dedykowany model (np. BRIA RMBG via FAL, lub Clipdrop API) | TAK |
| Brak relight/color correction pipeline | Wysoki | Gemini img2img z prompt template | TAK |
| Brak prompt templates (server-side) | Wysoki | Enhancement presets → ukryte prompty | TAK |
| Provider adaptery działają w przeglądarce | Krytyczny | Przenieść na backend | TAK |

## Billing Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| Brak Stripe integration | Krytyczny | Stripe Checkout + Subscriptions + Webhooks | TAK |
| Brak credit systemu | Krytyczny | PostgreSQL ledger + transactional deduction | TAK |
| Brak paywall / gating | Krytyczny | Middleware: check credits before processing | TAK |

## Trust / Safety Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| API keys w przeglądarce | Krytyczny | Backend proxy, keys server-side only | TAK |
| Brak rate limiting | Wysoki | Redis-based per-user + per-IP limits | TAK |
| Brak file validation server-side | Wysoki | MIME check + magic bytes + size limit | TAK |

## Testing Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| Brak E2E testów | Średni | Playwright basic flow | NIE |
| Brak backend testów | Wysoki (po dodaniu backendu) | pytest / vitest | Przy implementacji |
| Istniejące testy pokrywają tylko lib/ | Niski | Dodać component tests po redesignie | NIE |

## Operational Gaps

| Gap | Severity | Fix | MVP Blocker? |
|---|---|---|---|
| Brak error tracking | Średni | Sentry | NIE (ale przed launch) |
| Brak analytics | Średni | PostHog / Mixpanel | NIE (ale przed launch) |
| Brak logging strukturalnego | Średni | pino/structlog | NIE |
| Brak cost monitoring per job | Wysoki | Log provider costs, alert na anomalie | Przed launch |

---

# Roadmap

## NOW — Immediate Cleanup (Tydzień 1)

| # | Cel | Deliverable | Difficulty | Dependencies |
|---|---|---|---|---|
| 1.1 | Usunięcie dead code | Usuń `mockNanoBananaAdapter.ts`, wyczyść import | Low | Brak |
| 1.2 | Synchronizacja dokumentacji | Update `README.md`, archive PRD | Low | Brak |
| 1.3 | Dodanie `.env.example` | Zdefiniuj zmienne środowiskowe | Low | Brak |
| 1.4 | Dodanie CI baseline | GitHub Actions: `npm test` + `tsc --noEmit` | Low | Brak |
| 1.5 | SVG MIME mismatch fix | Usunięcie `image/svg+xml` z model capabilities lub dodanie do upload accept | Low | Brak |

## NEXT — MVP-Enabling Work (Tygodnie 2–5)

| # | Cel | Deliverable | Difficulty | Dependencies |
|---|---|---|---|---|
| 2.1 | Backend scaffold | FastAPI app z `/health`, Docker setup, `.env` management | Medium | 1.3 |
| 2.2 | Auth system | JWT + Google OAuth, user table, login/signup API | Medium | 2.1 |
| 2.3 | Przenieść provider adaptery na backend | `/api/enhance` endpoint, provider keys server-side | Medium | 2.1 |
| 2.4 | Object storage setup | S3 bucket, presigned uploads, asset lifecycle | Medium | 2.1 |
| 2.5 | Database schema + migracje | PostgreSQL: users, jobs, images, credits | Medium | 2.1 |
| 2.6 | Async job queue | Redis + Celery/BullMQ worker dla enhancement jobs | Medium | 2.3, 2.4, 2.5 |
| 2.7 | Enhancement presets + prompt templates | 3 presets server-side, ukryty prompt engineering | Medium | 2.3 |
| 2.8 | Background removal pipeline | Integracja BRIA RMBG lub Clipdrop via provider abstraction | Medium | 2.3 |
| 2.9 | Frontend redesign — product UX | Landing → signup → dashboard → enhance → result | High | 2.2 |
| 2.10 | Before/after preview component | Slider comparison UI | Low | 2.9 |
| 2.11 | Credit system | PostgreSQL ledger, transactional deduction, balance UI | Medium | 2.5 |
| 2.12 | Stripe integration | Checkout, subscriptions, webhooks, credit renewal | High | 2.11 |
| 2.13 | Rate limiting | Redis-based per-user + per-IP | Low | 2.1 |

## LAUNCH — Launch Readiness (Tygodnie 6–8)

| # | Cel | Deliverable | Difficulty | Dependencies |
|---|---|---|---|---|
| 3.1 | Error tracking | Sentry setup (frontend + backend) | Low | 2.9 |
| 3.2 | Analytics | PostHog: signup, enhance, download, upgrade events | Low | 2.9 |
| 3.3 | Watermark dla free tier | Server-side watermark na output images | Low | 2.6 |
| 3.4 | Email transactional | Welcome, receipt, credit low notification | Medium | 2.12 |
| 3.5 | Landing page | Conversion-oriented, before/after examples, pricing | Medium | 2.9 |
| 3.6 | RODO compliance | Privacy policy, data export endpoint, deletion | Medium | 2.2 |
| 3.7 | Cost monitoring | Per-job cost logging, budget alerts | Low | 2.6 |
| 3.8 | Security hardening | CORS, CSP, file validation, input sanitization | Medium | 2.1 |
| 3.9 | E2E tests | Playwright: signup → enhance → download → payment | Medium | 2.9 |
| 3.10 | Deployment pipeline | Docker Compose → hosting (Fly.io / Railway / VPS) | Medium | 2.1 |

## LATER — Post-Launch Growth (Po launchu)

| # | Cel | Difficulty |
|---|---|---|
| 4.1 | Batch upload (≤50 images) | Medium |
| 4.2 | REST API dla integracji | Medium |
| 4.3 | Allegro / Amazon listing integrations | High |
| 4.4 | Custom enhancement prompts (pro tier) | Low |
| 4.5 | Team accounts + shared credit pools | Medium |
| 4.6 | White-label / embed SDK | High |
| 4.7 | Mobile responsive app (PWA) | Medium |
| 4.8 | Video frame enhancement | High |

---

# First Implementation Slice

## Propozycja: Backend Proxy + Server-Side Provider Routing

**Dlaczego to tworzy największy leverage:** Każdy inny milestone (auth, billing, jobs, rate limiting, enhancement pipelines) zależy od istnienia backendu. Bez tego nic innego nie ruszy. Jednocześnie ten slice natychmiast eliminuje krytyczne ryzyko bezpieczeństwa (API keys w przeglądarce).

### Exact Scope

1. **Scaffold FastAPI backend** w `backend/` directory
   - `backend/app/main.py` — FastAPI app z CORS, health check
   - `backend/app/config.py` — settings z `.env` (API keys, allowed origins)
   - `backend/requirements.txt` — fastapi, uvicorn, httpx, python-dotenv
   - `Dockerfile` + `docker-compose.yml`

2. **Przenieść provider logic na backend**
   - `backend/app/providers/contracts.py` — port z `src/lib/provider/contracts.ts`
   - `backend/app/providers/gemini.py` — port z `geminiAdapter.ts`
   - `backend/app/providers/fal.py` — port z `falAdapter.ts`
   - `backend/app/providers/router.py` — port z `createProviderAdapter.ts`
   - `backend/app/api/generate.py` — `POST /api/generate` endpoint

3. **Zaktualizować frontend**
   - `src/lib/provider/backendAdapter.ts` — nowy adapter: `fetch("/api/generate", ...)`
   - `src/lib/provider/createProviderAdapter.ts` — zamienić routing na single backend call
   - Usunąć API key field z UI (klucze teraz server-side)
   - `vite.config.ts` — dodać proxy `/api` → `localhost:8000`

4. **Dodać `.env.example`**
   ```
   GEMINI_API_KEY=
   FAL_API_KEY=
   ALLOWED_ORIGINS=http://localhost:5173
   ```

### Touched Files

| Plik | Akcja |
|---|---|
| `backend/` (nowy directory) | CREATE |
| `backend/app/main.py` | CREATE |
| `backend/app/config.py` | CREATE |
| `backend/app/providers/contracts.py` | CREATE (port z TS) |
| `backend/app/providers/gemini.py` | CREATE (port z TS) |
| `backend/app/providers/fal.py` | CREATE (port z TS) |
| `backend/app/providers/router.py` | CREATE (port z TS) |
| `backend/app/api/generate.py` | CREATE |
| `backend/requirements.txt` | CREATE |
| `Dockerfile`, `docker-compose.yml` | CREATE |
| `.env.example` | CREATE |
| `src/lib/provider/backendAdapter.ts` | CREATE |
| `src/lib/provider/createProviderAdapter.ts` | MODIFY (use backend) |
| `src/App.tsx` | MODIFY (remove API key field) |
| `src/lib/state.ts` | MODIFY (remove API key persistence) |
| `src/lib/types.ts` | MODIFY (remove apiKey from state) |
| `src/lib/validation.ts` | MODIFY (remove API key validation) |
| `vite.config.ts` | MODIFY (add proxy) |
| `src/lib/provider/geminiAdapter.ts` | ARCHIVE (frontend copy) |
| `src/lib/provider/falAdapter.ts` | ARCHIVE (frontend copy) |
| `src/lib/provider/mockNanoBananaAdapter.ts` | DELETE |

### Acceptance Criteria

1. `docker-compose up` uruchamia frontend (Vite) + backend (FastAPI)
2. `POST /api/generate` z prawidłowym payloadem zwraca obraz z Gemini/FAL
3. API keys NIE są nigdy wysyłane do przeglądarki
4. API keys są czytane z `.env` po stronie backendu
5. Frontend generuje obrazy przez backend proxy bez zmian w UX (poza usunięciem API key field)
6. `GET /health` zwraca `200 OK`
7. Istniejące testy frontendowe dalej przechodzą (z mockowanym fetch)
8. Nowe testy backendowe pokrywają: routing, Gemini adapter, FAL adapter, error handling
9. TypeScript kompiluje się bez błędów
10. CORS skonfigurowany na `ALLOWED_ORIGINS` only

### Tests Needed

**Backend (pytest):**
- `test_health_endpoint` — GET /health returns 200
- `test_generate_gemini_routing` — request z google model → gemini adapter
- `test_generate_fal_routing` — request z fal model → fal adapter
- `test_generate_missing_fields` — 422 na brakujące pola
- `test_generate_provider_error` — upstream error → 502
- `test_cors_allowed_origin` — CORS headers present
- `test_cors_disallowed_origin` — CORS blocked

**Frontend (vitest):**
- Update `routing.test.ts` — mock `/api/generate` zamiast direct provider calls
- `backendAdapter.test.ts` — nowy adapter poprawnie formatuje request/response

### Rollout Risk

| Ryzyko | Mitygacja |
|---|---|
| Breaking change w UI (usunięcie API key) | Feature flag: `USE_BACKEND_PROXY=true` w `.env`, zachowaj direct adapters jako fallback w dev |
| Backend performance (latency overhead) | Minimalna — proxy dodaje <50ms, provider calls to 3–15s |
| Docker complexity | `docker-compose.yml` z hot-reload dla dev, proste |
| Provider API changes | Istniejące adaptery są przetestowane, port 1:1 |

---

# Open Questions

1. **Który hosting docelowo?** Fly.io / Railway / VPS / Vercel+serverless? → Wpływa na architekturę async jobs (Celery vs serverless functions vs BullMQ).

2. **FastAPI (Python) czy Node.js backend?** Python daje lepszy ekosystem ML/image processing (Pillow, OpenCV). Node daje jednolity stack z frontendem. `[RECOMMENDATION: FastAPI]` ze względu na przyszłe pipelines image processing.

3. **Który model do background removal?** BRIA RMBG (via FAL), Clipdrop API, lub self-hosted U2-Net? → Wpływa na koszt per image i jakość.

4. **Rynek docelowy — Polska czy globalny?** → Wpływa na język UI, payment methods (BLIK?), compliance requirements, cennik.

5. **Czy istniejący "playground" mode powinien przetrwać jako dev/admin tool?** → Zachowanie surowego prompt interfejsu dla wewnętrznego testowania modeli przy jednoczesnym budowaniu produktowego UX.

6. **Budżet na provider API costs w fazie MVP?** → Determinuje wybór modeli (Flux Schnell = tani ale niższa jakość vs Gemini Pro = droższy ale lepszy).

7. **Czy watermark na free tier to wystarczające gating, czy hard paywall na download?** → Wpływa na conversion rate i UX.
