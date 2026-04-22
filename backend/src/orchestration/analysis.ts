import sharp from "sharp";

import type { ImageAnalysis } from "./types.js";

const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp"]);
const THUMBNAIL_SIZE = 16;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function detectCropQuality(aspectRatio: number): ImageAnalysis["framing"]["cropQuality"] {
  if (aspectRatio >= 0.95 && aspectRatio <= 1.05) {
    return "square";
  }

  if (aspectRatio >= 0.8 && aspectRatio <= 1.25) {
    return "balanced";
  }

  if (aspectRatio > 1.25) {
    return "wide";
  }

  return "tall";
}

function computeBorderMetrics(pixels: Buffer, width: number, height: number) {
  const borderBrightness: number[] = [];
  const borderSamples: Array<[number, number, number]> = [];
  const nonBorderSamples: Array<[number, number, number]> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const rgb: [number, number, number] = [
        pixels[offset],
        pixels[offset + 1],
        pixels[offset + 2],
      ];
      const brightness = average(rgb) / 255;
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;

      if (isBorder) {
        borderBrightness.push(brightness);
        borderSamples.push(rgb);
      } else {
        nonBorderSamples.push(rgb);
      }
    }
  }

  const borderRgbMean: [number, number, number] = [
    Math.round(average(borderSamples.map((rgb) => rgb[0]))),
    Math.round(average(borderSamples.map((rgb) => rgb[1]))),
    Math.round(average(borderSamples.map((rgb) => rgb[2]))),
  ];
  const borderBrightnessScore = average(borderBrightness);

  const borderVariance = average(
    borderSamples.map((rgb) => {
      const brightness = average(rgb) / 255;
      return Math.abs(brightness - borderBrightnessScore);
    }),
  );

  const centerBrightnessScore = average(
    nonBorderSamples.map((rgb) => average(rgb) / 255),
  );

  return {
    borderRgbMean,
    borderBrightnessScore,
    borderVariance,
    centerBrightnessScore,
  };
}

export async function analyzeImage(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysis> {
  const image = sharp(imageBuffer, { failOn: "error" });
  const [metadata, stats, thumbnail] = await Promise.all([
    image.metadata(),
    image.stats(),
    sharp(imageBuffer)
      .removeAlpha()
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "fill" })
      .raw()
      .toBuffer(),
  ]);

  if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format)) {
    throw {
      kind: "processing" as const,
      message: "Could not analyze the uploaded image format.",
    };
  }

  if (!metadata.width || !metadata.height) {
    throw {
      kind: "processing" as const,
      message: "Could not analyze the uploaded image dimensions.",
    };
  }

  const meanValues = stats.channels.slice(0, 3).map((channel) => channel.mean / 255);
  const stdevValues = stats.channels.slice(0, 3).map((channel) => channel.stdev / 128);
  const dominantRgb: [number, number, number] = [
    stats.dominant.r,
    stats.dominant.g,
    stats.dominant.b,
  ];
  const borderMetrics = computeBorderMetrics(thumbnail, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  const aspectRatio = metadata.width / metadata.height;
  const squareScore = clamp01(1 - Math.min(1, Math.abs(aspectRatio - 1)));
  const brightnessScore = clamp01(average(meanValues));
  const contrastScore = clamp01(average(stdevValues));
  const sharpnessScore = clamp01(stats.sharpness / 12);
  const whiteBackgroundLikely =
    borderMetrics.borderBrightnessScore >= 0.9 &&
    borderMetrics.borderVariance <= 0.04;
  const likelyPlain =
    borderMetrics.borderVariance <= 0.05 ||
    Math.abs(borderMetrics.borderBrightnessScore - borderMetrics.centerBrightnessScore) <= 0.08;

  const marketplaceSignals = {
    squareComposition: squareScore >= 0.95,
    whiteBackgroundLikely,
    brightnessAcceptable: brightnessScore >= 0.55,
    contrastAcceptable: contrastScore >= 0.08,
    readyScore: clamp01(
      (squareScore * 0.35)
      + (whiteBackgroundLikely ? 0.35 : 0)
      + (brightnessScore >= 0.55 ? 0.15 : brightnessScore * 0.15)
      + (contrastScore >= 0.08 ? 0.15 : contrastScore * 0.15),
    ),
  };

  return {
    format: metadata.format as "jpeg" | "png" | "webp",
    mimeType,
    dimensions: {
      width: metadata.width,
      height: metadata.height,
    },
    aspectRatio,
    hasAlpha: Boolean(metadata.hasAlpha),
    quality: {
      brightnessScore,
      contrastScore,
      sharpnessScore,
    },
    background: {
      dominantRgb,
      likelyPlain,
      likelyWhite: whiteBackgroundLikely,
      borderBrightnessScore: borderMetrics.borderBrightnessScore,
    },
    framing: {
      squareScore,
      cropQuality: detectCropQuality(aspectRatio),
    },
    marketplaceSignals,
  };
}
