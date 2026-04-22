import type { AppConfig } from "../config.js";
import type { PresetId } from "../types.js";
import { callOpenRouterStructured, OpenRouterClientError } from "./openrouter-client.js";
import { buildFallbackNodeResult, isObject, isStringArray } from "./node-utils.js";
import type { GraphNodeResult, ImageAnalysis, IntentSpec } from "./types.js";

const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    presetId: { type: "string" },
    customerGoal: { type: ["string", "null"] },
    primaryObjective: { type: "string" },
    backgroundGoal: { type: "string", enum: ["pure-white", "clean-white", "neutral", "transparent-cutout"] },
    framingGoal: { type: "string", enum: ["square-centered", "balanced-centered", "tight-product"] },
    lightingGoal: { type: "string", enum: ["neutral-lift", "studio-premium", "catalog-clean"] },
    detailGoal: { type: "string", enum: ["shape-preservation", "catalog-clarity", "material-richness"] },
    realismGuard: { type: "string", enum: ["strict"] },
    emphasis: {
      type: "array",
      items: { type: "string" },
      maxItems: 6,
    },
  },
  required: [
    "presetId",
    "customerGoal",
    "primaryObjective",
    "backgroundGoal",
    "framingGoal",
    "lightingGoal",
    "detailGoal",
    "realismGuard",
    "emphasis",
  ],
} as const;

function buildDeterministicIntent(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  userGoal?: string | null;
}): IntentSpec {
  if (args.presetId === "clean-background") {
    return {
      presetId: args.presetId,
      customerGoal: args.userGoal ?? null,
      primaryObjective: "deliver a clean isolated product on a bright commerce-safe background",
      backgroundGoal: args.analysis.hasAlpha ? "transparent-cutout" : "pure-white",
      framingGoal: "balanced-centered",
      lightingGoal: "catalog-clean",
      detailGoal: "shape-preservation",
      realismGuard: "strict",
      emphasis: ["clean edges", "real product geometry", "catalog clarity"],
    };
  }

  if (args.presetId === "marketplace-ready") {
    return {
      presetId: args.presetId,
      customerGoal: args.userGoal ?? null,
      primaryObjective: "deliver a marketplace-ready product listing image",
      backgroundGoal: "pure-white",
      framingGoal: "square-centered",
      lightingGoal: "catalog-clean",
      detailGoal: "catalog-clarity",
      realismGuard: "strict",
      emphasis: ["square framing", "white background", "crisp edges"],
    };
  }

  return {
    presetId: args.presetId,
    customerGoal: args.userGoal ?? null,
    primaryObjective: "deliver a premium studio-polished product photo",
    backgroundGoal: "clean-white",
    framingGoal: "balanced-centered",
    lightingGoal: "studio-premium",
    detailGoal: "material-richness",
    realismGuard: "strict",
    emphasis: ["premium lighting", "rich tones", "material fidelity"],
  };
}

function isIntentSpec(value: unknown): value is IntentSpec {
  return isObject(value)
    && typeof value.presetId === "string"
    && (typeof value.customerGoal === "string" || value.customerGoal === null)
    && typeof value.primaryObjective === "string"
    && ["pure-white", "clean-white", "neutral", "transparent-cutout"].includes(String(value.backgroundGoal))
    && ["square-centered", "balanced-centered", "tight-product"].includes(String(value.framingGoal))
    && ["neutral-lift", "studio-premium", "catalog-clean"].includes(String(value.lightingGoal))
    && ["shape-preservation", "catalog-clarity", "material-richness"].includes(String(value.detailGoal))
    && value.realismGuard === "strict"
    && isStringArray(value.emphasis, 6);
}

export async function runIntentNode(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  config: AppConfig;
  requestId?: string;
  userGoal?: string | null;
}): Promise<GraphNodeResult<IntentSpec>> {
  const fallback = buildDeterministicIntent(args);

  if (!args.config.openRouterApiKey || args.config.processor !== "fal") {
    return buildFallbackNodeResult(
      fallback,
      "OpenRouter planning is unavailable, so deterministic intent normalization was used.",
    );
  }

  try {
    const response = await callOpenRouterStructured<IntentSpec>({
      config: args.config,
      nodeName: "intent-node",
      model: args.config.openRouterModelIntent,
      schemaName: "intent_spec",
      schema: INTENT_SCHEMA as unknown as Record<string, unknown>,
      messages: [
        {
          role: "system",
          content:
            "Normalize preset-based product photo enhancement intent into a compact JSON object. Use only the provided enums and data. Do not add prose outside the schema.",
        },
        {
          role: "user",
          content: JSON.stringify({
            presetId: args.presetId,
            userGoal: args.userGoal ?? null,
            imageAnalysis: args.analysis,
          }),
        },
      ],
      validate: isIntentSpec,
    });

    return {
      data: response.data,
      source: "openrouter",
      model: response.model,
      attempts: response.attempts,
      fallbackReason: null,
    };
  } catch (error) {
    const reason = error instanceof OpenRouterClientError
      ? error.message
      : "OpenRouter intent normalization failed unexpectedly.";

    return buildFallbackNodeResult(fallback, reason);
  }
}
