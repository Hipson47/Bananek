import type { PresetId, ProcessedImageResult } from "../types.js";
import { getCustomerProcessorLabel } from "./customer-label.js";

/**
 * Server-side mock processor.
 *
 * In Phase 1 this returns the original image unchanged — the purpose is to
 * prove the HTTP pipeline (upload > validate > process > respond) end-to-end.
 * A future phase will swap this for a real AI-backed processor.
 *
 * The interface is intentionally async so that real processors can do I/O.
 */

const SIMULATED_LATENCY_MS = 200;
const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildOutputFilename(presetId: PresetId, mimeType: string): string {
  const extension = MIME_TYPE_TO_EXTENSION[mimeType] ?? "bin";
  return `product-${presetId}.${extension}`;
}

export async function processImage(
  imageBuffer: Buffer,
  originalMime: string,
  presetId: PresetId,
): Promise<ProcessedImageResult> {
  // Simulate processing latency so the UI loading state is visible in dev
  await wait(SIMULATED_LATENCY_MS);

  // Return the original image unchanged until real processing is added.
  // The response metadata must therefore preserve the original format.
  // Real processors will perform actual transformation here.
  const outputFilename = buildOutputFilename(presetId, originalMime);
  const processedBase64 = imageBuffer.toString("base64");
  const processedUrl = `data:${originalMime};base64,${processedBase64}`;

  return {
    filename: outputFilename,
    mimeType: originalMime,
    processedUrl,
    processorLabel: getCustomerProcessorLabel(presetId),
  };
}
