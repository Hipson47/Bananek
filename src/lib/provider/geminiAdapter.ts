import type { AppError, ResolutionId } from "../types";
import type { GenerateRequest, GenerateResponse } from "./contracts";
import type { ProviderAdapter } from "./providerAdapter";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const RESOLUTION_TO_IMAGE_SIZE: Record<ResolutionId, string | null> = {
  default: null,
  "0.5k": "512",
  "1k": "1K",
  "2k": "2K",
  "4k": "4K",
};

function makeAppError(kind: AppError["kind"], message: string): AppError {
  return { kind, message };
}

async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    return url.split(",")[1];
  }
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export class GeminiAdapter implements ProviderAdapter {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const { apiKey, model, prompt, aspectRatio, resolution, references, mode } = request;

    const parts: unknown[] = [{ text: prompt }];

    if (mode === "img>img" && references.length > 0) {
      for (const ref of references) {
        let base64: string;
        try {
          base64 = await urlToBase64(ref.previewUrl);
        } catch {
          throw makeAppError("network", `Failed to read reference image: ${ref.name}`);
        }
        parts.push({ inline_data: { mime_type: ref.mimeType, data: base64 } });
      }
    }

    const imageConfig: Record<string, string> = {};
    if (aspectRatio !== "auto") {
      imageConfig.aspectRatio = aspectRatio;
    }
    const imageSize = RESOLUTION_TO_IMAGE_SIZE[resolution];
    if (imageSize) {
      imageConfig.imageSize = imageSize;
    }

    const body = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
      },
    };

    const url = `${GEMINI_BASE}/${model.providerModelId}:generateContent`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
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
      let message = `Gemini API error ${response.status}: ${response.statusText}`;
      try {
        const errBody = (await response.json()) as { error?: { message?: string } };
        if (errBody?.error?.message) message = errBody.error.message;
      } catch {
        // ignore
      }
      throw makeAppError("provider", message);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw makeAppError("malformed", "Failed to parse Gemini API response.");
    }

    const imagePart = extractImagePart(data);
    if (!imagePart) {
      throw makeAppError("empty", "Gemini returned no image in the response.");
    }

    const { mimeType, data: b64 } = imagePart;
    const ext = mimeType.split("/")[1] ?? "png";

    return {
      createdAt: Date.now(),
      filename: `nano-banana-${model.id}-${Date.now()}.${ext}`,
      imageUrl: `data:${mimeType};base64,${b64}`,
      mimeType,
      sourceModelLabel: model.label,
    };
  }
}

function extractImagePart(data: unknown): { mimeType: string; data: string } | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  const candidates = d.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const content = (candidates[0] as Record<string, unknown>).content;
  if (typeof content !== "object" || content === null) return null;
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (typeof part !== "object" || part === null) continue;
    const p = part as Record<string, unknown>;

    const inline = (p.inlineData ?? p.inline_data) as Record<string, string> | undefined;
    if (!inline) continue;

    const mimeType = inline.mimeType ?? inline.mime_type;
    const imageData = inline.data;
    if (mimeType && imageData) return { mimeType, data: imageData };
  }
  return null;
}
