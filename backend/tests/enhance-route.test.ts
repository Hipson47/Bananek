import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/index.js";
import { clearRateLimits } from "../src/security/rate-limiter.js";
import { closeDatabase, resetDatabaseForTests } from "../src/storage/database.js";
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
    const res = await postMultipart(app, { cookie, sessionId });

    expect(res.status).toBe(200);
  });

  it("returns a customer-safe 500 when fal fails under strict policy", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FAILURE_POLICY = "strict";
    process.env.FAL_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const app = createApp();
    const { cookie, sessionId } = await bootstrapSession(app);
    const res = await postMultipart(app, { cookie, sessionId });
    const body = await res.json();

    expect(res.status).toBe(500);
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

    const outputRes = await app.request(enhanceBody.processedUrl, {
      method: "GET",
      headers: { Cookie: cookie },
    });

    expect(outputRes.status).toBe(404);
  });
});
