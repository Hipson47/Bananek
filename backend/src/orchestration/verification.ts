import { decodeProcessedDataUrl } from "../processors/data-url.js";
import type { PresetId } from "../types.js";
import { analyzeImage } from "./analysis.js";
import type { EnhancementExecutionResult, ImageAnalysis, VerificationResult } from "./types.js";

export async function verifyEnhancementOutput(args: {
  presetId: PresetId;
  inputAnalysis: ImageAnalysis;
  output: EnhancementExecutionResult;
}): Promise<VerificationResult> {
  const outputBuffer = decodeProcessedDataUrl(args.output.processedUrl, args.output.mimeType);
  const outputAnalysis = await analyzeImage(outputBuffer, args.output.mimeType);
  const reasons: string[] = [];

  if (args.presetId === "clean-background") {
    if (!outputAnalysis.background.likelyWhite) {
      reasons.push("output background is not confidently white.");
    }

    if (outputAnalysis.quality.brightnessScore < 0.55) {
      reasons.push("output remains too dark for clean-background delivery.");
    }
  }

  if (args.presetId === "marketplace-ready") {
    if (!outputAnalysis.marketplaceSignals.squareComposition) {
      reasons.push("output is not square enough for marketplace presentation.");
    }

    if (!outputAnalysis.marketplaceSignals.whiteBackgroundLikely) {
      reasons.push("output background is not clearly white.");
    }

    if (!outputAnalysis.marketplaceSignals.brightnessAcceptable) {
      reasons.push("output is too dark for marketplace presentation.");
    }
  }

  if (args.presetId === "studio-polish") {
    if (outputAnalysis.quality.brightnessScore < 0.35) {
      reasons.push("output remains underexposed for studio polish.");
    }

    if (outputAnalysis.quality.contrastScore < 0.05) {
      reasons.push("output lacks tonal separation for studio polish.");
    }
  }

  if (reasons.length === 0) {
    return {
      accepted: true,
      status: "accepted",
      reasons: [],
      recommendedStrategy: null,
      outputAnalysis,
    };
  }

  const recommendedStrategy =
    args.presetId === "studio-polish" ? "ai-only" : "sharp-only";

  return {
    accepted: false,
    status: "retry",
    reasons,
    recommendedStrategy,
    outputAnalysis,
  };
}
