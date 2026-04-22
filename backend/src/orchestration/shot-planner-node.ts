import type { AppConfig } from "../config.js";
import { callOpenRouterStructured, OpenRouterClientError } from "./openrouter-client.js";
import { buildFallbackNodeResult, isNumberInRange, isObject, isStringArray } from "./node-utils.js";
import type { GraphNodeResult, ImageAnalysis, IntentSpec, ShotPlanCandidate } from "./types.js";

const SHOT_PLANNER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          candidateId: { type: "string", enum: ["option-a", "option-b", "option-c", "option-d"] },
          title: { type: "string" },
          framing: { type: "string", enum: ["square-centered", "balanced-centered", "tight-product"] },
          background: { type: "string", enum: ["pure-white", "clean-white", "neutral", "transparent-cutout"] },
          lighting: { type: "string", enum: ["neutral-lift", "studio-premium", "catalog-clean"] },
          crop: { type: "string", enum: ["loose", "balanced", "tight"] },
          rationale: { type: "string" },
          fitScore: { type: "number" },
          riskFlags: {
            type: "array",
            items: { type: "string" },
            maxItems: 4,
          },
        },
        required: [
          "candidateId",
          "title",
          "framing",
          "background",
          "lighting",
          "crop",
          "rationale",
          "fitScore",
          "riskFlags",
        ],
      },
    },
  },
  required: ["candidates"],
} as const;

function buildDeterministicCandidates(intent: IntentSpec, analysis: ImageAnalysis): ShotPlanCandidate[] {
  const baseBackground = intent.backgroundGoal;
  const baseLighting = intent.lightingGoal;
  const baseFraming = intent.framingGoal;

  return [
    {
      candidateId: "option-a",
      title: "Balanced commerce default",
      framing: baseFraming,
      background: baseBackground,
      lighting: baseLighting,
      crop: "balanced",
      rationale: "Closest deterministic interpretation of the preset with low composition risk.",
      fitScore: Math.max(0.5, analysis.marketplaceSignals.readyScore),
      riskFlags: [],
    },
    {
      candidateId: "option-b",
      title: "Tighter clarity crop",
      framing: baseFraming === "balanced-centered" ? "tight-product" : baseFraming,
      background: baseBackground,
      lighting: baseLighting,
      crop: "tight",
      rationale: "Improves product emphasis when the subject feels visually distant.",
      fitScore: Math.max(0.45, analysis.quality.sharpnessScore),
      riskFlags: analysis.framing.cropQuality === "wide" ? ["may over-tighten crop"] : [],
    },
    {
      candidateId: "option-c",
      title: "Safer centered framing",
      framing: "square-centered",
      background: intent.backgroundGoal === "transparent-cutout" ? "pure-white" : baseBackground,
      lighting: "catalog-clean",
      crop: "balanced",
      rationale: "Optimized for catalog and marketplace consistency.",
      fitScore: Math.max(0.4, analysis.marketplaceSignals.readyScore + 0.1),
      riskFlags: [],
    },
  ];
}

function isShotPlanCandidate(value: unknown): value is ShotPlanCandidate {
  return isObject(value)
    && ["option-a", "option-b", "option-c", "option-d"].includes(String(value.candidateId))
    && typeof value.title === "string"
    && ["square-centered", "balanced-centered", "tight-product"].includes(String(value.framing))
    && ["pure-white", "clean-white", "neutral", "transparent-cutout"].includes(String(value.background))
    && ["neutral-lift", "studio-premium", "catalog-clean"].includes(String(value.lighting))
    && ["loose", "balanced", "tight"].includes(String(value.crop))
    && typeof value.rationale === "string"
    && isNumberInRange(value.fitScore, 0, 1)
    && isStringArray(value.riskFlags, 4);
}

function isShotPlannerEnvelope(value: unknown): value is { candidates: ShotPlanCandidate[] } {
  return isObject(value)
    && Array.isArray(value.candidates)
    && value.candidates.length >= 3
    && value.candidates.length <= 4
    && value.candidates.every(isShotPlanCandidate);
}

export async function runShotPlannerNode(args: {
  intent: IntentSpec;
  analysis: ImageAnalysis;
  config: AppConfig;
}): Promise<GraphNodeResult<ShotPlanCandidate[]>> {
  const fallback = buildDeterministicCandidates(args.intent, args.analysis);

  if (!args.config.openRouterApiKey || args.config.processor !== "fal") {
    return buildFallbackNodeResult(
      fallback,
      "OpenRouter shot planning is unavailable, so deterministic shot candidates were used.",
    );
  }

  try {
    const response = await callOpenRouterStructured<{ candidates: ShotPlanCandidate[] }>({
      config: args.config,
      nodeName: "shot-planner-node",
      model: args.config.openRouterModelShotPlanner,
      schemaName: "shot_plan_candidates",
      schema: SHOT_PLANNER_SCHEMA as unknown as Record<string, unknown>,
      messages: [
        {
          role: "system",
          content:
            "Generate exactly 3 or 4 bounded product-photo shot candidates as JSON. Stay within the enum values and prioritize e-commerce realism.",
        },
        {
          role: "user",
          content: JSON.stringify({
            intent: args.intent,
            imageAnalysis: args.analysis,
          }),
        },
      ],
      validate: isShotPlannerEnvelope,
    });

    return {
      data: response.data.candidates,
      source: "openrouter",
      model: response.model,
      attempts: response.attempts,
      fallbackReason: null,
    };
  } catch (error) {
    const reason = error instanceof OpenRouterClientError
      ? error.message
      : "OpenRouter shot planning failed unexpectedly.";

    return buildFallbackNodeResult(fallback, reason);
  }
}
