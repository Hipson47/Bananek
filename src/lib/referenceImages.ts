import type { GenerationResult, ReferenceImage, ReferenceSource } from "./types";

const createReferenceId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ref-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createGeneratedReferenceImage(
  result: GenerationResult,
  source: ReferenceSource = "generated",
): ReferenceImage {
  return {
    id: createReferenceId(),
    mimeType: result.mimeType,
    name: result.filename,
    previewUrl: result.imageUrl,
    source,
  };
}

export function releaseReferenceImage(reference: ReferenceImage) {
  if (reference.source === "upload" && reference.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(reference.previewUrl);
  }
}
