import sharp from "sharp";

import { readConfig, requireEnv } from "../config.js";
import type { PresetId, ProcessedImageResult } from "../types.js";
import { getCustomerProcessorLabel } from "./customer-label.js";

/**
 * Phase 3 AI processor -- powered by FAL.ai.
 *
 * Each preset calls a purpose-built FAL model for the creative transformation,
 * then applies a sharp post-processing pass for format and size normalisation
 * so the response contract remains identical to the sharp processor.
 *
 * Preset mapping
 * --------------
 * clean-background  : fal-ai/background-removal -- removes background, returns
 *                     transparent PNG; sharp flattens to white + resizes.
 * marketplace-ready : fal-ai/flux-pro/kontext   -- img2img with marketplace
 *                     prompt; sharp normalises to square contain + format.
 * studio-polish     : fal-ai/flux-pro/kontext   -- img2img with studio prompt;
 *                     sharp normalises size + format.
 *
 * Environment
 * -----------
 * FAL_API_KEY  required when PROCESSOR=fal  (set at server startup)
 *
 * Error mapping
 * -------------
 * 401          -> "Provider authentication failed. Verify FAL_API_KEY."
 * 422          -> "Provider rejected the request."
 * 429          -> "Provider rate limit exceeded. Try again later."
 * 5xx          -> "Provider temporarily unavailable."
 * Timeout      -> "Provider request timed out after 60s."
 * Network      -> "Provider request failed: network error."
 * Bad shape    -> "Provider returned unexpected response."
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FAL_BASE = "https://fal.run";
const TIMEOUT_MS = 60_000; // AI inference can be slow
const MAX_PROVIDER_IMAGE_BYTES = 15 * 1024 * 1024;

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
// Internal error class
// ---------------------------------------------------------------------------

class FalError extends Error {
  readonly kind = "processing" as const;

  constructor(message: string) {
    super(message);
    this.name = "FalError";
  }
}

// ---------------------------------------------------------------------------
// Preset configuration
// ---------------------------------------------------------------------------

type PresetConfig = {
  readonly model: string;
  buildPayload(imageDataUrl: string): Record<string, unknown>;
  extractResultUrl(body: unknown): string;
};

function extractKontextUrl(body: unknown): string {
  if (
    isObject(body) &&
    Array.isArray(body["images"]) &&
    body["images"].length > 0 &&
    isObject(body["images"][0]) &&
    typeof body["images"][0]["url"] === "string"
  ) {
    return body["images"][0]["url"] as string;
  }
  throw new FalError("Provider returned unexpected response.");
}

const PRESET_CONFIGS: Record<PresetId, PresetConfig> = {
  "clean-background": {
    model: "fal-ai/background-removal",
    buildPayload: (imageDataUrl) => ({ image_url: imageDataUrl }),
    extractResultUrl: (body) => {
      if (
        isObject(body) &&
        isObject(body["image"]) &&
        typeof body["image"]["url"] === "string"
      ) {
        return body["image"]["url"] as string;
      }
      throw new FalError("Provider returned unexpected response.");
    },
  },

  "marketplace-ready": {
    model: "fal-ai/flux-pro/kontext",
    buildPayload: (imageDataUrl) => ({
      image_url: imageDataUrl,
      prompt:
        "Professional product photography on pure white background, square composition, enhanced contrast, sharp detail, commercial marketplace listing photo",
      guidance_scale: 3.5,
      num_images: 1,
    }),
    extractResultUrl: extractKontextUrl,
  },

  "studio-polish": {
    model: "fal-ai/flux-pro/kontext",
    buildPayload: (imageDataUrl) => ({
      image_url: imageDataUrl,
      prompt:
        "Professional studio product photography, premium editorial quality, beautiful lighting, rich tones, fine detail, flagship product listing",
      guidance_scale: 3.5,
      num_images: 1,
    }),
    extractResultUrl: extractKontextUrl,
  },
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mapHttpError(status: number): FalError {
  if (status === 401) return new FalError("Provider authentication failed. Verify FAL_API_KEY.");
  if (status === 422) return new FalError("Provider rejected the request.");
  if (status === 429) return new FalError("Provider rate limit exceeded. Try again later.");
  if (status >= 500) return new FalError("Provider temporarily unavailable.");
  return new FalError(`Provider request failed (HTTP ${status}).`);
}

function ensureAllowedProviderUrl(urlString: string): URL {
  const config = readConfig();
  let parsed: URL;

  try {
    parsed = new URL(urlString);
  } catch {
    throw new FalError("Provider returned a malformed asset URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new FalError("Provider returned a non-HTTPS asset URL.");
  }

  const host = parsed.hostname.toLowerCase();
  const allowed = config.falAllowedHostSuffixes.some((suffix) => {
    const loweredSuffix = suffix.toLowerCase();
    return host === loweredSuffix || host.endsWith(`.${loweredSuffix}`);
  });

  if (!allowed) {
    throw new FalError("Provider returned an asset host that is not allowed.");
  }

  return parsed;
}

async function callFalApi(
  model: string,
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<unknown> {
  let response: Response;

  try {
    response = await globalThis.fetch(`${FAL_BASE}/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new FalError(`Provider request timed out after ${TIMEOUT_MS / 1000}s.`);
    }
    throw new FalError("Provider request failed: network error.");
  }

  if (!response.ok) {
    throw mapHttpError(response.status);
  }

  try {
    return await response.json();
  } catch {
    throw new FalError("Provider returned unparseable response.");
  }
}

async function fetchImageBytes(url: string): Promise<Buffer> {
  const safeUrl = ensureAllowedProviderUrl(url);
  let response: Response;

  try {
    response = await globalThis.fetch(safeUrl, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new FalError("Provider image download timed out.");
    }
    throw new FalError("Provider image download failed: network error.");
  }

  if (!response.ok) {
    throw new FalError(`Provider image download failed (HTTP ${response.status}).`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_PROVIDER_IMAGE_BYTES) {
    throw new FalError("Provider image download exceeded the safe size limit.");
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());

  if (imageBuffer.length > MAX_PROVIDER_IMAGE_BYTES) {
    throw new FalError("Provider image download exceeded the safe size limit.");
  }

  return imageBuffer;
}

// ---------------------------------------------------------------------------
// Sharp post-processing for format / size normalisation
// ---------------------------------------------------------------------------

async function postProcess(
  aiBytes: Buffer,
  originalMime: string,
  presetId: PresetId,
): Promise<Buffer> {
  const format = MIME_TO_FORMAT[originalMime] ?? "jpeg";

  switch (presetId) {
    case "clean-background":
      return sharp(aiBytes)
        .flatten({ background: WHITE_BG })
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .toFormat(format)
        .toBuffer();

    case "marketplace-ready":
      return sharp(aiBytes)
        .resize({ width: 1000, height: 1000, fit: "contain", background: WHITE_BG })
        .flatten({ background: WHITE_BG })
        .toFormat(format)
        .toBuffer();

    case "studio-polish":
      return sharp(aiBytes)
        .resize({ width: 1500, height: 1500, fit: "inside", withoutEnlargement: true })
        .toFormat(format)
        .toBuffer();
  }
}

// ---------------------------------------------------------------------------
// Public processor
// ---------------------------------------------------------------------------

export async function processImage(
  imageBuffer: Buffer,
  originalMime: string,
  presetId: PresetId,
): Promise<ProcessedImageResult> {
  // requireEnv is called here (not at module level) so the server can import
  // this module without a key configured when PROCESSOR != "fal".
  const apiKey = requireEnv("FAL_API_KEY");
  const ext = MIME_TO_EXT[originalMime] ?? "bin";
  const config = PRESET_CONFIGS[presetId];

  // 1. Build data URL for FAL input
  const inputDataUrl = `data:${originalMime};base64,${imageBuffer.toString("base64")}`;

  // 2. Call FAL API for creative transformation
  const responseBody = await callFalApi(config.model, config.buildPayload(inputDataUrl), apiKey);

  // 3. Extract CDN image URL from provider response
  const cdnUrl = config.extractResultUrl(responseBody);

  // 4. Fetch processed image bytes
  const aiBytes = await fetchImageBytes(cdnUrl);

  // 5. Normalise format + dimensions via sharp
  const outputBuffer = await postProcess(aiBytes, originalMime, presetId);

  const processedBase64 = outputBuffer.toString("base64");
  const processedUrl = `data:${originalMime};base64,${processedBase64}`;

  return {
    filename: `product-${presetId}.${ext}`,
    mimeType: originalMime,
    processedUrl,
    processorLabel: getCustomerProcessorLabel(presetId),
  };
}
