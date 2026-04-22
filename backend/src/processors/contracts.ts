import type { PresetId, ProcessedImageResult } from "../types.js";

export type EnhancementProcessor = "mock" | "sharp" | "fal";

export type ProcessorPromptContext = {
  variant: "primary" | "retry";
  text: string;
  directives: string[];
  guidanceScale: number;
};

export type ProcessorExecutionOptions = {
  stage: "primary" | "retry" | "fallback";
  requestId?: string;
  prompt?: ProcessorPromptContext;
};

export type ImageProcessorFn = (
  imageBuffer: Buffer,
  originalMime: string,
  presetId: PresetId,
  options?: ProcessorExecutionOptions,
) => Promise<ProcessedImageResult>;

export type EnhancementProcessorMap = Record<EnhancementProcessor, ImageProcessorFn>;
