import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { processImage } from "../src/processors/fal-processor.js";

/**
 * FAL processor tests.
 *
 * All FAL HTTP calls and CDN downloads are intercepted via vi.stubGlobal so
 * no real network traffic is made.  FAL_API_KEY is set to a dummy value; the
 * test verifies that it is forwarded in the Authorization header.
 *
 * Test coverage
 * -------------
 * - correct FAL model called per preset
 * - Authorization header carries FAL_API_KEY
 * - marketplace-ready / studio-polish prompts reach the Kontext payload
 * - clean-background uses background-removal model
 * - response shape: filename / mimeType / processedUrl prefix per MIME
 * - output bytes are valid images (decodable by sharp post-processing)
 * - 401 -> FalError "authentication failed"
 * - 422 -> FalError "rejected the request"
 * - 429 -> FalError "rate limit"
 * - 5xx -> FalError "temporarily unavailable"
 * - timeout (AbortError) -> FalError "timed out"
 * - network TypeError -> FalError "network error"
 * - malformed API response shape -> FalError "unexpected response"
 */

// ---------------------------------------------------------------------------
// Minimal valid test images (4x4, generated with sharp)
// ---------------------------------------------------------------------------

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4MS0FjhiI4wAA4dIcIR+QGUQAAAAASUVORK5CYII=";
const JPEG_B64 =
  "/9j/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ALIAKLn/2Q==";
const WEBP_B64 =
  "UklGRjgAAABXRUJQVlA4ICwAAADwAQCdASoEAAQAAQAcJaACdLoB+AAETAAA/u8VB/5glfkG7UP/kpr/G3HYAA==";

const PNG_BUF = Buffer.from(PNG_B64, "base64");
const JPEG_BUF = Buffer.from(JPEG_B64, "base64");
const WEBP_BUF = Buffer.from(WEBP_B64, "base64");

// ---------------------------------------------------------------------------
// Mock fetch helpers
// ---------------------------------------------------------------------------

const CDN_URL = "https://fal.media/test/result";

/** Build a fake Response-like object. */
function makeResponse(status: number, body: unknown, bodyBuffer?: Buffer) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    arrayBuffer: async (): Promise<ArrayBuffer> => {
      const buf = bodyBuffer ?? PNG_BUF;
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    },
  };
}

/** FAL API success response for background-removal. */
const BG_REMOVAL_OK = { image: { url: CDN_URL, content_type: "image/png" } };

/** FAL API success response for flux-pro/kontext. */
const KONTEXT_OK = { images: [{ url: CDN_URL, content_type: "image/jpeg", width: 4, height: 4 }] };

/**
 * Create a mock fetch that handles:
 *  - POST to fal.run/* (API call)
 *  - GET to CDN URL (image download)
 */
function stubFetch(opts: {
  apiResponse?: unknown;
  apiStatus?: number;
  cdnBuffer?: Buffer;
  cdnStatus?: number;
  throwOn?: "api" | "cdn" | "both";
  throwTimeout?: boolean;
}) {
  const mockFn = vi.fn(async (url: string, _init?: RequestInit) => {
    const isApi = url.toString().startsWith("https://fal.run/");
    const throwHere =
      opts.throwOn === "both" ||
      (opts.throwOn === "api" && isApi) ||
      (opts.throwOn === "cdn" && !isApi);

    if (throwHere) {
      if (opts.throwTimeout) {
        const err = new Error("The operation was aborted.");
        err.name = "AbortError";
        throw err;
      }
      throw new TypeError("fetch failed");
    }

    if (isApi) {
      return makeResponse(opts.apiStatus ?? 200, opts.apiResponse);
    }
    // CDN download
    return makeResponse(opts.cdnStatus ?? 200, null, opts.cdnBuffer ?? PNG_BUF);
  });

  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

const origFalKey = process.env.FAL_API_KEY;

beforeAll(() => {
  process.env.FAL_API_KEY = "test-fal-key";
});

afterAll(() => {
  if (origFalKey === undefined) delete process.env.FAL_API_KEY;
  else process.env.FAL_API_KEY = origFalKey;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Preset: clean-background
// ---------------------------------------------------------------------------

describe("fal processor — clean-background", () => {
  it("calls fal-ai/background-removal with image data URL", async () => {
    const mockFetch = stubFetch({ apiResponse: BG_REMOVAL_OK });
    await processImage(PNG_BUF, "image/png", "clean-background");

    const [apiCall] = mockFetch.mock.calls;
    const apiUrl = apiCall[0] as string;
    expect(apiUrl).toBe("https://fal.run/fal-ai/background-removal");

    const body = JSON.parse((apiCall[1] as RequestInit).body as string);
    expect(body.image_url).toMatch(/^data:image\/png;base64,/);
  });

  it("sends FAL_API_KEY in Authorization header", async () => {
    stubFetch({ apiResponse: BG_REMOVAL_OK });
    await processImage(PNG_BUF, "image/png", "clean-background");

    const calls = vi.mocked(globalThis.fetch).mock.calls as unknown as Array<[string, RequestInit]>;
    const headers = calls[0][1].headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Key test-fal-key");
  });

  it("returns correct filename / mimeType / processedUrl for PNG", async () => {
    stubFetch({ apiResponse: BG_REMOVAL_OK });
    const result = await processImage(PNG_BUF, "image/png", "clean-background");

    expect(result.filename).toBe("product-clean-background.png");
    expect(result.mimeType).toBe("image/png");
    expect(result.processedUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.processorLabel).toBe("Clean Background enhancement");
  });

  it("returns correct metadata for JPEG input", async () => {
    stubFetch({ apiResponse: BG_REMOVAL_OK, cdnBuffer: PNG_BUF });
    const result = await processImage(JPEG_BUF, "image/jpeg", "clean-background");

    expect(result.filename).toBe("product-clean-background.jpg");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.processedUrl).toMatch(/^data:image\/jpeg;base64,/);
  });
});

// ---------------------------------------------------------------------------
// Preset: marketplace-ready
// ---------------------------------------------------------------------------

describe("fal processor — marketplace-ready", () => {
  it("calls fal-ai/flux-pro/kontext with marketplace prompt", async () => {
    const mockFetch = stubFetch({ apiResponse: KONTEXT_OK, cdnBuffer: JPEG_BUF });
    await processImage(JPEG_BUF, "image/jpeg", "marketplace-ready");

    const [apiCall] = mockFetch.mock.calls;
    const apiUrl = apiCall[0] as string;
    expect(apiUrl).toBe("https://fal.run/fal-ai/flux-pro/kontext");

    const body = JSON.parse((apiCall[1] as RequestInit).body as string);
    expect(body.image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(typeof body.prompt).toBe("string");
    expect(body.prompt.toLowerCase()).toContain("marketplace");
  });

  it("returns correct metadata for JPEG input", async () => {
    stubFetch({ apiResponse: KONTEXT_OK, cdnBuffer: JPEG_BUF });
    const result = await processImage(JPEG_BUF, "image/jpeg", "marketplace-ready");

    expect(result.filename).toBe("product-marketplace-ready.jpg");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.processedUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.processorLabel).toBe("Marketplace Ready enhancement");
  });
});

// ---------------------------------------------------------------------------
// Preset: studio-polish
// ---------------------------------------------------------------------------

describe("fal processor — studio-polish", () => {
  it("calls fal-ai/flux-pro/kontext with studio prompt", async () => {
    const mockFetch = stubFetch({ apiResponse: KONTEXT_OK, cdnBuffer: PNG_BUF });
    await processImage(PNG_BUF, "image/png", "studio-polish");

    const [apiCall] = mockFetch.mock.calls;
    const body = JSON.parse((apiCall[1] as RequestInit).body as string);
    expect(body.prompt.toLowerCase()).toContain("studio");
  });

  it("returns correct metadata for WebP input", async () => {
    stubFetch({ apiResponse: KONTEXT_OK, cdnBuffer: WEBP_BUF });
    const result = await processImage(WEBP_BUF, "image/webp", "studio-polish");

    expect(result.filename).toBe("product-studio-polish.webp");
    expect(result.mimeType).toBe("image/webp");
    expect(result.processedUrl).toMatch(/^data:image\/webp;base64,/);
  });
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

describe("fal processor — error mapping", () => {
  it("401 -> authentication failed message", async () => {
    stubFetch({ apiStatus: 401, apiResponse: { detail: "Unauthorized" } });
    await expect(processImage(PNG_BUF, "image/png", "clean-background")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("authentication failed"),
    });
  });

  it("422 -> rejected the request message", async () => {
    stubFetch({ apiStatus: 422, apiResponse: { detail: "Validation error" } });
    await expect(processImage(PNG_BUF, "image/png", "clean-background")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("rejected"),
    });
  });

  it("429 -> rate limit message", async () => {
    stubFetch({ apiStatus: 429, apiResponse: {} });
    await expect(processImage(PNG_BUF, "image/png", "marketplace-ready")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("rate limit"),
    });
  });

  it("503 -> temporarily unavailable message", async () => {
    stubFetch({ apiStatus: 503, apiResponse: {} });
    await expect(processImage(PNG_BUF, "image/png", "studio-polish")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("temporarily unavailable"),
    });
  });

  it("network error on API call -> network error message", async () => {
    stubFetch({ throwOn: "api" });
    await expect(processImage(PNG_BUF, "image/png", "clean-background")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("network error"),
    });
  });

  it("timeout on API call -> timed out message", async () => {
    stubFetch({ throwOn: "api", throwTimeout: true });
    await expect(processImage(PNG_BUF, "image/png", "clean-background")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("timed out"),
    });
  });

  it("network error on CDN download -> network error message", async () => {
    stubFetch({ apiResponse: BG_REMOVAL_OK, throwOn: "cdn" });
    await expect(processImage(PNG_BUF, "image/png", "clean-background")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("network error"),
    });
  });

  it("malformed background-removal response -> unexpected response message", async () => {
    stubFetch({ apiResponse: { unexpected: true } });
    await expect(processImage(PNG_BUF, "image/png", "clean-background")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("unexpected response"),
    });
  });

  it("malformed kontext response -> unexpected response message", async () => {
    stubFetch({ apiResponse: { images: [] } });
    await expect(processImage(PNG_BUF, "image/png", "marketplace-ready")).rejects.toMatchObject({
      kind: "processing",
      message: expect.stringContaining("unexpected response"),
    });
  });
});
