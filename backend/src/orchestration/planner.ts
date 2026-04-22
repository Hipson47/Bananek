import type { AppConfig } from "../config.js";
import type { PresetId } from "../types.js";
import type {
  CandidatePlan,
  ConsistencyMemory,
  EnhancementPlan,
  EnhancementPlanStep,
  EnhancementPlanStrategy,
  ImageAnalysis,
} from "./types.js";
import { buildAiPrompt } from "./prompt-builder.js";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function inferSignalScores(analysis: ImageAnalysis) {
  const blur = clamp01(1 - analysis.quality.sharpnessScore);
  const lowContrast = clamp01(1 - analysis.quality.contrastScore);
  const borderIssues = clamp01(
    (analysis.background.likelyWhite ? 0 : 0.6)
    + (analysis.background.likelyPlain ? 0 : 0.3)
    + (1 - analysis.background.borderBrightnessScore) * 0.3,
  );
  const backgroundQuality = clamp01(
    (analysis.background.likelyWhite ? 0.6 : 0.2)
    + (analysis.background.likelyPlain ? 0.4 : 0.1),
  );
  const productCentering = clamp01(
    (analysis.framing.squareScore * 0.7)
    + (analysis.framing.cropQuality === "balanced" || analysis.framing.cropQuality === "square" ? 0.3 : 0.1),
  );
  const marketplaceReadiness = analysis.marketplaceSignals.readyScore;
  const artifactRisk = clamp01(
    (blur * 0.35)
    + (lowContrast * 0.2)
    + ((analysis.hasAlpha && !analysis.background.likelyWhite) ? 0.15 : 0)
    + ((analysis.framing.cropQuality === "wide" || analysis.framing.cropQuality === "tall") ? 0.15 : 0)
    + (borderIssues * 0.15),
  );

  return {
    blur,
    lowContrast,
    borderIssues,
    backgroundQuality,
    productCentering,
    marketplaceReadiness,
    artifactRisk,
  };
}

function defaultFallbackStrategy(strategy: EnhancementPlanStrategy, config: AppConfig): EnhancementPlanStrategy | null {
  return config.processorFailurePolicy === "fallback-to-sharp"
    && strategy !== "sharp-only"
    && strategy !== "mock-only"
    ? "sharp-only"
    : null;
}

function buildCandidate(id: string, strategy: string, orderedSteps: EnhancementPlanStep[]): CandidatePlan {
  return {
    id,
    strategy,
    orderedSteps,
    estimatedCost: 0,
    estimatedLatency: 0,
    expectedQuality: 0,
    confidence: 0,
    score: 0,
    reasons: [],
  };
}

function generateCandidates(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  config: AppConfig;
  consistencyMemory?: ConsistencyMemory | null;
}): CandidatePlan[] {
  if (args.config.processor === "mock") {
    return [
      buildCandidate("mock_only", "mock-only", [
        { processor: "mock", purpose: "deterministic", label: "contract-safe mock execution" },
      ]),
    ];
  }

  if (args.config.processor === "sharp") {
    return [
      buildCandidate("sharp_only", "sharp-only", [
        { processor: "sharp", purpose: "deterministic", label: "deterministic enhancement" },
      ]),
      buildCandidate("conservative_marketplace_fix", "sharp-only", [
        { processor: "sharp", purpose: "repair", label: "conservative catalog repair" },
      ]),
      buildCandidate("premium_retouch_pipeline", "sharp-only", [
        { processor: "sharp", purpose: "repair", label: "premium deterministic retouch" },
      ]),
    ];
  }

  const consistencyNormalizeStep: EnhancementPlanStep = {
    processor: "sharp",
    purpose: "normalize",
    label: args.consistencyMemory?.backgroundStyle ? "match catalog consistency memory" : "normalize final output",
  };

  return [
    buildCandidate("sharp_only", "sharp-only", [
      { processor: "sharp", purpose: "deterministic", label: "minimal deterministic repair" },
    ]),
    buildCandidate("ai_only", "ai-only", [
      { processor: "fal", purpose: "creative", label: "single-pass FAL enhancement" },
    ]),
    buildCandidate("ai_then_sharp", "ai-then-sharp", [
      { processor: "fal", purpose: "creative", label: "FAL creative pass" },
      consistencyNormalizeStep,
    ]),
    buildCandidate("sharp_then_ai", "sharp-then-ai", [
      { processor: "sharp", purpose: "repair", label: "pre-repair before AI" },
      { processor: "fal", purpose: "creative", label: "FAL enhancement after repair" },
    ]),
    buildCandidate("background_then_relight_then_upscale", "ai-then-sharp", [
      { processor: "fal", purpose: "background", label: "background cleanup and relight" },
      { processor: "fal", purpose: "upscale", label: "detail recovery and upscale" },
      consistencyNormalizeStep,
    ]),
    buildCandidate("conservative_marketplace_fix", "ai-then-sharp", [
      { processor: "fal", purpose: "repair", label: "conservative marketplace repair" },
      consistencyNormalizeStep,
    ]),
    buildCandidate("premium_retouch_pipeline", "ai-then-sharp", [
      { processor: "fal", purpose: "relight", label: "premium studio relight" },
      { processor: "fal", purpose: "upscale", label: "premium detail polish" },
      consistencyNormalizeStep,
    ]),
  ];
}

function scoreCandidate(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  consistencyMemory?: ConsistencyMemory | null;
  candidate: CandidatePlan;
}): CandidatePlan {
  const signals = inferSignalScores(args.analysis);
  const candidate = { ...args.candidate };
  const falStepCount = candidate.orderedSteps.filter((step) => step.processor === "fal").length;
  const sharpStepCount = candidate.orderedSteps.filter((step) => step.processor === "sharp").length;

  candidate.estimatedCost = clamp01(falStepCount * 0.38 + sharpStepCount * 0.08);
  candidate.estimatedLatency = clamp01(falStepCount * 0.32 + sharpStepCount * 0.08);

  let expectedQuality = 0.45;
  const reasons: string[] = [];

  if (candidate.id === "sharp_only") {
    expectedQuality += args.analysis.marketplaceSignals.readyScore * 0.35;
    expectedQuality += (1 - signals.artifactRisk) * 0.15;
    reasons.push("minimal pipeline");
  }

  if (candidate.id === "ai_only") {
    expectedQuality += signals.borderIssues * 0.2;
    expectedQuality += signals.marketplaceReadiness < 0.7 ? 0.15 : 0.05;
    reasons.push("single AI creative pass");
  }

  if (candidate.id === "ai_then_sharp") {
    expectedQuality += signals.borderIssues * 0.18;
    expectedQuality += signals.marketplaceReadiness < 0.8 ? 0.18 : 0.08;
    expectedQuality += 0.08;
    reasons.push("AI correction followed by deterministic normalization");
  }

  if (candidate.id === "sharp_then_ai") {
    expectedQuality += signals.blur * 0.12;
    expectedQuality += signals.lowContrast * 0.12;
    expectedQuality += 0.1;
    reasons.push("repair-first pipeline");
  }

  if (candidate.id === "background_then_relight_then_upscale") {
    expectedQuality += signals.borderIssues * 0.22;
    expectedQuality += signals.blur * 0.12;
    expectedQuality += signals.lowContrast * 0.1;
    expectedQuality += 0.16;
    reasons.push("heavy repair for weak background or lighting");
  }

  if (candidate.id === "conservative_marketplace_fix") {
    expectedQuality += args.analysis.marketplaceSignals.readyScore * 0.2;
    expectedQuality += signals.borderIssues * 0.1;
    expectedQuality += 0.08;
    reasons.push("low-risk commerce correction");
  }

  if (candidate.id === "premium_retouch_pipeline") {
    expectedQuality += args.presetId === "studio-polish" ? 0.22 : 0.08;
    expectedQuality += signals.blur * 0.08;
    expectedQuality += signals.lowContrast * 0.08;
    reasons.push("premium multi-step retouch");
  }

  if (args.presetId === "clean-background") {
    expectedQuality += candidate.orderedSteps.some((step) => step.purpose === "background") ? 0.12 : 0;
  }

  if (args.presetId === "marketplace-ready") {
    expectedQuality += candidate.orderedSteps.some((step) => step.label?.includes("marketplace")) ? 0.08 : 0;
    expectedQuality += signals.productCentering < 0.7 && candidate.id !== "sharp_only" ? 0.08 : 0;
  }

  if (args.consistencyMemory?.backgroundStyle && candidate.orderedSteps.some((step) => step.processor === "sharp")) {
    expectedQuality += 0.04;
    reasons.push("reuses consistency memory");
  }

  candidate.expectedQuality = clamp01(expectedQuality);
  candidate.confidence = clamp01(
    (1 - signals.artifactRisk) * 0.35
    + args.analysis.marketplaceSignals.readyScore * 0.25
    + (signals.productCentering * 0.2)
    + (signals.backgroundQuality * 0.2),
  );

  candidate.score = clamp01(
    candidate.expectedQuality * 0.55
    + candidate.confidence * 0.25
    + (1 - candidate.estimatedLatency) * 0.1
    + (1 - candidate.estimatedCost) * 0.1,
  );

  if (signals.blur > 0.55 && candidate.id === "sharp_then_ai") {
    candidate.score = clamp01(candidate.score + 0.08);
    reasons.push("selected for blur repair");
  }

  if (args.analysis.marketplaceSignals.readyScore > 0.82 && candidate.id === "sharp_only") {
    candidate.score = clamp01(candidate.score + 0.1);
    reasons.push("image already close to target quality");
  }

  if (signals.borderIssues > 0.6 && candidate.id === "background_then_relight_then_upscale") {
    candidate.score = clamp01(candidate.score + 0.08);
    reasons.push("strong border/background issues detected");
  }

  candidate.reasons = reasons;
  return candidate;
}

function mapCandidateToStrategy(strategy: string): EnhancementPlanStrategy {
  if (strategy === "mock-only" || strategy === "sharp-only" || strategy === "ai-only" || strategy === "sharp-then-ai" || strategy === "ai-then-sharp") {
    return strategy;
  }

  return "ai-then-sharp";
}

export function buildCandidatePlans(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  config: AppConfig;
  consistencyMemory?: ConsistencyMemory | null;
}): CandidatePlan[] {
  return generateCandidates(args)
    .map((candidate) => scoreCandidate({ ...args, candidate }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function selectReplanCandidate(args: {
  candidates: CandidatePlan[];
  attemptedCandidateIds: string[];
  currentCandidateId?: string | null;
  suggestedCandidateId?: string | null;
}): CandidatePlan | null {
  const attempted = new Set(args.attemptedCandidateIds);

  if (args.suggestedCandidateId) {
    const suggested = args.candidates.find((candidate) => candidate.id === args.suggestedCandidateId);
    if (suggested && !attempted.has(suggested.id) && suggested.id !== args.currentCandidateId) {
      return suggested;
    }
  }

  return args.candidates.find(
    (candidate) => candidate.id !== args.currentCandidateId && !attempted.has(candidate.id),
  ) ?? null;
}

export function buildEnhancementPlan(args: {
  presetId: PresetId;
  originalMimeType: string;
  analysis: ImageAnalysis;
  config: AppConfig;
  forcedStrategy?: EnhancementPlanStrategy;
  promptVariant?: "primary" | "retry";
  reasonOverride?: string;
  forcedCandidateId?: string;
  consistencyMemory?: ConsistencyMemory | null;
}): EnhancementPlan {
  const candidates = buildCandidatePlans({
    presetId: args.presetId,
    analysis: args.analysis,
    config: args.config,
    consistencyMemory: args.consistencyMemory,
  });

  const selectedCandidate: CandidatePlan = args.forcedStrategy
    ? {
        id: args.forcedCandidateId ?? args.forcedStrategy,
        strategy: args.forcedStrategy,
        orderedSteps: args.forcedStrategy === "sharp-only"
          ? [{ processor: "sharp", purpose: "deterministic", label: "forced deterministic fallback" }]
          : args.forcedStrategy === "mock-only"
            ? [{ processor: "mock", purpose: "deterministic", label: "forced mock fallback" }]
            : [{ processor: "fal", purpose: "creative", label: "forced AI execution" }],
        estimatedCost: 0.1,
        estimatedLatency: 0.1,
        expectedQuality: 0.6,
        confidence: 0.6,
        score: 0.6,
        reasons: [args.reasonOverride ?? "strategy forced by orchestration fallback or retry policy."],
      }
    : (args.forcedCandidateId
      ? candidates.find((candidate) => candidate.id === args.forcedCandidateId)
      : candidates[0]) ?? candidates[0];

  const strategy = mapCandidateToStrategy(selectedCandidate.strategy);
  const fallbackStrategy = defaultFallbackStrategy(strategy, args.config);
  const aiStep = selectedCandidate.orderedSteps.find((step) => step.processor === "fal");
  const aiPrompt = aiStep
    ? buildAiPrompt({
        presetId: args.presetId,
        analysis: args.analysis,
        originalMimeType: args.originalMimeType,
        variant: args.promptVariant ?? "primary",
      })
    : undefined;

  return {
    strategy,
    reason: args.reasonOverride ?? (selectedCandidate.reasons.join("; ") || `selected candidate ${selectedCandidate.id}`),
    steps: selectedCandidate.orderedSteps.map((step) => ({
      ...step,
      prompt: step.processor === "fal" ? aiPrompt : step.prompt,
    })),
    fallbackStrategy,
    verificationPolicy: "retry-once",
    candidates,
    selectedCandidateId: selectedCandidate.id,
  };
}
