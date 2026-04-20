import type {
  ImageProcessor,
  ProcessImageInput,
  ProcessedImageResult,
} from "../types";

type BufferLike = {
  from(data: Uint8Array): {
    toString(encoding: "base64"): string;
  };
};

function toBase64(bytes: Uint8Array): string {
  const nodeBuffer = (globalThis as typeof globalThis & { Buffer?: BufferLike })
    .Buffer;

  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function fileToDataUrl(file: File): Promise<string> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return `data:${file.type};base64,${toBase64(bytes)}`;
  } catch {
    throw new Error("Could not read the uploaded image.");
  }
}

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
  }: ProcessImageInput): Promise<ProcessedImageResult> {
    const dataUrl = await fileToDataUrl(file);

    let response: Response;

    try {
      response = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId: preset.id,
          image: dataUrl,
        }),
      });
    } catch {
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

    return result;
  }
}
