import sharp from "sharp";

import type { PresetId, ProcessedImageResult } from "../types.js";
import { getCustomerProcessorLabel } from "./customer-label.js";
import type { ProcessorExecutionOptions } from "./contracts.js";
import { encodeProcessedDataUrl } from "./data-url.js";

/**
 * Phase 2 real image processor — powered by sharp / libvips.
 *
 * Each preset applies deterministic pixel-level transforms that produce
 * genuinely different output from the input.  The output MIME type is
 * preserved from the input so the response contract stays stable.
 *
 * Preset philosophy
 * -----------------
 * clean-background  : flatten alpha → white, lighten, desaturate slightly,
 *                     light sharpen.  Targets a crisp catalog look.
 * marketplace-ready : contain inside 1000×1000 white square, contrast boost,
 *                     moderate sharpen.  Shelf-ready, vibrant.
 * studio-polish     : larger canvas (1500px), richer saturation, refined
 *                     edge sharpen.  Editorial / premium finish.
 *
 * All presets share:
 *   - auto-orient (EXIF rotation → pixels)
 *   - fit within max dimensions (no enlargement)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIME_TO_FORMAT: Record<string, keyof sharp.FormatEnum> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const WHITE_BG = { r: 255, g: 255, b: 255, alpha: 1 } as const;

// ---------------------------------------------------------------------------
// Per-preset pipeline builders
// ---------------------------------------------------------------------------

function buildCleanBackground(src: sharp.Sharp, format: keyof sharp.FormatEnum): sharp.Sharp {
  return src
    .rotate()                                                     // auto-orient
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .flatten({ background: WHITE_BG })                            // alpha → white
    .modulate({ brightness: 1.08, saturation: 0.95 })            // brighter, cleaner
    .sharpen({ sigma: 0.8 })                                      // light sharpen
    .toFormat(format, buildFormatOptions(format));
}

function buildMarketplaceReady(src: sharp.Sharp, format: keyof sharp.FormatEnum): sharp.Sharp {
  return src
    .rotate()
    .resize({
      width: 1000, height: 1000,
      fit: "contain",
      background: WHITE_BG,
    })
    .flatten({ background: WHITE_BG })                            // contain adds white border
    .modulate({ brightness: 1.02, saturation: 1.12 })            // vibrant
    .linear(1.12, -8)                                             // contrast lift
    .sharpen({ sigma: 1.0 })                                      // crisper edges
    .toFormat(format, buildFormatOptions(format));
}

function buildStudioPolish(src: sharp.Sharp, format: keyof sharp.FormatEnum): sharp.Sharp {
  return src
    .rotate()
    .resize({ width: 1500, height: 1500, fit: "inside", withoutEnlargement: true })
    .modulate({ brightness: 0.97, saturation: 1.18 })            // depth + richness
    .sharpen(0.5, 1, 2)                 // fine editorial sharpen
    .toFormat(format, buildFormatOptions(format));
}

function buildFormatOptions(format: keyof sharp.FormatEnum): sharp.OutputOptions {
  if (format === "jpeg") return { quality: 85, progressive: true } as sharp.JpegOptions;
  if (format === "webp") return { quality: 85 } as sharp.WebpOptions;
  return {} as sharp.PngOptions; // png uses default compression
}

// ---------------------------------------------------------------------------
// Public processor
// ---------------------------------------------------------------------------

export async function processImage(
  imageBuffer: Buffer,
  originalMime: string,
  presetId: PresetId,
  _options?: ProcessorExecutionOptions,
): Promise<ProcessedImageResult> {
  const format = MIME_TO_FORMAT[originalMime];
  const ext = MIME_TO_EXT[originalMime] ?? "bin";

  if (!format) {
    throw { kind: "processing" as const, message: `Unsupported MIME type: ${originalMime}` };
  }

  const src = sharp(imageBuffer);

  let pipeline: sharp.Sharp;
  switch (presetId) {
    case "clean-background":
      pipeline = buildCleanBackground(src, format);
      break;
    case "marketplace-ready":
      pipeline = buildMarketplaceReady(src, format);
      break;
    case "studio-polish":
      pipeline = buildStudioPolish(src, format);
      break;
  }

  // sharp errors (corrupt input, unsupported format, etc.) propagate as thrown
  // exceptions and are caught by the route's try/catch → 500 processing error.
  const outputBuffer = await pipeline.toBuffer();

  const processedUrl = encodeProcessedDataUrl(outputBuffer, originalMime);

  return {
    filename: `product-${presetId}.${ext}`,
    mimeType: originalMime,
    processedUrl,
    processorLabel: getCustomerProcessorLabel(presetId),
  };
}
