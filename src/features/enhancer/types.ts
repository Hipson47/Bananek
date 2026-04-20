export type EnhancementPreset = {
  id: "clean-background" | "marketplace-ready" | "studio-polish";
  name: string;
  description: string;
};

export type ProcessImageInput = {
  file: File;
  preset: EnhancementPreset;
};

export type ProcessedImageResult = {
  filename: string;
  mimeType: string;
  processedUrl: string;
  processorLabel: string;
};

export interface ImageProcessor {
  processImage(input: ProcessImageInput): Promise<ProcessedImageResult>;
}
