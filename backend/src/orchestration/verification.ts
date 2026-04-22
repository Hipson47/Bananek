import { decodeProcessedDataUrl } from "../processors/data-url.js";
import type { PresetId } from "../types.js";
import { analyzeImage } from "./analysis.js";
import type { EnhancementExecutionResult, EnhancementPlan, ImageAnalysis, VerificationResult } from "./types.js";

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
  plan?: Pick<EnhancementPlan, "strategy" | "selectedCandidateId"> | null;
}): Promise<VerificationResult> {
  const outputBuffer = decodeProcessedDataUrl(args.output.processedUrl, args.output.mimeType);
  const outputAnalysis = await analyzeImage(outputBuffer, args.output.mimeType);
  const isMicroAsset =
    outputAnalysis.dimensions.width < 64 || outputAnalysis.dimensions.height < 64;

  if (args.plan?.strategy === "mock-only") {
    return {
      passed: true,
      score: 1,
      issues: [],
      suggestedReplan: null,
      accepted: true,
      status: "accepted",
      reasons: [],
      recommendedStrategy: null,
      outputAnalysis,
    };
  }

  const issues: string[] = [];
  let penalty = 0;
  const readyDelta = outputAnalysis.marketplaceSignals.readyScore - args.inputAnalysis.marketplaceSignals.readyScore;
  const brightnessDelta = outputAnalysis.quality.brightnessScore - args.inputAnalysis.quality.brightnessScore;
  const contrastDelta = outputAnalysis.quality.contrastScore - args.inputAnalysis.quality.contrastScore;

  if (args.presetId === "clean-background") {
    const allowSoftBackgroundOnDeterministicMicroAsset =
      isMicroAsset
      && args.plan?.strategy === "sharp-only"
      && outputAnalysis.background.borderBrightnessScore >= 0.45;

    if (!outputAnalysis.background.likelyWhite && !allowSoftBackgroundOnDeterministicMicroAsset) {
      issues.push("output background is not confidently white.");
      penalty += 0.28;
    }

    if (outputAnalysis.quality.brightnessScore < (isMicroAsset ? 0.35 : 0.55)) {
      issues.push("output remains too dark for clean-background delivery.");
      penalty += 0.18;
    }

    if (brightnessDelta < -0.08) {
      issues.push("output regressed brightness compared with the uploaded image.");
      penalty += 0.14;
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

    if (!outputAnalysis.marketplaceSignals.brightnessAcceptable && !isMicroAsset) {
      issues.push("output is too dark for marketplace presentation.");
      penalty += 0.16;
    }

    if (!outputAnalysis.marketplaceSignals.contrastAcceptable && !isMicroAsset) {
      issues.push("output lacks catalog contrast for marketplace presentation.");
      penalty += 0.12;
    }

    if (!isMicroAsset && readyDelta < -0.08) {
      issues.push("output regressed marketplace readiness compared with the uploaded image.");
      penalty += 0.22;
    } else if (
      !isMicroAsset
      &&
      args.inputAnalysis.marketplaceSignals.readyScore < 0.72
      && outputAnalysis.marketplaceSignals.readyScore <= args.inputAnalysis.marketplaceSignals.readyScore + 0.03
    ) {
      issues.push("output did not materially improve marketplace readiness.");
      penalty += 0.16;
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

    if (contrastDelta < -0.03) {
      issues.push("output reduced tonal separation compared with the uploaded image.");
      penalty += 0.14;
    }
  }

  if (
    args.plan?.selectedCandidateId === "background_then_relight_then_upscale"
    && !outputAnalysis.background.likelyWhite
  ) {
    issues.push("background repair plan did not deliver a clearly white output background.");
    penalty += 0.18;
  }

  if (
    args.plan?.strategy === "sharp-only"
    && args.presetId === "marketplace-ready"
    && args.inputAnalysis.marketplaceSignals.readyScore > 0.82
    && readyDelta < -0.03
  ) {
    issues.push("deterministic output regressed a near-ready marketplace image.");
    penalty += 0.16;
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
