import sharp from "sharp";

import type { AppError, PresetId } from "./types.js";
import { isValidPresetId } from "./presets.js";

const SUPPORTED_FORMAT_TO_MIME = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
const SUPPORTED_MIME_TYPES = new Set(Object.values(SUPPORTED_FORMAT_TO_MIME));

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_DIMENSION = 8_000;

export type ParsedEnhanceInput = {
  presetId: PresetId;
  imageBuffer: Buffer;
  mimeType: string;
  originalFilename: string;
  userGoal: string | null;
};

function parseOptionalGoal(value: unknown): AppError | string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return validationError("Goal must be a string when provided.");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 200) {
    return validationError("Goal is too long. Use up to 200 characters.");
  }

  return trimmed;
}

function validationError(message: string): AppError {
  return { kind: "validation", message };
}

function ensurePresetId(value: unknown): AppError | PresetId {
  if (!isValidPresetId(value)) {
    return validationError(
      "Unknown or missing preset. Use one of: clean-background, marketplace-ready, studio-polish.",
    );
  }

  return value;
}

export function parseJsonEnhanceBody(
  body: unknown,
): AppError | { presetId: PresetId; imageBuffer: Buffer; declaredMimeType: string; userGoal: string | null } {
  if (typeof body !== "object" || body === null) {
    return validationError("Request body must be a JSON object.");
  }

  const obj = body as Record<string, unknown>;
  const presetId = ensurePresetId(obj.presetId);

  if (typeof presetId !== "string") {
    return presetId;
  }

  if (typeof obj.image !== "string" || !obj.image.startsWith("data:")) {
    return validationError("Image must be provided as a data: URL.");
  }

  const mimeMatch = obj.image.match(/^data:(image\/[a-z+]+);base64,/);
  if (!mimeMatch) {
    return validationError("Malformed image data URL. Expected data:<mime>;base64,<data>.");
  }

  if (!SUPPORTED_MIME_TYPES.has(mimeMatch[1] as (typeof SUPPORTED_FORMAT_TO_MIME)[keyof typeof SUPPORTED_FORMAT_TO_MIME])) {
    return validationError("Unsupported image type. Use PNG, JPEG, or WEBP.");
  }

  const commaIndex = obj.image.indexOf(",");
  const base64Part = obj.image.slice(commaIndex + 1);
  const imageBuffer = Buffer.from(base64Part, "base64");
  const userGoal = parseOptionalGoal(obj.goal);

  if (userGoal && typeof userGoal === "object" && userGoal.kind === "validation") {
    return userGoal;
  }
  const normalizedUserGoal = typeof userGoal === "string" ? userGoal : null;

  if (imageBuffer.length === 0) {
    return validationError("Uploaded image is empty.");
  }

  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    return validationError("Image exceeds the 10 MB size limit.");
  }

  return {
    presetId,
    imageBuffer,
    declaredMimeType: mimeMatch[1],
    userGoal: normalizedUserGoal,
  };
}

export async function parseMultipartEnhanceBody(
  formData: FormData,
): Promise<AppError | { presetId: PresetId; imageBuffer: Buffer; declaredMimeType: string; originalFilename: string; userGoal: string | null }> {
  const presetId = ensurePresetId(formData.get("presetId"));

  if (typeof presetId !== "string") {
    return presetId;
  }

  const file = formData.get("image");

  if (!(file instanceof File)) {
    return validationError("Image file is required.");
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const userGoal = parseOptionalGoal(formData.get("goal"));

  if (userGoal && typeof userGoal === "object" && userGoal.kind === "validation") {
    return userGoal;
  }
  const normalizedUserGoal = typeof userGoal === "string" ? userGoal : null;

  if (imageBuffer.length === 0) {
    return validationError("Uploaded image is empty.");
  }

  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    return validationError("Image exceeds the 10 MB size limit.");
  }

  return {
    presetId,
    imageBuffer,
    declaredMimeType: file.type,
    originalFilename: file.name || "upload",
    userGoal: normalizedUserGoal,
  };
}

export async function inspectUploadedImage(args: {
  presetId: PresetId;
  imageBuffer: Buffer;
  declaredMimeType: string;
  originalFilename?: string;
  userGoal?: string | null;
}): Promise<AppError | ParsedEnhanceInput> {
  try {
    const metadata = await sharp(args.imageBuffer, {
      limitInputPixels: MAX_IMAGE_PIXELS,
      failOn: "error",
    }).metadata();

    if (!metadata.format || !(metadata.format in SUPPORTED_FORMAT_TO_MIME)) {
      return validationError("Unsupported image type. Use PNG, JPEG, or WEBP.");
    }

    if (!metadata.width || !metadata.height) {
      return validationError("Could not determine image dimensions.");
    }

    if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
      return validationError("Image dimensions are too large. Use an image up to 8000px per side.");
    }

    if ((metadata.width * metadata.height) > MAX_IMAGE_PIXELS) {
      return validationError("Image is too large to process safely.");
    }

    if ((metadata.pages ?? 1) > 1) {
      return validationError("Animated images are not supported.");
    }

    const detectedMimeType =
      SUPPORTED_FORMAT_TO_MIME[metadata.format as keyof typeof SUPPORTED_FORMAT_TO_MIME];

    if (args.declaredMimeType && args.declaredMimeType !== detectedMimeType) {
      return validationError("Image content does not match the declared file type.");
    }

    return {
      presetId: args.presetId,
      imageBuffer: args.imageBuffer,
      mimeType: detectedMimeType,
      originalFilename: args.originalFilename ?? "upload",
      userGoal: args.userGoal ?? null,
    };
  } catch {
    return validationError("Uploaded file is not a valid supported image.");
  }
}

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "kind" in value && "message" in value;
}
