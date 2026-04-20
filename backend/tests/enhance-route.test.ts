import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import { enhanceRouter } from "../src/routes/enhance.js";

// Minimal valid 1x1 red pixel PNG as data URL
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const TINY_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
const TINY_WEBP = "data:image/webp;base64,UklGRgAAAABXRUJQVlA4TA==";

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

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const app = createApp();
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("POST /api/enhance", () => {
  it("preserves png metadata when the mock processor returns the original bytes", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "clean-background",
      image: TINY_PNG,
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("filename", "product-clean-background.png");
    expect(body).toHaveProperty("mimeType", "image/png");
    expect(body).toHaveProperty("processorLabel");
    expect(body.processedUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("preserves jpeg metadata when the mock processor returns the original bytes", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "marketplace-ready",
      image: TINY_JPEG,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe("product-marketplace-ready.jpg");
    expect(body.mimeType).toBe("image/jpeg");
    expect(body.processedUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("preserves webp metadata when the mock processor returns the original bytes", async () => {
    const app = createApp();
    const res = await post(app, "/api/enhance", {
      presetId: "studio-polish",
      image: TINY_WEBP,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe("product-studio-polish.webp");
    expect(body.mimeType).toBe("image/webp");
    expect(body.processedUrl).toMatch(/^data:image\/webp;base64,/);
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
