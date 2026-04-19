export type GenerationMode = "txt>img" | "img>img";
export type ProviderName = "google" | "fal";
export type VisibleModelId =
  | "nano-banana-2-fast"
  | "nano-banana-2-thinking"
  | "nano-banana-pro"
  | "nano-banana-fal-fast"
  | "nano-banana-fal-quality";
export type AspectRatioId =
  | "auto"
  | "21:9"
  | "16:9"
  | "3:2"
  | "4:3"
  | "5:4"
  | "1:1"
  | "4:5"
  | "3:4"
  | "2:3"
  | "9:16";
export type ResolutionId = "default" | "0.5k" | "1k" | "2k" | "4k";
export type QualityId = "default";
export type ReferenceSource = "generated" | "upload";
export type GenerationStatus =
  | "idle"
  | "ready"
  | "loading"
  | "success"
  | "validation_error"
  | "provider_error"
  | "empty_result";

export type AspectRatioOption = {
  id: AspectRatioId;
  label: string;
};

export type ResolutionOption = {
  id: ResolutionId;
  label: string;
};

export type QualityOption = {
  id: QualityId;
  label: string;
};

export type ModelOption = {
  id: VisibleModelId;
  label: string;
  maxReferences: number;
  preset: string;
  provider: ProviderName;
  providerModelId: string;
  /** Provider-specific model ID for img>img mode; if absent, img>img is unsupported. */
  providerImg2ImgModelId?: string;
  supportedAspectRatios: AspectRatioId[];
  supportedMimeTypes: string[];
  supportedQualities: QualityId[];
  supportedResolutions: ResolutionId[];
};

export type ReferenceImage = {
  id: string;
  mimeType: string;
  name: string;
  previewUrl: string;
  source: ReferenceSource;
};

export type GenerationResult = {
  createdAt: number;
  filename: string;
  imageUrl: string;
  mimeType: string;
  sourceModelLabel: string;
};

export type AppError = {
  kind: "validation" | "provider" | "network" | "malformed" | "empty";
  message: string;
};

export type PlaygroundState = {
  apiKey: string;
  aspectRatio: AspectRatioId;
  error: AppError | null;
  mode: GenerationMode;
  prompt: string;
  quality: QualityId;
  references: ReferenceImage[];
  resolution: ResolutionId;
  result: GenerationResult | null;
  selectedModel: VisibleModelId;
  status: GenerationStatus;
};

export type PlaygroundAction =
  | { type: "add_references"; payload: ReferenceImage[] }
  | { type: "generate_start" }
  | { type: "generate_success"; payload: GenerationResult }
  | { type: "remove_reference"; payload: string }
  | { type: "reset_model_defaults"; payload: VisibleModelId }
  | { type: "set_error"; payload: AppError }
  | { type: "sync_state"; payload: PlaygroundState };
