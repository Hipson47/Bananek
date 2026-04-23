import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/index.js";
import { runJobWorkerOnce } from "../src/jobs/job-worker.js";
import { getEnhancementJob } from "../src/jobs/job-store.js";
import { clearRateLimits } from "../src/security/rate-limiter.js";
import { closeDatabase, getDatabase, resetDatabaseForTests } from "../src/storage/database.js";
import { getConsistencyProfile } from "../src/storage/consistency-profile-store.js";
import { hasStoredObject } from "../src/storage/object-store.js";
import { cleanupExpiredRuntimeState } from "../src/storage/runtime-maintenance.js";
import { getSession } from "../src/storage/session-store.js";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4MS0FjhiI4wAA4dIcIR+QGUQAAAAASUVORK5CYII=";
const TINY_JPEG_B64 =
  "/9j/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALIAKLn/2Q==";

const originalProcessor = process.env.PROCESSOR;
const originalProcessorFailurePolicy = process.env.PROCESSOR_FAILURE_POLICY;
const originalFalApiKey = process.env.FAL_API_KEY;
const originalEnhanceRateLimitMax = process.env.ENHANCE_RATE_LIMIT_MAX;
const originalDefaultSessionCredits = process.env.DEFAULT_SESSION_CREDITS;
const originalDatabasePath = process.env.DATABASE_PATH;
const originalOutputUrlTtlSeconds = process.env.OUTPUT_URL_TTL_SECONDS;
const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;

function createPngFile(): File {
  return new File([Buffer.from(TINY_PNG_B64, "base64")], "shoe.png", {
    type: "image/png",
  });
}

async function bootstrapSession(app: ReturnType<typeof createApp>) {
  const res = await app.request("/api/session", { method: "GET" });
  const body = await res.json();
  const cookie = res.headers.get("set-cookie");

  expect(res.status).toBe(200);
  expect(cookie).toContain("enhancer_session=");

  return {
    cookie: cookie as string,
    sessionId: body.sessionId as string,
  };
}

async function postMultipart(
  app: ReturnType<typeof createApp>,
  init: {
    cookie?: string;
    sessionId?: string;
    file?: File;
    presetId?: string;
  },
) {
  const formData = new FormData();
  formData.append("presetId", init.presetId ?? "clean-background");
  formData.append("image", init.file ?? createPngFile());

  return app.request("/api/enhance", {
    method: "POST",
    headers: {
      ...(init.cookie ? { Cookie: init.cookie } : {}),
      ...(init.sessionId ? { "X-Session-Id": init.sessionId } : {}),
    },
    body: formData,
  });
}

async function expectQueuedJob(
  app: ReturnType<typeof createApp>,
  init: {
    cookie: string;
    sessionId: string;
    presetId?: string;
    file?: File;
  },
) {
  const res = await postMultipart(app, init);
  const body = await res.json();

  expect(res.status).toBe(202);
  expect(body).toEqual({
    jobId: expect.any(String),
    status: "queued",
    statusUrl: expect.stringMatching(/^\/api\/jobs\/[0-9a-f-]+$/i),
  });

  return body as {
    jobId: string;
    status: "queued";
    statusUrl: string;
  };
}

async function fetchJobStatus(app: ReturnType<typeof createApp>, init: {
  cookie: string;
  statusUrl: string;
}) {
  const res = await app.request(init.statusUrl, {
    method: "GET",
    headers: {
      Cookie: init.cookie,
    },
  });

  return {
    res,
    body: await res.json(),
  };
}

async function runQueuedJobAndFetchStatus(
  app: ReturnType<typeof createApp>,
  init: {
    cookie: string;
    statusUrl: string;
  },
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await runJobWorkerOnce();
    const result = await fetchJobStatus(app, init);

    if (result.body.status !== "queued" && result.body.status !== "running") {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  return fetchJobStatus(app, init);
}

beforeAll(() => {
  process.env.PROCESSOR = "mock";
  process.env.PROCESSOR_FAILURE_POLICY = "strict";
  process.env.DEFAULT_SESSION_CREDITS = "2";
  process.env.ENHANCE_RATE_LIMIT_MAX = "10";
  process.env.DATABASE_PATH = "backend/data/test-runtime.sqlite";
});

afterAll(() => {
  if (originalProcessor === undefined) delete process.env.PROCESSOR;
  else process.env.PROCESSOR = originalProcessor;

  if (originalProcessorFailurePolicy === undefined) delete process.env.PROCESSOR_FAILURE_POLICY;
  else process.env.PROCESSOR_FAILURE_POLICY = originalProcessorFailurePolicy;

  if (originalFalApiKey === undefined) delete process.env.FAL_API_KEY;
  else process.env.FAL_API_KEY = originalFalApiKey;

  if (originalEnhanceRateLimitMax === undefined) delete process.env.ENHANCE_RATE_LIMIT_MAX;
  else process.env.ENHANCE_RATE_LIMIT_MAX = originalEnhanceRateLimitMax;

  if (originalDefaultSessionCredits === undefined) delete process.env.DEFAULT_SESSION_CREDITS;
  else process.env.DEFAULT_SESSION_CREDITS = originalDefaultSessionCredits;

  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;

  if (originalOutputUrlTtlSeconds === undefined) delete process.env.OUTPUT_URL_TTL_SECONDS;
  else process.env.OUTPUT_URL_TTL_SECONDS = originalOutputUrlTtlSeconds;

  if (originalOpenRouterApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  clearRateLimits();
  closeDatabase();
  resetDatabaseForTests();
  process.env.PROCESSOR = "mock";
  process.env.PROCESSOR_FAILURE_POLICY = "strict";
  process.env.DEFAULT_SESSION_CREDITS = "2";
  process.env.ENHANCE_RATE_LIMIT_MAX = "10";
  delete process.env.FAL_API_KEY;
  process.env.DATABASE_PATH = "backend/data/test-runtime.sqlite";
  delete process.env.OUTPUT_URL_TTL_SECONDS;
  delete process.env.OPENROUTER_API_KEY;
});

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp();
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});

describe("GET /api/session", () => {
  it("creates a signed session and returns usage state", async () => {
    const app = createApp();
    const res = await app.request("/api/session", { method: "GET" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.creditsRemaining).toBe(2);
    expect(body.creditsUsed).toBe(0);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });
});

describe("POST /api/enhance", () => {
  it("rejects requests without a valid session", async () => {
    const app = createApp();
    const res = await postMultipart(app, {});
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.message).toContain("Valid session required");
  });

  it("rejects requests with a mismatched session header", async () => {
    const app = createApp();
    const { cookie } = await bootstrapSession(app);
    const res = await postMultipart(app, {
      cookie,
      sessionId: "wrong-session-id",
    });

    expect(res.status).toBe(401);
  });

  it("stores processed output and returns a persisted asset URL", async () => {
    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const res = await postMultipart(app, { cookie, sessionId });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.filename).toBe("product-clean-background.png");
    expect(body.mimeType).toBe("image/png");
    expect(body.processorLabel).toBe("Clean Background enhancement");
    expect(body.processedUrl).toMatch(/^\/api\/outputs\/.+\?expires=\d+&sig=/);
    expect(res.headers.get("x-credits-remaining")).toBe("1");

    const assetRes = await app.request(body.processedUrl, {
      method: "GET",
      headers: { Cookie: cookie },
    });

    expect(assetRes.status).toBe(200);
    expect(assetRes.headers.get("content-type")).toBe("image/png");
    expect(assetRes.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await assetRes.arrayBuffer()).length).toBeGreaterThan(0);
  });

  it("rejects corrupt uploaded files even when they claim to be PNG", async () => {
    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const fakeFile = new File(["not an image"], "broken.png", {
      type: "image/png",
    });
    const res = await postMultipart(app, {
      cookie,
      sessionId,
      file: fakeFile,
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toContain("valid supported image");
  });

  it("rejects JSON payloads whose bytes do not match the declared MIME type", async () => {
    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const res = await app.request("/api/enhance", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-Session-Id": sessionId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        presetId: "clean-background",
        image: `data:image/png;base64,${TINY_JPEG_B64}`,
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toContain("does not match");
  });

  it("enforces per-session credits", async () => {
    process.env.DEFAULT_SESSION_CREDITS = "1";
    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);

    const first = await postMultipart(app, { cookie, sessionId });
    expect(first.status).toBe(200);

    const second = await postMultipart(app, { cookie, sessionId });
    const body = await second.json();
    expect(second.status).toBe(402);
    expect(body.error.message).toContain("No credits remaining");
  });

  it("enforces rate limiting", async () => {
    process.env.ENHANCE_RATE_LIMIT_MAX = "1";
    process.env.DEFAULT_SESSION_CREDITS = "5";
    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);

    const first = await postMultipart(app, { cookie, sessionId });
    expect(first.status).toBe(200);

    const second = await postMultipart(app, { cookie, sessionId });
    const body = await second.json();
    expect(second.status).toBe(429);
    expect(body.error.message).toContain("Too many enhancement requests");
  });

  it("persists session credits and outputs across database restarts", async () => {
    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const enhanceRes = await postMultipart(app, { cookie, sessionId });
    const enhanceBody = await enhanceRes.json();

    expect(enhanceRes.status).toBe(200);
    expect(enhanceRes.headers.get("x-credits-remaining")).toBe("1");

    closeDatabase();

    const restartedApp = createApp();
    const session = await getSession(sessionId);
    expect(session?.creditsRemaining).toBe(1);
    expect(session?.creditsUsed).toBe(1);

    const outputRes = await restartedApp.request(enhanceBody.processedUrl, {
      method: "GET",
      headers: { Cookie: cookie },
    });

    expect(outputRes.status).toBe(200);
    expect(outputRes.headers.get("content-type")).toBe("image/png");
  });

  it("keeps rate limits after database restart", async () => {
    process.env.ENHANCE_RATE_LIMIT_MAX = "1";
    process.env.DEFAULT_SESSION_CREDITS = "5";
    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);

    const first = await postMultipart(app, { cookie, sessionId });
    expect(first.status).toBe(200);

    closeDatabase();

    const restartedApp = createApp();
    const second = await postMultipart(restartedApp, { cookie, sessionId });
    const body = await second.json();

    expect(second.status).toBe(429);
    expect(body.error.message).toContain("Too many enhancement requests");
  });

  it("keeps credit consumption atomic under concurrent requests", async () => {
    process.env.DEFAULT_SESSION_CREDITS = "1";
    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);

    const [first, second] = await Promise.all([
      postMultipart(app, { cookie, sessionId }),
      postMultipart(app, { cookie, sessionId }),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const session = await getSession(sessionId);
    expect(session?.creditsRemaining).toBe(0);
    expect(session?.creditsUsed).toBe(1);
  });

  it("falls back only when the failure policy explicitly allows it", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FAILURE_POLICY = "fallback-to-sharp";
    delete process.env.FAL_API_KEY;

    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const acceptedJob = await expectQueuedJob(app, { cookie, sessionId });
    const { res, body } = await runQueuedJobAndFetchStatus(app, {
      cookie,
      statusUrl: acceptedJob.statusUrl,
    });

    expect(res.status).toBe(200);
    expect(body.filename).toBe("product-clean-background.png");
    expect(body.mimeType).toBe("image/png");
    expect(body.processedUrl).toMatch(/^\/api\/outputs\/.+\?expires=\d+&sig=/);
  });

  it("returns a failed async job and refunds credits when fal fails under strict policy", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FAILURE_POLICY = "strict";
    process.env.FAL_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const acceptedJob = await expectQueuedJob(app, { cookie, sessionId });
    const { res, body } = await runQueuedJobAndFetchStatus(app, {
      cookie,
      statusUrl: acceptedJob.statusUrl,
    });

    expect(res.status).toBe(200);
    expect(body.status).toBe("failed");
    expect(body.error.kind).toBe("processing");
    expect(body.error.message).toBe(
      "We couldn't complete this enhancement. Try again or use a different product image.",
    );

    const session = await getSession(sessionId);
    expect(session?.creditsRemaining).toBe(2);
    expect(session?.creditsUsed).toBe(0);
  });

  it("cleans up expired outputs before serving them", async () => {
    process.env.DEFAULT_SESSION_CREDITS = "2";
    process.env.OUTPUT_URL_TTL_SECONDS = "1";
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_700_000_000_000);

    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const enhanceRes = await postMultipart(app, { cookie, sessionId });
    const enhanceBody = await enhanceRes.json();

    nowSpy.mockReturnValue(1_700_000_000_000 + 2_000);
    await cleanupExpiredRuntimeState(Date.now());

    const outputRes = await app.request(enhanceBody.processedUrl, {
      method: "GET",
      headers: { Cookie: cookie },
    });

    expect(outputRes.status).toBe(404);
  });

  it("freezes config for an app instance after startup", async () => {
    process.env.PROCESSOR = "mock";
    const app = createApp();
    process.env.PROCESSOR = "fal";
    process.env.FAL_API_KEY = "should-not-be-used";

    const { cookie, sessionId } = await bootstrapSession(app);
    const res = await postMultipart(app, { cookie, sessionId });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processorLabel).toBe("Clean Background enhancement");
    expect(body.filename).toBe("product-clean-background.png");
  });

  it("does not return success when final verification still fails", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FAILURE_POLICY = "strict";
    process.env.FAL_API_KEY = "test-fal-key";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const requestUrl = String(url);

      if (requestUrl === "https://openrouter.ai/api/v1/chat/completions") {
        const body = JSON.parse(String(init?.body));
        const schemaName = body.response_format?.json_schema?.name;

        const bySchema: Record<string, unknown> = {
          intent_spec: {
            presetId: "marketplace-ready",
            customerGoal: null,
            primaryObjective: "deliver a marketplace-ready listing image",
            backgroundGoal: "pure-white",
            framingGoal: "square-centered",
            lightingGoal: "catalog-clean",
            detailGoal: "catalog-clarity",
            realismGuard: "strict",
            emphasis: ["square framing", "white background"],
          },
          shot_plan_candidates: {
            candidates: [
              {
                candidateId: "option-a",
                title: "Weak plan",
                framing: "balanced-centered",
                background: "clean-white",
                lighting: "catalog-clean",
                crop: "balanced",
                rationale: "first",
                fitScore: 0.7,
                riskFlags: [],
              },
              {
                candidateId: "option-b",
                title: "Alternate weak plan",
                framing: "tight-product",
                background: "neutral",
                lighting: "neutral-lift",
                crop: "tight",
                rationale: "second",
                fitScore: 0.68,
                riskFlags: [],
              },
              {
                candidateId: "option-c",
                title: "Fallback weak plan",
                framing: "balanced-centered",
                background: "clean-white",
                lighting: "catalog-clean",
                crop: "balanced",
                rationale: "third",
                fitScore: 0.65,
                riskFlags: [],
              },
            ],
          },
          consistency_spec: {
            selectionMode: "selected",
            selectedCandidateIds: ["option-a"],
            finalFraming: "balanced-centered",
            finalBackground: "clean-white",
            finalLighting: "catalog-clean",
            finalCrop: "balanced",
            keepConstraints: ["preserve product geometry"],
            avoidConstraints: ["no extra props"],
            rationale: "best available candidate",
          },
          prompt_package: {
            masterPrompt: "Marketplace-ready product image.",
            negativePrompt: "extra props, color shift",
            consistencyRules: ["keep product identity"],
            compositionRules: ["keep centered framing"],
            brandSafetyRules: ["do not add objects"],
            recoveryPrompt: "retry with more cleanup",
            subjectClause: "Preserve the product.",
            sceneClause: "Use a commerce-friendly scene.",
            lightingClause: "Use catalog lighting.",
            detailClause: "Preserve details.",
            constraintClauses: ["preserve product geometry"],
            negativeClauses: ["no extra props"],
            executionNotes: ["preset:marketplace-ready", "variant:primary"],
            guidanceScale: 3.8,
          },
          verification_decision: {
            decision: "retry",
            confidence: 0.91,
            reasons: ["output still misses marketplace criteria"],
            promptAdjustments: ["increase cleanup strength"],
            guidanceScaleAdjustment: 1,
          },
        };

        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: "openai/gpt-4.1-mini",
            choices: [{ message: { content: JSON.stringify(bySchema[schemaName]) } }],
          }),
        };
      }

      if (requestUrl.startsWith("https://fal.run/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            images: [{ url: "https://fal.media/test/failing-result", content_type: "image/jpeg" }],
          }),
        };
      }

      if (requestUrl === "https://fal.media/test/failing-result") {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name: string) => name.toLowerCase() === "content-length"
              ? String(Buffer.from(TINY_JPEG_B64, "base64").byteLength)
              : null,
          },
          arrayBuffer: async () => {
            const buffer = Buffer.from(TINY_JPEG_B64, "base64");
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
          },
        };
      }

      throw new Error(`Unexpected fetch URL: ${requestUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const acceptedJob = await expectQueuedJob(app, {
      cookie,
      sessionId,
      presetId: "marketplace-ready",
      file: createPngFile(),
    });
    const { res, body } = await runQueuedJobAndFetchStatus(app, {
      cookie,
      statusUrl: acceptedJob.statusUrl,
    });

    expect(res.status).toBe(200);
    expect(body.status).toBe("failed");
    expect(body.error.kind).toBe("processing");
    expect(body.error.message).toBe(
      "We couldn't complete this enhancement. Try again or use a different product image.",
    );
  });

  it("runs the FAL path through OpenRouter planning while keeping the response contract stable", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FAILURE_POLICY = "strict";
    process.env.FAL_API_KEY = "test-fal-key";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const marketplaceOutputBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 3,
        background: { r: 252, g: 252, b: 252 },
      },
    }).png().toBuffer();

    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const requestUrl = String(url);

      if (requestUrl === "https://openrouter.ai/api/v1/chat/completions") {
        const body = JSON.parse(String(init?.body));
        const schemaName = body.response_format?.json_schema?.name;

        const bySchema: Record<string, unknown> = {
          intent_spec: {
            presetId: "marketplace-ready",
            customerGoal: null,
            primaryObjective: "deliver a marketplace-ready listing image",
            backgroundGoal: "pure-white",
            framingGoal: "square-centered",
            lightingGoal: "catalog-clean",
            detailGoal: "catalog-clarity",
            realismGuard: "strict",
            emphasis: ["square framing", "white background"],
          },
          shot_plan_candidates: {
            candidates: [
              {
                candidateId: "option-a",
                title: "Balanced listing",
                framing: "square-centered",
                background: "pure-white",
                lighting: "catalog-clean",
                crop: "balanced",
                rationale: "best fit",
                fitScore: 0.95,
                riskFlags: [],
              },
              {
                candidateId: "option-b",
                title: "Tighter crop",
                framing: "tight-product",
                background: "pure-white",
                lighting: "catalog-clean",
                crop: "tight",
                rationale: "secondary",
                fitScore: 0.75,
                riskFlags: [],
              },
              {
                candidateId: "option-c",
                title: "Safer crop",
                framing: "balanced-centered",
                background: "clean-white",
                lighting: "neutral-lift",
                crop: "balanced",
                rationale: "fallback",
                fitScore: 0.65,
                riskFlags: [],
              },
            ],
          },
          consistency_spec: {
            selectionMode: "selected",
            selectedCandidateIds: ["option-a"],
            finalFraming: "square-centered",
            finalBackground: "pure-white",
            finalLighting: "catalog-clean",
            finalCrop: "balanced",
            keepConstraints: ["preserve product geometry", "preserve visible branding"],
            avoidConstraints: ["no extra props", "no color shift"],
            rationale: "Select the most commerce-ready candidate.",
          },
          prompt_package: {
            masterPrompt: "Create a marketplace-ready product image on a pure white background with centered framing.",
            negativePrompt: "extra props, color shift, distorted geometry",
            consistencyRules: ["keep pure white background", "keep catalog lighting"],
            compositionRules: ["center the product in a square crop", "preserve balanced margins"],
            brandSafetyRules: ["do not alter the product identity", "do not add extra objects"],
            recoveryPrompt: "retry with stronger white background cleanup and square centering",
            subjectClause: "Preserve the real product exactly.",
            sceneClause: "Use a pure white background with square centered framing.",
            lightingClause: "Apply clean catalog lighting.",
            detailClause: "Keep sharp detail and realistic materials.",
            constraintClauses: ["preserve product geometry", "preserve visible branding"],
            negativeClauses: ["no extra props", "no color shift"],
            executionNotes: ["preset:marketplace-ready", "variant:primary"],
            guidanceScale: 3.8,
          },
          verification_decision: {
            decision: "accept",
            confidence: 0.92,
            reasons: [],
            promptAdjustments: [],
            guidanceScaleAdjustment: 0,
          },
        };

        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: "openai/gpt-4.1-mini",
            choices: [{ message: { content: JSON.stringify(bySchema[schemaName]) } }],
          }),
        };
      }

      if (requestUrl.startsWith("https://fal.run/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            images: [{ url: "https://fal.media/test/result", content_type: "image/jpeg" }],
          }),
        };
      }

      if (requestUrl === "https://fal.media/test/result") {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name: string) => name.toLowerCase() === "content-length"
              ? String(marketplaceOutputBuffer.byteLength)
              : null,
          },
          arrayBuffer: async () => {
            const buffer = marketplaceOutputBuffer;
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
          },
        };
      }

      throw new Error(`Unexpected fetch URL: ${requestUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const acceptedJob = await expectQueuedJob(app, {
      cookie,
      sessionId,
      presetId: "marketplace-ready",
      file: createPngFile(),
    });
    const { res, body } = await runQueuedJobAndFetchStatus(app, {
      cookie,
      statusUrl: acceptedJob.statusUrl,
    });

    expect(res.status).toBe(200);
    expect(body.filename).toBe("product-marketplace-ready.png");
    expect(body.mimeType).toBe("image/png");
    expect(body.processedUrl).toMatch(/^\/api\/outputs\/.+\?expires=\d+&sig=/);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("openrouter.ai"))).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("fal.run"))).toBe(true);
  });

  it("persists async job records, consistency memory, and node telemetry for FAL jobs", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FAILURE_POLICY = "strict";
    process.env.FAL_API_KEY = "test-fal-key";
    process.env.OPENROUTER_API_KEY = "test-openrouter-key";
    const marketplaceOutputBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 3,
        background: { r: 252, g: 252, b: 252 },
      },
    }).png().toBuffer();

    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
      const requestUrl = String(url);

      if (requestUrl === "https://openrouter.ai/api/v1/chat/completions") {
        const body = JSON.parse(String(init?.body));
        const schemaName = body.response_format?.json_schema?.name;

        const bySchema: Record<string, unknown> = {
          intent_spec: {
            presetId: "marketplace-ready",
            customerGoal: null,
            primaryObjective: "deliver a marketplace-ready listing image",
            backgroundGoal: "pure-white",
            framingGoal: "square-centered",
            lightingGoal: "catalog-clean",
            detailGoal: "catalog-clarity",
            realismGuard: "strict",
            emphasis: ["square framing", "white background"],
          },
          shot_plan_candidates: {
            candidates: [
              {
                candidateId: "option-a",
                title: "Balanced listing",
                framing: "square-centered",
                background: "pure-white",
                lighting: "catalog-clean",
                crop: "balanced",
                rationale: "best fit",
                fitScore: 0.95,
                riskFlags: [],
              },
              {
                candidateId: "option-b",
                title: "Tighter crop",
                framing: "tight-product",
                background: "pure-white",
                lighting: "catalog-clean",
                crop: "tight",
                rationale: "secondary",
                fitScore: 0.75,
                riskFlags: [],
              },
              {
                candidateId: "option-c",
                title: "Safer crop",
                framing: "balanced-centered",
                background: "clean-white",
                lighting: "neutral-lift",
                crop: "balanced",
                rationale: "fallback",
                fitScore: 0.65,
                riskFlags: [],
              },
            ],
          },
          consistency_spec: {
            selectionMode: "selected",
            selectedCandidateIds: ["option-a"],
            finalFraming: "square-centered",
            finalBackground: "pure-white",
            finalLighting: "catalog-clean",
            finalCrop: "balanced",
            keepConstraints: ["preserve product geometry", "preserve visible branding"],
            avoidConstraints: ["no extra props", "no color shift"],
            rationale: "Select the most commerce-ready candidate.",
          },
          prompt_package: {
            masterPrompt: "Create a marketplace-ready product image on a pure white background with centered framing.",
            negativePrompt: "extra props, color shift, distorted geometry",
            consistencyRules: ["keep pure white background", "keep catalog lighting"],
            compositionRules: ["center the product in a square crop", "preserve balanced margins"],
            brandSafetyRules: ["do not alter the product identity", "do not add extra objects"],
            recoveryPrompt: "retry with stronger white background cleanup and square centering",
            subjectClause: "Preserve the real product exactly.",
            sceneClause: "Use a pure white background with square centered framing.",
            lightingClause: "Apply clean catalog lighting.",
            detailClause: "Keep sharp detail and realistic materials.",
            constraintClauses: ["preserve product geometry", "preserve visible branding"],
            negativeClauses: ["no extra props", "no color shift"],
            executionNotes: ["preset:marketplace-ready", "variant:primary"],
            guidanceScale: 3.8,
          },
          verification_decision: {
            decision: "accept",
            confidence: 0.92,
            reasons: [],
            promptAdjustments: [],
            guidanceScaleAdjustment: 0,
          },
        };

        return {
          ok: true,
          status: 200,
          json: async () => ({
            model: "openai/gpt-4.1-mini",
            choices: [{ message: { content: JSON.stringify(bySchema[schemaName]) } }],
          }),
        };
      }

      if (requestUrl.startsWith("https://fal.run/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            images: [{ url: "https://fal.media/test/result", content_type: "image/jpeg" }],
          }),
        };
      }

      if (requestUrl === "https://fal.media/test/result") {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (name: string) => name.toLowerCase() === "content-length"
              ? String(marketplaceOutputBuffer.byteLength)
              : null,
          },
          arrayBuffer: async () => {
            const buffer = marketplaceOutputBuffer;
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
          },
        };
      }

      throw new Error(`Unexpected fetch URL: ${requestUrl}`);
    }));

    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const acceptedJob = await expectQueuedJob(app, {
      cookie,
      sessionId,
      presetId: "marketplace-ready",
      file: createPngFile(),
    });
    const { body } = await runQueuedJobAndFetchStatus(app, {
      cookie,
      statusUrl: acceptedJob.statusUrl,
    });

    const job = await getEnhancementJob({
      sessionId,
      jobId: acceptedJob.jobId,
    });
    const consistency = await getConsistencyProfile(`session:${sessionId}:preset:marketplace-ready`);
    const metricRows = getDatabase().prepare(`
      SELECT node_name
      FROM job_node_metrics
      WHERE job_id = ?
      ORDER BY id ASC
    `).all(acceptedJob.jobId) as Array<{ node_name: string }>;

    expect(body.processedUrl).toMatch(/^\/api\/outputs\/.+\?expires=\d+&sig=/);
    expect(job?.status).toBe("succeeded");
    expect(job?.telemetrySummary).toMatchObject({
      finalOutcomeClass: "succeeded",
    });
    expect(job?.processorPath?.length).toBeGreaterThan(0);
    expect(consistency?.memory.backgroundStyle).toBeTruthy();
    expect(metricRows.map((row) => row.node_name)).toEqual(expect.arrayContaining([
      "analyze",
      "execute",
      "verify",
    ]));
  });

  it("stores async outputs in object storage and deletes expired files during cleanup", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FAILURE_POLICY = "fallback-to-sharp";
    delete process.env.FAL_API_KEY;
    process.env.OUTPUT_URL_TTL_SECONDS = "1";
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(1_700_000_000_000);

    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const acceptedJob = await expectQueuedJob(app, {
      cookie,
      sessionId,
      presetId: "clean-background",
    });
    const { body } = await runQueuedJobAndFetchStatus(app, {
      cookie,
      statusUrl: acceptedJob.statusUrl,
    });

    const job = await getEnhancementJob({
      sessionId,
      jobId: acceptedJob.jobId,
    });
    const outputRecord = job?.outputId
      ? await getDatabase().prepare(`
        SELECT storage_key
        FROM outputs
        WHERE id = ?
      `).get(job.outputId) as { storage_key: string } | undefined
      : undefined;

    expect(outputRecord?.storage_key).toBeTruthy();
    expect(await hasStoredObject(outputRecord!.storage_key)).toBe(true);

    nowSpy.mockReturnValue(1_700_000_000_000 + 2_000);
    await cleanupExpiredRuntimeState(Date.now());

    expect(await hasStoredObject(outputRecord!.storage_key)).toBe(false);

    const outputRes = await app.request(body.processedUrl, {
      method: "GET",
      headers: { Cookie: cookie },
    });
    expect(outputRes.status).toBe(404);
  });
});
