export type PresetId = "clean-background" | "marketplace-ready" | "studio-polish";

export type EnhancementPreset = {
  id: PresetId;
  name: string;
  description: string;
};

export type EnhanceRequestBody = {
  presetId: PresetId;
  image: string;    // data:image/...;base64,...
  mimeType: string; // extracted during validation, e.g. "image/png"
};

export type ProcessedImageResult = {
  filename: string;
  mimeType: string;
  processedUrl: string;
  processorLabel: string;
};

export type AppError = {
  kind: "validation" | "processing";
  message: string;
};
