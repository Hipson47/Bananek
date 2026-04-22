import { decodeProcessedDataUrl } from "../processors/data-url.js";
import type { PresetId } from "../types.js";
import { analyzeImage } from "./analysis.js";
import type { EnhancementExecutionResult, ImageAnalysis, VerificationResult } from "./types.js";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function deriveSuggestedReplan(presetId: PresetId, issues: string[]): string | null {
  const joined = issues.join(" ").toLowerCase();

  if (joined.includes("background") || joined.includes("white")) {
    return presetId === "clean-background"
      ? "background_then_relight_then_upscale"
      : "conservative_marketplace_fix";
  }

  if (joined.includes("dark") || joined.includes("underexposed")) {
    return presetId === "studio-polish" ? "premium_retouch_pipeline" : "sharp_then_ai";
  }

  if (joined.includes("contrast") || joined.includes("tonal")) {
    return "sharp_then_ai";
  }

  if (joined.includes("square")) {
    return "conservative_marketplace_fix";
  }

  return null;
}

export async function verifyEnhancementOutput(args: {
  presetId: PresetId;
  inputAnalysis: ImageAnalysis;
  output: EnhancementExecutionResult;
}): Promise<VerificationResult> {
  const outputBuffer = decodeProcessedDataUrl(args.output.processedUrl, args.output.mimeType);
  const outputAnalysis = await analyzeImage(outputBuffer, args.output.mimeType);
  const issues: string[] = [];
  let penalty = 0;

  if (args.presetId === "clean-background") {
    if (!outputAnalysis.background.likelyWhite) {
      issues.push("output background is not confidently white.");
      penalty += 0.28;
    }

    if (outputAnalysis.quality.brightnessScore < 0.55) {
      issues.push("output remains too dark for clean-background delivery.");
      penalty += 0.18;
    }
  }

  if (args.presetId === "marketplace-ready") {
    if (!outputAnalysis.marketplaceSignals.squareComposition) {
      issues.push("output is not square enough for marketplace presentation.");
      penalty += 0.28;
    }

    if (!outputAnalysis.marketplaceSignals.whiteBackgroundLikely) {
      issues.push("output background is not clearly white.");
      penalty += 0.24;
    }

    if (!outputAnalysis.marketplaceSignals.brightnessAcceptable) {
      issues.push("output is too dark for marketplace presentation.");
      penalty += 0.16;
    }

    if (!outputAnalysis.marketplaceSignals.contrastAcceptable) {
      issues.push("output lacks catalog contrast for marketplace presentation.");
      penalty += 0.12;
    }
  }

  if (args.presetId === "studio-polish") {
    if (outputAnalysis.quality.brightnessScore < 0.35) {
      issues.push("output remains underexposed for studio polish.");
      penalty += 0.18;
    }

    if (outputAnalysis.quality.contrastScore < 0.05) {
      issues.push("output lacks tonal separation for studio polish.");
      penalty += 0.16;
    }
  }

  const score = clamp01(1 - penalty);
  const passed = issues.length === 0 || score >= 0.74;
  const suggestedReplan = passed ? null : deriveSuggestedReplan(args.presetId, issues);

  if (passed) {
    return {
      passed: true,
      score,
      issues: [],
      suggestedReplan: null,
      accepted: true,
      status: "accepted",
      reasons: [],
      recommendedStrategy: null,
      outputAnalysis,
    };
  }

  const recommendedStrategy = suggestedReplan === "premium_retouch_pipeline"
    ? "ai-then-sharp"
    : suggestedReplan === "sharp_then_ai"
      ? "sharp-then-ai"
      : suggestedReplan === "background_then_relight_then_upscale"
        ? "ai-then-sharp"
        : args.presetId === "studio-polish"
          ? "ai-only"
          : "sharp-only";

  return {
    passed: false,
    score,
    issues,
    suggestedReplan,
    accepted: false,
    status: "retry",
    reasons: issues,
    recommendedStrategy,
    outputAnalysis,
  };
}
