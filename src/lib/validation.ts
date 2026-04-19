import { getModelOption } from "./modelRegistry";
import type { AppError, PlaygroundState } from "./types";

const createValidationError = (message: string): AppError => ({
  kind: "validation",
  message,
});

export function validatePlaygroundState(state: PlaygroundState): AppError | null {
  if (!state.apiKey.trim()) {
    return createValidationError("API key is required before generating.");
  }

  if (!state.prompt.trim()) {
    return createValidationError("Prompt is required.");
  }

  const model = getModelOption(state.selectedModel);

  if (state.mode === "img>img" && model.maxReferences === 0) {
    return createValidationError(`${model.label} does not support image-to-image mode.`);
  }

  if (state.mode === "img>img" && state.references.length === 0) {
    return createValidationError(
      "At least one reference image is required for img>img mode.",
    );
  }

  if (state.references.length > model.maxReferences) {
    return createValidationError(
      `This model allows up to ${model.maxReferences} reference image${model.maxReferences === 1 ? "" : "s"}.`,
    );
  }

  if (!model.supportedAspectRatios.includes(state.aspectRatio)) {
    return createValidationError("The selected aspect ratio is not supported.");
  }

  if (!model.supportedResolutions.includes(state.resolution)) {
    return createValidationError("The selected resolution is not supported.");
  }

  if (!model.supportedQualities.includes(state.quality)) {
    return createValidationError("The selected quality is not supported.");
  }

  const invalidReference = state.references.find(
    (reference) => !model.supportedMimeTypes.includes(reference.mimeType),
  );

  if (invalidReference) {
    return createValidationError(
      `Unsupported reference type for ${model.label}: ${invalidReference.mimeType}.`,
    );
  }

  return null;
}
