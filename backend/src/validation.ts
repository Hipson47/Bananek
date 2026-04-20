import { isValidPresetId } from "./presets.js";
import type { AppError, EnhanceRequestBody } from "./types.js";

const SUPPORTED_MIME_PREFIXES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB decoded

export function validateEnhanceRequest(
  body: unknown,
): AppError | { parsed: EnhanceRequestBody } {
  if (typeof body !== "object" || body === null) {
    return { kind: "validation", message: "Request body must be a JSON object." };
  }

  const obj = body as Record<string, unknown>;

  // 1. presetId
  if (!isValidPresetId(obj.presetId)) {
    return {
      kind: "validation",
      message: "Unknown or missing preset. Use one of: clean-background, marketplace-ready, studio-polish.",
    };
  }

  // 2. image must be a data: URL
  if (typeof obj.image !== "string" || !obj.image.startsWith("data:")) {
    return {
      kind: "validation",
      message: "Image must be provided as a data: URL.",
    };
  }

  // 3. image mime type check
  const mimeMatch = obj.image.match(/^data:(image\/[a-z+]+);base64,/);
  if (!mimeMatch) {
    return {
      kind: "validation",
      message: "Malformed image data URL. Expected data:<mime>;base64,<data>.",
    };
  }

  if (!SUPPORTED_MIME_PREFIXES.includes(mimeMatch[1])) {
    return {
      kind: "validation",
      message: "Unsupported image type. Use PNG, JPEG, or WEBP.",
    };
  }

  // 4. size limit
  const commaIndex = obj.image.indexOf(",");
  const base64Part = obj.image.slice(commaIndex + 1);
  const estimatedBytes = Math.ceil(base64Part.length * 3 / 4);

  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return {
      kind: "validation",
      message: "Image exceeds the 10 MB size limit.",
    };
  }

  return {
    parsed: {
      presetId: obj.presetId,
      image: obj.image,
    },
  };
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) return false;
  return "kind" in value && "message" in value;
}
