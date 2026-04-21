import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { processImage } from "../src/processors/sharp-processor.js";

/**
 * Sharp processor behaviour tests.
 *
 * These tests call the sharp processor directly (bypassing the HTTP route) to
 * verify that real image transformation actually occurs.  Each test uses a
 * larger source image so that resize, flatten, and modulate operations have
 * visible effect.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a solid-colour RGBA test image of arbitrary size using sharp. */
async function makePng(
  width: number,
  height: number,
  r = 180, g = 120, b = 60,
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
}

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function makeWebp(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } },
  })
    .webp({ quality: 85 })
    .toBuffer();
}

/** Decode the base64 portion of a data URL back to a Buffer. */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

// ---------------------------------------------------------------------------
// Contract shape
// ---------------------------------------------------------------------------

describe("sharp processor — response contract", () => {
  it("returns correct filename, mimeType and data URL prefix for PNG", async () => {
    const src = await makePng(100, 100);
    const result = await processImage(src, "image/png", "clean-background");

    expect(result.filename).toBe("product-clean-background.png");
    expect(result.mimeType).toBe("image/png");
    expect(result.processedUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.processorLabel).toBe("Clean Background enhancement");
  });

  it("returns correct filename, mimeType and data URL prefix for JPEG", async () => {
    const src = await makeJpeg(100, 100);
    const result = await processImage(src, "image/jpeg", "marketplace-ready");

    expect(result.filename).toBe("product-marketplace-ready.jpg");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.processedUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.processorLabel).toBe("Marketplace Ready enhancement");
  });

  it("returns correct filename, mimeType and data URL prefix for WebP", async () => {
    const src = await makeWebp(100, 100);
    const result = await processImage(src, "image/webp", "studio-polish");

    expect(result.filename).toBe("product-studio-polish.webp");
    expect(result.mimeType).toBe("image/webp");
    expect(result.processedUrl).toMatch(/^data:image\/webp;base64,/);
    expect(result.processorLabel).toBe("Studio Polish enhancement");
  });
});

// ---------------------------------------------------------------------------
// Output differs from input (real transformation occurred)
// ---------------------------------------------------------------------------

describe("sharp processor — output differs from input", () => {
  it("clean-background: output bytes differ from input", async () => {
    const src = await makePng(200, 150);
    const result = await processImage(src, "image/png", "clean-background");
    const out = dataUrlToBuffer(result.processedUrl);
    // The pipeline re-encodes; bytes must differ from the original
    expect(out.equals(src)).toBe(false);
  });

  it("marketplace-ready: output bytes differ from input", async () => {
    const src = await makeJpeg(200, 150);
    const result = await processImage(src, "image/jpeg", "marketplace-ready");
    const out = dataUrlToBuffer(result.processedUrl);
    expect(out.equals(src)).toBe(false);
  });

  it("studio-polish: output bytes differ from input", async () => {
    const src = await makeWebp(200, 150);
    const result = await processImage(src, "image/webp", "studio-polish");
    const out = dataUrlToBuffer(result.processedUrl);
    expect(out.equals(src)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Output is a valid decodable image
// ---------------------------------------------------------------------------

describe("sharp processor — output is valid image", () => {
  it("clean-background output is decodable by sharp", async () => {
    const src = await makePng(100, 100);
    const result = await processImage(src, "image/png", "clean-background");
    const out = dataUrlToBuffer(result.processedUrl);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBeGreaterThan(0);
    expect(meta.height).toBeGreaterThan(0);
  });

  it("marketplace-ready output is decodable by sharp and is square", async () => {
    // Non-square input: marketplace-ready contains it inside 1000x1000
    const src = await makeJpeg(400, 200);
    const result = await processImage(src, "image/jpeg", "marketplace-ready");
    const out = dataUrlToBuffer(result.processedUrl);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    // contain fit pads to square
    expect(meta.width).toBe(meta.height);
  });

  it("studio-polish output is decodable by sharp", async () => {
    const src = await makeWebp(100, 100);
    const result = await processImage(src, "image/webp", "studio-polish");
    const out = dataUrlToBuffer(result.processedUrl);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Resize behaviour
// ---------------------------------------------------------------------------

describe("sharp processor — resize constraints", () => {
  it("clean-background does not enlarge images smaller than 1200px", async () => {
    const src = await makePng(80, 60);
    const result = await processImage(src, "image/png", "clean-background");
    const out = dataUrlToBuffer(result.processedUrl);
    const meta = await sharp(out).metadata();
    // withoutEnlargement keeps original dimensions
    expect(meta.width).toBeLessThanOrEqual(80);
    expect(meta.height).toBeLessThanOrEqual(60);
  });

  it("clean-background downscales images larger than 1200px", async () => {
    const src = await makePng(2000, 1600);
    const result = await processImage(src, "image/png", "clean-background");
    const out = dataUrlToBuffer(result.processedUrl);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBeLessThanOrEqual(1200);
    expect(meta.height).toBeLessThanOrEqual(1200);
  });

  it("studio-polish downscales images larger than 1500px", async () => {
    const src = await makePng(2400, 1800);
    const result = await processImage(src, "image/png", "studio-polish");
    const out = dataUrlToBuffer(result.processedUrl);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBeLessThanOrEqual(1500);
    expect(meta.height).toBeLessThanOrEqual(1500);
  });
});

// ---------------------------------------------------------------------------
// Error handling — corrupt / invalid input
// ---------------------------------------------------------------------------

describe("sharp processor — error handling", () => {
  it("rejects corrupt image buffer", async () => {
    const corrupt = Buffer.from("this is not an image", "utf-8");
    await expect(
      processImage(corrupt, "image/png", "clean-background"),
    ).rejects.toThrow();
  });

  it("rejects a buffer that looks like PNG header but is truncated", async () => {
    // Valid PNG magic bytes only -- no IHDR, no IDAT
    const truncated = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(
      processImage(truncated, "image/png", "marketplace-ready"),
    ).rejects.toThrow();
  });
});
