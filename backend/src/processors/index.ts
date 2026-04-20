/**
 * Processor selection entry point.
 *
 * The active processor is chosen per-call via the PROCESSOR environment
 * variable so that tests can switch processors by setting the env var in
 * beforeAll/afterAll without needing module resets.
 *
 *   PROCESSOR=sharp   -- real image processing via sharp/libvips (default)
 *   PROCESSOR=mock    -- returns original bytes unchanged; useful for local
 *                        dev or integration tests that focus on the HTTP
 *                        contract rather than pixel output
 *
 * Both implementations share the same function signature so the route is
 * completely decoupled from the processor implementation.
 */

import { processImage as mockProcessImage } from "./mock-processor.js";
import { processImage as sharpProcessImage } from "./sharp-processor.js";

import type { PresetId, ProcessedImageResult } from "../types.js";

export function processImage(
  imageBuffer: Buffer,
  originalMime: string,
  presetId: PresetId,
): Promise<ProcessedImageResult> {
  const impl = process.env.PROCESSOR === "mock" ? mockProcessImage : sharpProcessImage;
  return impl(imageBuffer, originalMime, presetId);
}

export function activeProcessorName(): "mock" | "sharp" {
  return process.env.PROCESSOR === "mock" ? "mock" : "sharp";
}
