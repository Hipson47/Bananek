import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

import { enhanceRouter } from "../src/routes/enhance.js";

/**
 * Route-level contract tests.
 *
 * These tests cover HTTP behaviour (status codes, response shape, error
 * handling) rather than pixel-level output.  They run with PROCESSOR=mock so
 * that the test suite stays fast and fully deterministic -- the mock is a
 * faithful stand-in for the processor seam used by the route.
 *
 * Pixel-level behaviour of the real sharp processor is covered separately in
 * sharp-processor.test.ts.
 */

// ---------------------------------------------------------------------------
// Test fixtures -- valid 4x4 images that any processor can round-trip
// ---------------------------------------------------------------------------

// 4x4 brown PNG (generated with sharp)
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4MS0FjhiI4wAA4dIcIR+QGUQAAAAASUVORK5CYII=";

// 4x4 brown JPEG (generated with sharp, quality 85)
const TINY_JPEG =
  "data:image/jpeg;base64,/9j/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALIAKLn/2Q==";

// 4x4 brown WebP (generated with sharp, quality 85)
const TINY_WEBP =
  "data:image/webp;base64,UklGRjgAAABXRUJQVlA4ICwAAADwAQCdASoEAAQAAQAcJaACdLoB+AAETAAA/u8VB/5glfkG7UP/kpr/G3HYAA==";

// ---------------------------------------------------------------------------
// Env setup -- use mock processor for route contract tests
// ---------------------------------------------------------------------------

const originalProcessor = process.env.PROCESSOR;
const originalProcessorFallback = process.env.PROCESSOR_FALLBACK;
const originalFalApiKey = process.env.FAL_API_KEY;

beforeAll(() => {
  process.env.PROCESSOR = "mock";
});

afterAll(() => {
  if (originalProcessor === undefined) {
    delete process.env.PROCESSOR;
  } else {
    process.env.PROCESSOR = originalProcessor;
  }

  if (originalProcessorFallback === undefined) {
    delete process.env.PROCESSOR_FALLBACK;
  } else {
    process.env.PROCESSOR_FALLBACK = originalProcessorFallback;
  }

  if (originalFalApiKey === undefined) {
    delete process.env.FAL_API_KEY;
  } else {
    process.env.FAL_API_KEY = originalFalApiKey;
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.PROCESSOR = "mock";
  delete process.env.PROCESSOR_FALLBACK;
  delete process.env.FAL_API_KEY;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = new Hono();
  app.route("/api", enhanceRouter);
  return app;
}

function post(app: Hono, path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp();
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("POST /api/enhance", () => {
  it("returns 200 with correct png response shape", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "clean-background",
      image: TINY_PNG,
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("filename", "product-clean-background.png");
    expect(body).toHaveProperty("mimeType", "image/png");
    expect(body).toHaveProperty("processorLabel", "Clean Background enhancement");
    expect(body.processedUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("returns 200 with correct jpeg response shape", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "marketplace-ready",
      image: TINY_JPEG,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe("product-marketplace-ready.jpg");
    expect(body.mimeType).toBe("image/jpeg");
    expect(body.processorLabel).toBe("Marketplace Ready enhancement");
    expect(body.processedUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("returns 200 with correct webp response shape", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "studio-polish",
      image: TINY_WEBP,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe("product-studio-polish.webp");
    expect(body.mimeType).toBe("image/webp");
    expect(body.processorLabel).toBe("Studio Polish enhancement");
    expect(body.processedUrl).toMatch(/^data:image\/webp;base64,/);
  });

  it("falls back to sharp when PROCESSOR=fal and FAL_API_KEY is missing", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FALLBACK = "sharp";
    delete process.env.FAL_API_KEY;

    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "clean-background",
      image: TINY_PNG,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processorLabel).toBe("Clean Background enhancement");
    expect(body.processedUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("returns a customer-safe 500 when fallback is disabled and processing fails", async () => {
    process.env.PROCESSOR = "fal";
    process.env.PROCESSOR_FALLBACK = "none";
    process.env.FAL_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "marketplace-ready",
      image: TINY_PNG,
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.kind).toBe("processing");
    expect(body.error.message).toBe(
      "We couldn't complete this enhancement. Try again or use a different product image.",
    );
  });

  it("returns 400 for missing preset", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      image: TINY_PNG,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.kind).toBe("validation");
  });

  it("returns 400 for unknown preset", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "super-hd",
      image: TINY_PNG,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.kind).toBe("validation");
    expect(body.error.message).toContain("Unknown or missing preset");
  });

  it("returns 400 for non-data URL image", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "clean-background",
      image: "blob:http://localhost/abc-123",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("data: URL");
  });

  it("returns 400 for invalid JSON body", async () => {
    const app = createApp();
    const res = await app.request("/api/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{{{",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.kind).toBe("validation");
  });

  it("returns 400 for unsupported MIME type", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "clean-background",
      image: "data:image/svg+xml;base64,PHN2Zy8+",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("Unsupported image type");
  });
});
