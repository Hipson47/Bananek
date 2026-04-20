import { describe, expect, it } from "vitest";

import { validateEnhanceRequest } from "../src/validation.js";

// Minimal valid 1x1 red pixel PNG as data URL
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

describe("validateEnhanceRequest", () => {
  it("accepts a valid request", () => {
    const result = validateEnhanceRequest({
      presetId: "clean-background",
      image: TINY_PNG,
    });

    expect("parsed" in result).toBe(true);
  });

  it("rejects a non-object body", () => {
    const result = validateEnhanceRequest("not an object");
    expect(result).toEqual({
      kind: "validation",
      message: "Request body must be a JSON object.",
    });
  });

  it("rejects an unknown preset ID", () => {
    const result = validateEnhanceRequest({
      presetId: "unknown-preset",
      image: TINY_PNG,
    });

    expect(result).toMatchObject({ kind: "validation" });
    expect((result as { message: string }).message).toContain("Unknown or missing preset");
  });

  it("rejects a missing preset ID", () => {
    const result = validateEnhanceRequest({ image: TINY_PNG });
    expect(result).toMatchObject({ kind: "validation" });
  });

  it("rejects a non-data URL image", () => {
    const result = validateEnhanceRequest({
      presetId: "clean-background",
      image: "blob:http://localhost/abc",
    });

    expect(result).toEqual({
      kind: "validation",
      message: "Image must be provided as a data: URL.",
    });
  });

  it("rejects an http URL as image", () => {
    const result = validateEnhanceRequest({
      presetId: "clean-background",
      image: "https://example.com/photo.jpg",
    });

    expect(result).toEqual({
      kind: "validation",
      message: "Image must be provided as a data: URL.",
    });
  });

  it("rejects an unsupported MIME type", () => {
    const result = validateEnhanceRequest({
      presetId: "clean-background",
      image: "data:image/svg+xml;base64,PHN2Zy8+",
    });

    expect(result).toEqual({
      kind: "validation",
      message: "Unsupported image type. Use PNG, JPEG, or WEBP.",
    });
  });

  it("rejects a malformed data URL without base64 header", () => {
    const result = validateEnhanceRequest({
      presetId: "clean-background",
      image: "data:text/plain,hello",
    });

    expect(result).toMatchObject({ kind: "validation" });
  });

  it("rejects an image exceeding the 10 MB size limit", () => {
    // Create a base64 string that decodes to > 10 MB
    // 10 MB = 10485760 bytes → need ~13981014 base64 chars
    const bigBase64 = "A".repeat(14_000_000);
    const result = validateEnhanceRequest({
      presetId: "clean-background",
      image: `data:image/jpeg;base64,${bigBase64}`,
    });

    expect(result).toEqual({
      kind: "validation",
      message: "Image exceeds the 10 MB size limit.",
    });
  });
});
