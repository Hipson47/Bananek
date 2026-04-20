// Archived reference only.
// This browser-side mock processor is no longer part of the active app path.
// The live enhancement flow uses BackendProcessor -> POST /api/enhance.

import type {
  EnhancementPreset,
  ImageProcessor,
  ProcessImageInput,
  ProcessedImageResult,
} from "../types";

const LATENCY_MS = 1400;
const OUTPUT_MIME_TYPE = "image/jpeg";

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read the uploaded image."));
        return;
      }

      resolve(reader.result);
    };
    reader.onerror = () => {
      reject(new Error("Could not read the uploaded image."));
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("The uploaded image could not be decoded."));
    image.src = source;
  });
}

function buildOutputFilename(originalName: string, preset: EnhancementPreset) {
  const safeBaseName = originalName.replace(/\.[^/.]+$/, "").trim() || "product";
  return `${safeBaseName}-${preset.id}.jpg`;
}

function createCanvasForPreset(preset: EnhancementPreset) {
  const canvas = document.createElement("canvas");

  if (preset.id === "studio-polish") {
    canvas.width = 1600;
    canvas.height = 1200;
    return canvas;
  }

  canvas.width = 1400;
  canvas.height = 1400;
  return canvas;
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  preset: EnhancementPreset,
) {
  if (preset.id === "clean-background") {
    ctx.fillStyle = "#fcfcfb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (preset.id === "marketplace-ready") {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#f6f3ec");
    gradient.addColorStop(1, "#e7e0d4");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#101727");
  gradient.addColorStop(0.55, "#20404e");
  gradient.addColorStop(1, "#f0be72");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawProduct(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  preset: EnhancementPreset,
) {
  const maxWidth = canvas.width * 0.7;
  const maxHeight = canvas.height * 0.72;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2 - (preset.id === "studio-polish" ? 24 : 0);

  ctx.save();
  ctx.shadowColor = "rgba(12, 18, 28, 0.18)";
  ctx.shadowBlur = preset.id === "studio-polish" ? 52 : 30;
  ctx.shadowOffsetY = preset.id === "studio-polish" ? 26 : 18;
  ctx.filter =
    preset.id === "clean-background"
      ? "contrast(1.02) brightness(1.03)"
      : preset.id === "marketplace-ready"
        ? "contrast(1.08) saturate(1.05)"
        : "contrast(1.1) saturate(1.08) brightness(1.03)";

  ctx.drawImage(image, x, y, width, height);
  ctx.restore();

  if (preset.id !== "clean-background") {
    ctx.save();
    ctx.fillStyle =
      preset.id === "marketplace-ready"
        ? "rgba(255,255,255,0.58)"
        : "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.ellipse(
      canvas.width / 2,
      y + height + 42,
      width * 0.33,
      36,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
}

export class MockImageProcessor implements ImageProcessor {
  async processImage({
    file,
    preset,
  }: ProcessImageInput): Promise<ProcessedImageResult> {
    const [dataUrl] = await Promise.all([fileToDataUrl(file), wait(LATENCY_MS)]);
    const image = await loadImage(dataUrl);
    const canvas = createCanvasForPreset(preset);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas processing is not available in this browser.");
    }

    drawBackground(ctx, canvas, preset);
    drawProduct(ctx, canvas, image, preset);

    return {
      filename: buildOutputFilename(file.name, preset),
      mimeType: OUTPUT_MIME_TYPE,
      processedUrl: canvas.toDataURL(OUTPUT_MIME_TYPE, 0.92),
      processorLabel: "Mock commerce enhancement pipeline",
    };
  }
}
