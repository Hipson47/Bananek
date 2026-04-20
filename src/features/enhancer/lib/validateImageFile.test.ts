import { describe, expect, it } from "vitest";

import { validateImageFile } from "./validateImageFile";

describe("validateImageFile", () => {
  it("accepts supported product image formats within the size limit", () => {
    const file = new File(["demo"], "shoe.png", { type: "image/png" });

    expect(validateImageFile(file)).toBeNull();
  });

  it("rejects unsupported file formats", () => {
    const file = new File(["demo"], "notes.txt", { type: "text/plain" });

    expect(validateImageFile(file)).toBe(
      "Unsupported image type. Use a PNG, JPEG, or WEBP product photo.",
    );
  });

  it("rejects files larger than 10 MB", () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "bag.jpg", {
      type: "image/jpeg",
    });

    expect(validateImageFile(file)).toBe(
      "Image is too large. Upload a file smaller than 10 MB.",
    );
  });
});
