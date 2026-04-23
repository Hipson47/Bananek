import { afterEach, describe, expect, it, vi } from "vitest";

import { BackendProcessor } from "./backendProcessor";
import { clearBackendSessionCache } from "./backendSession";
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
  clearBackendSessionCache();
  vi.restoreAllMocks();
});

describe("BackendProcessor", () => {
  it("maps a successful backend response and sends the preset plus file payload", async () => {
    const result: ProcessedImageResult = {
      filename: "product-clean-background.png",
      mimeType: "image/png",
      processedUrl: "/api/outputs/output-123?expires=999&sig=signed",
      processorLabel: "Clean Background enhancement",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createResponse({
          sessionId: "session-123",
          creditsRemaining: 3,
          creditsUsed: 0,
        }),
      )
      .mockResolvedValueOnce(
        createResponse(result, {
          headers: {
            "Content-Type": "application/json",
            "X-Credits-Remaining": "2",
          },
        }),
      );

    const processed = await processor.processImage({
      file: createImageFile(),
      preset,
    });

    expect(processed).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [sessionUrl, sessionInit] = fetchMock.mock.calls[0];
    expect(sessionUrl).toBe("/api/session");
    expect(sessionInit?.method).toBe("GET");

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/enhance");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "X-Session-Id": "session-123" });
    expect(init?.body).toBeInstanceOf(FormData);

    const formData = init?.body as FormData;
    expect(formData.get("presetId")).toBe("clean-background");
    expect(formData.get("image")).toBeInstanceOf(File);
  });

  it("maps backend 4xx responses to the backend error message", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createResponse({
          sessionId: "session-123",
          creditsRemaining: 3,
          creditsUsed: 0,
        }),
      )
      .mockResolvedValueOnce(
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

  it("polls accepted jobs until the backend returns the final processed asset", async () => {
    const result: ProcessedImageResult = {
      filename: "product-clean-background.png",
      mimeType: "image/png",
      processedUrl: "/api/outputs/output-123?expires=999&sig=signed",
      processorLabel: "Clean Background enhancement",
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createResponse({
          sessionId: "session-123",
          creditsRemaining: 3,
          creditsUsed: 0,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          jobId: "job-123",
          status: "queued",
          statusUrl: "/api/jobs/job-123",
        }, {
          status: 202,
          headers: {
            "Content-Type": "application/json",
            "X-Credits-Remaining": "2",
          },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          jobId: "job-123",
          status: "running",
        }),
      )
      .mockResolvedValueOnce(
        createResponse(result),
      );

    const processed = await processor.processImage({
      file: createImageFile(),
      preset,
    });

    expect(processed).toEqual(result);
  });

  it("surfaces failed async jobs as stable backend processing errors", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createResponse({
          sessionId: "session-123",
          creditsRemaining: 3,
          creditsUsed: 0,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          jobId: "job-123",
          status: "queued",
          statusUrl: "/api/jobs/job-123",
        }, {
          status: 202,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          jobId: "job-123",
          status: "failed",
          error: {
            kind: "processing",
            message: "We couldn't complete this enhancement. Try again.",
          },
        }),
      );

    await expect(
      processor.processImage({ file: createImageFile(), preset }),
    ).rejects.toThrow("We couldn't complete this enhancement. Try again.");
  });

  it("rejects malformed backend responses", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createResponse({
          sessionId: "session-123",
          creditsRemaining: 3,
          creditsUsed: 0,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          filename: "product-clean-background.png",
          mimeType: "image/png",
          processedUrl: 42,
          processorLabel: "Clean Background enhancement",
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
    ).rejects.toThrow(/Could not (start|reach)/);
  });

  it("rejects malformed async job polling responses", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createResponse({
          sessionId: "session-123",
          creditsRemaining: 3,
          creditsUsed: 0,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          jobId: "job-123",
          status: "queued",
          statusUrl: "/api/jobs/job-123",
        }, {
          status: 202,
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          unexpected: true,
        }),
      );

    await expect(
      processor.processImage({ file: createImageFile(), preset }),
    ).rejects.toThrow("Enhancement service returned an invalid response.");
  });
});
