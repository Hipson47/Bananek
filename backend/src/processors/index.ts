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
import { logError, logEvent } from "../utils/log.js";

import type { PresetId, ProcessedImageResult } from "../types.js";

function readProcessorFailurePolicy(): "strict" | "fallback-to-sharp" {
  const raw = process.env.PROCESSOR_FAILURE_POLICY?.trim();
  if (raw === "fallback-to-sharp") {
    return "fallback-to-sharp";
  }

  return "strict";
}

export function processImage(
  imageBuffer: Buffer,
  originalMime: string,
  presetId: PresetId,
): Promise<ProcessedImageResult> {
  const proc = process.env.PROCESSOR;
  const failurePolicy = readProcessorFailurePolicy();
  if (proc === "mock") return mockProcessImage(imageBuffer, originalMime, presetId);
  if (proc === "fal") {
    return falProcessImage(imageBuffer, originalMime, presetId).catch((error) => {
      if (failurePolicy !== "fallback-to-sharp") {
        throw error;
      }

      logError("processor.fal.failed", error, {
        presetId,
        policy: failurePolicy,
      });
      logEvent("warn", "processor.fallback_to_sharp", {
        presetId,
        originalMime,
      });
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
