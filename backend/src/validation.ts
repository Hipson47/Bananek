import type { AppError } from "./types.js";
import { parseJsonEnhanceBody } from "./image-validation.js";

export function validateEnhanceRequest(
  body: unknown,
): AppError | { parsed: { presetId: string; image: string; mimeType: string } } {
  const parsed = parseJsonEnhanceBody(body);

  if ("kind" in parsed) {
    return parsed;
  }

  return {
    parsed: {
      presetId: parsed.presetId,
      image:
        `data:${parsed.declaredMimeType};base64,${parsed.imageBuffer.toString("base64")}`,
      mimeType: parsed.declaredMimeType,
    },
  };
}

export { isAppError } from "./image-validation.js";
