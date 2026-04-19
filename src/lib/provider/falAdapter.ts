import type { AppError, AspectRatioId, ResolutionId } from "../types";
import type { GenerateRequest, GenerateResponse } from "./contracts";
import type { ProviderAdapter } from "./providerAdapter";

const FAL_BASE = "https://fal.run";

// FAL preset names map to these base pixel dimensions (long edge ~1024)
const FAL_PRESET_DIMS: Record<string, { width: number; height: number }> = {
  square_hd: { width: 1024, height: 1024 },
  square: { width: 512, height: 512 },
  landscape_16_9: { width: 1024, height: 576 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  portrait_4_3: { width: 768, height: 1024 },
};

type FalImageSize = string | { width: number; height: number };

const ASPECT_RATIO_TO_FAL_SIZE: Record<AspectRatioId, FalImageSize> = {
  auto: "square_hd",
  "1:1": "square_hd",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
  "21:9": { width: 1344, height: 576 },
  "3:2": { width: 1152, height: 768 },
  "5:4": { width: 1280, height: 1024 },
  "4:5": { width: 1024, height: 1280 },
  "2:3": { width: 768, height: 1152 },
};

// Scale factor relative to the 1k (1024px) base
const RESOLUTION_SCALE: Record<ResolutionId, number | null> = {
  default: null,
  "0.5k": 0.5,
  "1k": 1.0,
  "2k": 2.0,
  "4k": 4.0,
};

function round64(n: number): number {
  return Math.max(64, Math.round(n / 64) * 64);
}

function getFalImageSize(aspectRatio: AspectRatioId, resolution: ResolutionId): FalImageSize {
  const base = ASPECT_RATIO_TO_FAL_SIZE[aspectRatio];
  const scale = RESOLUTION_SCALE[resolution];

  if (scale === null) return base;

  const dims = typeof base === "string" ? FAL_PRESET_DIMS[base] : base;
  if (!dims) return base;

  return { width: round64(dims.width * scale), height: round64(dims.height * scale) };
}

function makeAppError(kind: AppError["kind"], message: string): AppError {
  return { kind, message };
}

/** Convert a blob: URL or data URL to a full data URL (base64). */
async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export class FalAdapter implements ProviderAdapter {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const { apiKey, model, prompt, aspectRatio, resolution, references, mode } = request;

    const isImg2Img = mode === "img>img" && references.length > 0;
    const modelId = isImg2Img ? model.providerImg2ImgModelId : model.providerModelId;

    if (!modelId) {
      throw makeAppError("provider", `${model.label} does not support image-to-image mode.`);
    }

    const imageSize = getFalImageSize(aspectRatio, resolution);

    let body: Record<string, unknown> = {
      prompt,
      image_size: imageSize,
      num_images: 1,
    };

    if (isImg2Img) {
      let imageUrl: string;
      try {
        imageUrl = await toDataUrl(references[0].previewUrl);
      } catch {
        throw makeAppError("network", `Failed to read reference image: ${references[0].name}`);
      }
      body = { ...body, image_url: imageUrl, strength: 0.8 };
    }

    const url = `${FAL_BASE}/${modelId}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw makeAppError(
        "network",
        `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!response.ok) {
      let message = `FAL API error ${response.status}: ${response.statusText}`;
      try {
        const errBody = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
        if (typeof errBody?.detail === "string") {
          message = errBody.detail;
        } else if (Array.isArray(errBody?.detail) && errBody.detail[0]?.msg) {
          message = errBody.detail[0].msg;
        }
      } catch {
        // ignore
      }
      throw makeAppError("provider", message);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw makeAppError("malformed", "Failed to parse FAL API response.");
    }

    const outputUrl = extractImageUrl(data);
    const mimeType = extractMimeType(data) ?? "image/jpeg";

    if (!outputUrl) {
      throw makeAppError("empty", "FAL returned no image in the response.");
    }

    const ext = mimeType.split("/")[1] ?? "jpg";

    return {
      createdAt: Date.now(),
      filename: `nano-banana-${model.id}-${Date.now()}.${ext}`,
      imageUrl: outputUrl,
      mimeType,
      sourceModelLabel: model.label,
    };
  }
}

function extractImageUrl(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  const images = d.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as Record<string, unknown>;
  return typeof first.url === "string" ? first.url : null;
}

function extractMimeType(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  const images = d.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as Record<string, unknown>;
  return typeof first.content_type === "string" ? first.content_type : null;
}
