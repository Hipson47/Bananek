import type { PresetId, ProcessedImageResult } from "../types.js";

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
const OUTPUT_MIME_TYPE = "image/jpeg";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildOutputFilename(presetId: PresetId): string {
  return `product-${presetId}.jpg`;
}

export async function processImage(
  imageBuffer: Buffer,
  _originalMime: string,
  presetId: PresetId,
): Promise<ProcessedImageResult> {
  // Simulate processing latency so the UI loading state is visible in dev
  await wait(SIMULATED_LATENCY_MS);

  // Return the original image as a JPEG data URL.
  // Real processors will perform actual transformations here.
  const base64 = imageBuffer.toString("base64");

  return {
    filename: buildOutputFilename(presetId),
    mimeType: OUTPUT_MIME_TYPE,
    processedUrl: `data:${OUTPUT_MIME_TYPE};base64,${base64}`,
    processorLabel: "Backend mock enhancement pipeline",
  };
}
