/**
 * Processor selection entry point.
 *
 * The active processor is chosen per-call via the PROCESSOR environment
 * variable so that tests can switch processors by setting the env var in
 * beforeAll/afterAll without needing module resets.
 *
 *   PROCESSOR=sharp          -- deterministic sharp/libvips transforms (default)
 *   PROCESSOR=fal            -- AI transforms via FAL.ai  (requires FAL_API_KEY)
 *   PROCESSOR=mock           -- original bytes unchanged; for contract-only tests
 *
 * Both real implementations share the same function signature so the route
 * is completely decoupled from the processor implementation.
 */

import { processImage as mockProcessImage } from "./mock-processor.js";
import { processImage as sharpProcessImage } from "./sharp-processor.js";
import { processImage as falProcessImage } from "./fal-processor.js";

import type { PresetId, ProcessedImageResult } from "../types.js";

export function processImage(
  imageBuffer: Buffer,
  originalMime: string,
  presetId: PresetId,
): Promise<ProcessedImageResult> {
  const proc = process.env.PROCESSOR;
  const fallback = process.env.PROCESSOR_FALLBACK?.trim() === "none"
    ? "none"
    : "sharp";
  if (proc === "mock") return mockProcessImage(imageBuffer, originalMime, presetId);
  if (proc === "fal") {
    return falProcessImage(imageBuffer, originalMime, presetId).catch((error) => {
      if (fallback !== "sharp") {
        throw error;
      }

      console.warn("[processor] FAL processor failed; falling back to sharp.", error);
      return sharpProcessImage(imageBuffer, originalMime, presetId);
    });
  }
  return sharpProcessImage(imageBuffer, originalMime, presetId);
}

export function activeProcessorName(): "mock" | "sharp" | "fal" {
  const proc = process.env.PROCESSOR;
  if (proc === "mock") return "mock";
  if (proc === "fal") return "fal";
  return "sharp";
}
