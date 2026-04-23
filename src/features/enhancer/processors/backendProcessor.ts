import type {
  ImageProcessor,
  ProcessImageInput,
  ProcessedImageResult,
} from "../types";
import {
  getBackendSession,
  syncSessionFromEnhanceResponse,
} from "./backendSession";

type EnhancementJobAccepted = {
  jobId: string;
  status: "queued" | "running";
  statusUrl: string;
};

type EnhancementJobPending = {
  jobId: string;
  status: "queued" | "running";
};

type EnhancementJobFailed = {
  jobId: string;
  status: "failed";
  error: {
    kind: "processing";
    message: string;
  };
};

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

function isAcceptedJob(value: unknown): value is EnhancementJobAccepted {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const job = value as Record<string, unknown>;
  return (
    typeof job.jobId === "string"
    && (job.status === "queued" || job.status === "running")
    && typeof job.statusUrl === "string"
  );
}

function isPendingJob(value: unknown): value is EnhancementJobPending {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const job = value as Record<string, unknown>;
  return (
    typeof job.jobId === "string"
    && (job.status === "queued" || job.status === "running")
  );
}

function isFailedJob(value: unknown): value is EnhancementJobFailed {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const job = value as Record<string, unknown>;
  return (
    typeof job.jobId === "string"
    && job.status === "failed"
    && typeof job.error === "object"
    && job.error !== null
    && typeof (job.error as { message?: unknown }).message === "string"
  );
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      globalThis.clearTimeout(timeout);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class BackendProcessor implements ImageProcessor {
  private async pollJobUntilComplete(args: {
    statusUrl: string;
    signal?: AbortSignal;
  }): Promise<ProcessedImageResult> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      let response: Response;

      try {
        response = await fetch(args.statusUrl, {
          method: "GET",
          credentials: "same-origin",
          signal: args.signal,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        throw new Error("Could not reach the enhancement service.");
      }

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          body?.error?.message ??
          `Enhancement failed (status ${response.status}).`;
        throw new Error(message);
      }

      if (isProcessedImageResult(body)) {
        return body;
      }

      if (isFailedJob(body)) {
        throw new Error(body.error.message);
      }

      if (!isPendingJob(body)) {
        throw new Error("Enhancement service returned an invalid response.");
      }

      await sleep(500, args.signal);
    }

    throw new Error("Enhancement is taking too long. Please try again.");
  }

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
    syncSessionFromEnhanceResponse(response);

    if (isProcessedImageResult(result)) {
      return result;
    }

    if (isAcceptedJob(result)) {
      return this.pollJobUntilComplete({
        statusUrl: result.statusUrl,
        signal,
      });
    }

    throw new Error("Enhancement service returned an invalid response.");
  }
}
