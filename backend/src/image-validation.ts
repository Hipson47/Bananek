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
};

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
): AppError | { presetId: PresetId; imageBuffer: Buffer; declaredMimeType: string } {
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
  };
}

export async function parseMultipartEnhanceBody(
  formData: FormData,
): Promise<AppError | { presetId: PresetId; imageBuffer: Buffer; declaredMimeType: string; originalFilename: string }> {
  const presetId = ensurePresetId(formData.get("presetId"));

  if (typeof presetId !== "string") {
    return presetId;
  }

  const file = formData.get("image");

  if (!(file instanceof File)) {
    return validationError("Image file is required.");
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer());

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
  };
}

export async function inspectUploadedImage(args: {
  presetId: PresetId;
  imageBuffer: Buffer;
  declaredMimeType: string;
  originalFilename?: string;
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
