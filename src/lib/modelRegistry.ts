import type {
  AspectRatioOption,
  ModelOption,
  ProviderName,
  QualityOption,
  ResolutionOption,
} from "./types";

export const ALL_ASPECT_RATIOS: AspectRatioOption[] = [
  { id: "auto", label: "auto" },
  { id: "21:9", label: "21:9" },
  { id: "16:9", label: "16:9" },
  { id: "3:2", label: "3:2" },
  { id: "4:3", label: "4:3" },
  { id: "5:4", label: "5:4" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "3:4", label: "3:4" },
  { id: "2:3", label: "2:3" },
  { id: "9:16", label: "9:16" },
];

export const ALL_RESOLUTIONS: ResolutionOption[] = [
  { id: "default", label: "Default" },
  { id: "0.5k", label: "0.5K" },
  { id: "1k", label: "1K" },
  { id: "2k", label: "2K" },
  { id: "4k", label: "4K" },
];

export const ALL_QUALITIES: QualityOption[] = [
  { id: "default", label: "Default (provider)" },
];

export const modelOptions: ModelOption[] = [
  {
    id: "nano-banana-2-fast",
    label: "Nano Banana 2 — Fast",
    provider: "google",
    providerModelId: "gemini-3.1-flash-image-preview",
    preset: "low-latency",
    supportedAspectRatios: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    supportedResolutions: ["default", "0.5k", "1k", "2k"],
    supportedQualities: ["default"],
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    maxReferences: 4,
  },
  {
    id: "nano-banana-2-thinking",
    label: "Nano Banana 2 — Thinking",
    provider: "google",
    providerModelId: "gemini-3.1-flash-image-preview",
    preset: "higher-thinking",
    supportedAspectRatios: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    supportedResolutions: ["default", "0.5k", "1k", "2k"],
    supportedQualities: ["default"],
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    maxReferences: 4,
  },
  {
    id: "nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "google",
    providerModelId: "gemini-3-pro-image-preview",
    preset: "pro",
    supportedAspectRatios: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    supportedResolutions: ["default", "1k", "2k", "4k"],
    supportedQualities: ["default"],
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    maxReferences: 6,
  },
  {
    id: "nano-banana-fal-fast",
    label: "Nano Banana FAL — Fast",
    provider: "fal",
    providerModelId: "fal-ai/flux/schnell",
    preset: "fast",
    supportedAspectRatios: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    supportedResolutions: ["default", "1k"],
    supportedQualities: ["default"],
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    maxReferences: 0,
  },
  {
    id: "nano-banana-fal-quality",
    label: "Nano Banana FAL — Quality",
    provider: "fal",
    providerModelId: "fal-ai/flux/dev",
    providerImg2ImgModelId: "fal-ai/flux/dev/image-to-image",
    preset: "quality",
    supportedAspectRatios: ["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    supportedResolutions: ["default", "1k", "2k"],
    supportedQualities: ["default"],
    supportedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    maxReferences: 4,
  },
];

export function getModelOption(modelId: ModelOption["id"]) {
  const model = modelOptions.find((option) => option.id === modelId);

  if (!model) {
    throw new Error(`Unknown model option: ${modelId}`);
  }

  return model;
}

export function getProviderModels(provider: ProviderName): ModelOption[] {
  return modelOptions.filter((m) => m.provider === provider);
}
