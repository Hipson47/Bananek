import { describe, expect, it } from "vitest";

import { inspectUploadedImage, parseJsonEnhanceBody } from "../src/image-validation.js";

// Minimal valid 1x1 red pixel PNG as data URL
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const TINY_JPEG =
  "data:image/jpeg;base64,/9j/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJEAf//Z";

describe("parseJsonEnhanceBody", () => {
  it("accepts a valid request", () => {
    const result = parseJsonEnhanceBody({
      presetId: "clean-background",
      image: TINY_PNG,
    });

    expect("kind" in result).toBe(false);
    if ("kind" in result) {
      throw new Error("expected valid parsed input");
    }
    expect(result.declaredMimeType).toBe("image/png");
  });

  it("rejects a non-object body", () => {
    const result = parseJsonEnhanceBody("not an object");
    expect(result).toEqual({
      kind: "validation",
      message: "Request body must be a JSON object.",
    });
  });

  it("rejects an unknown preset ID", () => {
    const result = parseJsonEnhanceBody({
      presetId: "unknown-preset",
      image: TINY_PNG,
    });

    expect(result).toMatchObject({ kind: "validation" });
    expect((result as { message: string }).message).toContain("Unknown or missing preset");
  });

  it("rejects a missing preset ID", () => {
    const result = parseJsonEnhanceBody({ image: TINY_PNG });
    expect(result).toMatchObject({ kind: "validation" });
  });

  it("rejects a non-data URL image", () => {
    const result = parseJsonEnhanceBody({
      presetId: "clean-background",
      image: "blob:http://localhost/abc",
    });

    expect(result).toEqual({
      kind: "validation",
      message: "Image must be provided as a data: URL.",
    });
  });

  it("rejects an http URL as image", () => {
    const result = parseJsonEnhanceBody({
      presetId: "clean-background",
      image: "https://example.com/photo.jpg",
    });

    expect(result).toEqual({
      kind: "validation",
      message: "Image must be provided as a data: URL.",
    });
  });

  it("rejects an unsupported MIME type", () => {
    const result = parseJsonEnhanceBody({
      presetId: "clean-background",
      image: "data:image/svg+xml;base64,PHN2Zy8+",
    });

    expect(result).toEqual({
      kind: "validation",
      message: "Unsupported image type. Use PNG, JPEG, or WEBP.",
    });
  });

  it("rejects a malformed data URL without base64 header", () => {
    const result = parseJsonEnhanceBody({
      presetId: "clean-background",
      image: "data:text/plain,hello",
    });

    expect(result).toMatchObject({ kind: "validation" });
  });

  it("rejects an image exceeding the 10 MB size limit", () => {
    // Create a base64 string that decodes to > 10 MB
    // 10 MB = 10485760 bytes → need ~13981014 base64 chars
    const bigBase64 = "A".repeat(14_000_000);
    const result = parseJsonEnhanceBody({
      presetId: "clean-background",
      image: `data:image/jpeg;base64,${bigBase64}`,
    });

    expect(result).toEqual({
      kind: "validation",
      message: "Image exceeds the 10 MB size limit.",
    });
  });
});

describe("inspectUploadedImage", () => {
  it("rejects mismatched declared mime types on the active validation path", async () => {
    const parsed = parseJsonEnhanceBody({
      presetId: "clean-background",
      image: TINY_PNG.replace("data:image/png", "data:image/jpeg"),
    });

    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) {
      throw new Error("expected parsed image payload");
    }

    const inspected = await inspectUploadedImage({
      presetId: parsed.presetId,
      imageBuffer: parsed.imageBuffer,
      declaredMimeType: parsed.declaredMimeType,
    });

    expect(inspected).toEqual({
      kind: "validation",
      message: "Image content does not match the declared file type.",
    });
  });

  it("accepts valid image bytes that match the declared mime type", async () => {
    const parsed = parseJsonEnhanceBody({
      presetId: "marketplace-ready",
      image: TINY_JPEG,
    });

    expect("kind" in parsed).toBe(false);
    if ("kind" in parsed) {
      throw new Error("expected parsed image payload");
    }

    const inspected = await inspectUploadedImage({
      presetId: parsed.presetId,
      imageBuffer: parsed.imageBuffer,
      declaredMimeType: parsed.declaredMimeType,
    });

    expect("kind" in inspected).toBe(false);
    if ("kind" in inspected) {
      throw new Error("expected valid inspection result");
    }
    expect(inspected.mimeType).toBe("image/jpeg");
    expect(inspected.originalFilename).toBe("upload");
  });
});
