import type {
  AspectRatioId,
  ModelOption,
  QualityId,
  ReferenceImage,
  ResolutionId,
} from "../types";

export type GenerateRequest = {
  apiKey: string;
  aspectRatio: AspectRatioId;
  mode: "txt>img" | "img>img";
  model: ModelOption;
  prompt: string;
  quality: QualityId;
  references: ReferenceImage[];
  resolution: ResolutionId;
};

export type GenerateResponse = {
  createdAt: number;
  filename: string;
  imageUrl: string;
  mimeType: string;
  sourceModelLabel: string;
};
