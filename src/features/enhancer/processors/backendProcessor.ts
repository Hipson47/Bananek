import type {
  ImageProcessor,
  ProcessImageInput,
  ProcessedImageResult,
} from "../types";
import {
  getBackendSession,
  syncSessionFromEnhanceResponse,
} from "./backendSession";

function isProcessedImageResult(value: unknown): value is ProcessedImageResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    typeof result.filename === "string" &&
    typeof result.mimeType === "string" &&
    typeof result.processedUrl === "string" &&
    typeof result.processorLabel === "string"
  );
}

export class BackendProcessor implements ImageProcessor {
  async processImage({
    file,
    preset,
    signal,
  }: ProcessImageInput & { signal?: AbortSignal }): Promise<ProcessedImageResult> {
    const session = await getBackendSession();
    const formData = new FormData();
    formData.append("presetId", preset.id);
    formData.append("image", file);

    let response: Response;

    try {
      response = await fetch("/api/enhance", {
        method: "POST",
        headers: { "X-Session-Id": session.sessionId },
        body: formData,
        signal,
      });
    } catch (err) {
      // Re-throw AbortError so the caller can distinguish cancellation
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new Error("Could not reach the enhancement service.");
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message =
        errorBody?.error?.message ??
        `Enhancement failed (status ${response.status}).`;
      throw new Error(message);
    }

    const result = await response.json().catch(() => null);

    if (!isProcessedImageResult(result)) {
      throw new Error("Enhancement service returned an invalid response.");
    }

    syncSessionFromEnhanceResponse(response);

    return result;
  }
}
