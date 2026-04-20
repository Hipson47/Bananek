import { afterEach, describe, expect, it, vi } from "vitest";

import { BackendProcessor } from "./backendProcessor";
import type { ProcessedImageResult } from "../types";

const processor = new BackendProcessor();
const preset = {
  id: "clean-background" as const,
  name: "Clean Background",
  description: "Remove distractions and simplify the backdrop.",
};

function createImageFile() {
  return new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], "shoe.png", {
    type: "image/png",
  });
}

function createResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BackendProcessor", () => {
  it("maps a successful backend response and sends the preset plus image payload", async () => {
    const result: ProcessedImageResult = {
      filename: "product-clean-background.png",
      mimeType: "image/png",
      processedUrl: "data:image/png;base64,iVBORw0KGgo=",
      processorLabel: "Backend mock enhancement pipeline",
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(createResponse(result));

    const processed = await processor.processImage({
      file: createImageFile(),
      preset,
    });

    expect(processed).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/enhance");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });

    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      presetId: "clean-background",
      image: "data:image/png;base64,iVBORw==",
    });
  });

  it("maps backend 4xx responses to the backend error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse(
        {
          error: {
            kind: "validation",
            message: "Unknown or missing preset.",
          },
        },
        { status: 400 },
      ),
    );

    await expect(
      processor.processImage({ file: createImageFile(), preset }),
    ).rejects.toThrow("Unknown or missing preset.");
  });

  it("rejects malformed backend responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createResponse({
        filename: "product-clean-background.png",
        mimeType: "image/png",
        processedUrl: 42,
        processorLabel: "Backend mock enhancement pipeline",
      }),
    );

    await expect(
      processor.processImage({ file: createImageFile(), preset }),
    ).rejects.toThrow("Enhancement service returned an invalid response.");
  });

  it("rejects network failures with a stable service error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      processor.processImage({ file: createImageFile(), preset }),
    ).rejects.toThrow("Could not reach the enhancement service.");
  });
});
