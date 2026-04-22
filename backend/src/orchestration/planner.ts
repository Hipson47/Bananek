import type { AppConfig } from "../config.js";
import type { EnhancementPlan, EnhancementPlanStrategy, ImageAnalysis } from "./types.js";
import { buildAiPrompt } from "./prompt-builder.js";
import type { PresetId } from "../types.js";

function createPlan(args: {
  presetId: PresetId;
  originalMimeType: string;
  analysis: ImageAnalysis;
  config: AppConfig;
  strategy: EnhancementPlanStrategy;
  reason: string;
  promptVariant?: "primary" | "retry";
}): EnhancementPlan {
  const fallbackStrategy =
    args.config.processorFailurePolicy === "fallback-to-sharp" &&
    args.strategy !== "sharp-only" &&
    args.strategy !== "mock-only"
      ? "sharp-only"
      : null;

  if (args.strategy === "mock-only") {
    return {
      strategy: "mock-only",
      reason: args.reason,
      steps: [{ processor: "mock", purpose: "deterministic" }],
      fallbackStrategy,
      verificationPolicy: "accept",
    };
  }

  if (args.strategy === "sharp-only") {
    return {
      strategy: "sharp-only",
      reason: args.reason,
      steps: [{ processor: "sharp", purpose: "deterministic" }],
      fallbackStrategy,
      verificationPolicy: "retry-once",
    };
  }

  const prompt = buildAiPrompt({
    presetId: args.presetId,
    analysis: args.analysis,
    originalMimeType: args.originalMimeType,
    variant: args.promptVariant ?? "primary",
  });

  if (args.strategy === "ai-only") {
    return {
      strategy: "ai-only",
      reason: args.reason,
      steps: [{ processor: "fal", purpose: "creative", prompt }],
      fallbackStrategy,
      verificationPolicy: "retry-once",
    };
  }

  if (args.strategy === "sharp-then-ai") {
    return {
      strategy: "sharp-then-ai",
      reason: args.reason,
      steps: [
        { processor: "sharp", purpose: "deterministic" },
        { processor: "fal", purpose: "creative", prompt },
      ],
      fallbackStrategy,
      verificationPolicy: "retry-once",
    };
  }

  return {
    strategy: "ai-then-sharp",
    reason: args.reason,
    steps: [
      { processor: "fal", purpose: "creative", prompt },
      { processor: "sharp", purpose: "normalize" },
    ],
    fallbackStrategy,
    verificationPolicy: "retry-once",
  };
}

function chooseStrategy(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  config: AppConfig;
}): { strategy: EnhancementPlanStrategy; reason: string } {
  if (args.config.processor === "mock") {
    return {
      strategy: "mock-only",
      reason: "mock processor configured for contract-safe execution.",
    };
  }

  if (args.config.processor === "sharp") {
    return {
      strategy: "sharp-only",
      reason: "deterministic processor is configured as the active execution path.",
    };
  }

  if (args.presetId === "clean-background") {
    if (args.analysis.background.likelyWhite && args.analysis.background.likelyPlain) {
      return {
        strategy: "sharp-only",
        reason: "input already has a plain bright background, so deterministic cleanup is sufficient.",
      };
    }

    return {
      strategy: "ai-then-sharp",
      reason: "background isolation likely needs stronger AI cleanup before deterministic normalization.",
    };
  }

  if (args.presetId === "marketplace-ready") {
    if (args.analysis.marketplaceSignals.readyScore >= 0.78) {
      return {
        strategy: "sharp-only",
        reason: "input is already close to marketplace-ready, so deterministic polish is preferred.",
      };
    }

    return {
      strategy: "ai-then-sharp",
      reason: "input needs stronger marketplace correction for framing or background cleanup.",
    };
  }

  if (
    args.analysis.quality.brightnessScore < 0.4 ||
    args.analysis.quality.contrastScore < 0.08
  ) {
    return {
      strategy: "ai-only",
      reason: "input needs stronger studio relighting before deterministic finishing would help.",
    };
  }

  return {
    strategy: "sharp-only",
    reason: "input quality is sufficient for deterministic studio polish.",
  };
}

export function buildEnhancementPlan(args: {
  presetId: PresetId;
  originalMimeType: string;
  analysis: ImageAnalysis;
  config: AppConfig;
  forcedStrategy?: EnhancementPlanStrategy;
  promptVariant?: "primary" | "retry";
  reasonOverride?: string;
}): EnhancementPlan {
  const selected = args.forcedStrategy
    ? {
        strategy: args.forcedStrategy,
        reason: args.reasonOverride ?? "strategy forced by orchestration fallback or retry policy.",
      }
    : chooseStrategy(args);

  return createPlan({
    presetId: args.presetId,
    originalMimeType: args.originalMimeType,
    analysis: args.analysis,
    config: args.config,
    strategy: selected.strategy,
    reason: selected.reason,
    promptVariant: args.promptVariant,
  });
}
