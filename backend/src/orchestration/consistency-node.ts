import type { AppConfig } from "../config.js";
import { callOpenRouterStructured, OpenRouterClientError } from "./openrouter-client.js";
import { buildFallbackNodeResult, isObject, isStringArray } from "./node-utils.js";
import type { ConsistencySpec, GraphNodeResult, IntentSpec, ShotPlanCandidate } from "./types.js";

const CONSISTENCY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    selectionMode: { type: "string", enum: ["selected", "merged"] },
    selectedCandidateIds: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: { type: "string", enum: ["option-a", "option-b", "option-c", "option-d"] },
    },
    finalFraming: { type: "string", enum: ["square-centered", "balanced-centered", "tight-product"] },
    finalBackground: { type: "string", enum: ["pure-white", "clean-white", "neutral", "transparent-cutout"] },
    finalLighting: { type: "string", enum: ["neutral-lift", "studio-premium", "catalog-clean"] },
    finalCrop: { type: "string", enum: ["loose", "balanced", "tight"] },
    keepConstraints: { type: "array", items: { type: "string" }, maxItems: 6 },
    avoidConstraints: { type: "array", items: { type: "string" }, maxItems: 6 },
    rationale: { type: "string" },
  },
  required: [
    "selectionMode",
    "selectedCandidateIds",
    "finalFraming",
    "finalBackground",
    "finalLighting",
    "finalCrop",
    "keepConstraints",
    "avoidConstraints",
    "rationale",
  ],
} as const;

function buildDeterministicConsistency(intent: IntentSpec, candidates: ShotPlanCandidate[]): ConsistencySpec {
  const best = [...candidates].sort((a, b) => b.fitScore - a.fitScore)[0];

  return {
    selectionMode: "selected",
    selectedCandidateIds: [best.candidateId],
    finalFraming: best.framing,
    finalBackground: best.background,
    finalLighting: best.lighting,
    finalCrop: best.crop,
    keepConstraints: [
      "preserve product geometry",
      "preserve brand-visible details",
      "keep realistic surface materials",
    ],
    avoidConstraints: [
      "no extra props",
      "no color shift",
      "no product shape changes",
    ],
    rationale: `Selected ${best.candidateId} as the strongest deterministic commerce option for ${intent.presetId}.`,
  };
}

function isConsistencySpec(value: unknown): value is ConsistencySpec {
  return isObject(value)
    && ["selected", "merged"].includes(String(value.selectionMode))
    && Array.isArray(value.selectedCandidateIds)
    && value.selectedCandidateIds.length >= 1
    && value.selectedCandidateIds.length <= 2
    && value.selectedCandidateIds.every((id) => ["option-a", "option-b", "option-c", "option-d"].includes(String(id)))
    && ["square-centered", "balanced-centered", "tight-product"].includes(String(value.finalFraming))
    && ["pure-white", "clean-white", "neutral", "transparent-cutout"].includes(String(value.finalBackground))
    && ["neutral-lift", "studio-premium", "catalog-clean"].includes(String(value.finalLighting))
    && ["loose", "balanced", "tight"].includes(String(value.finalCrop))
    && isStringArray(value.keepConstraints, 6)
    && isStringArray(value.avoidConstraints, 6)
    && typeof value.rationale === "string";
}

export async function runConsistencyNode(args: {
  intent: IntentSpec;
  candidates: ShotPlanCandidate[];
  config: AppConfig;
}): Promise<GraphNodeResult<ConsistencySpec>> {
  const fallback = buildDeterministicConsistency(args.intent, args.candidates);

  if (!args.config.openRouterApiKey || args.config.processor !== "fal") {
    return buildFallbackNodeResult(
      fallback,
      "OpenRouter consistency normalization is unavailable, so deterministic selection was used.",
    );
  }

  try {
    const response = await callOpenRouterStructured<ConsistencySpec>({
      config: args.config,
      nodeName: "consistency-node",
      model: args.config.openRouterModelConsistency,
      schemaName: "consistency_spec",
      schema: CONSISTENCY_SCHEMA as unknown as Record<string, unknown>,
      messages: [
        {
          role: "system",
          content:
            "Select or merge the best shot candidates into one consistent product-photo brief. Return only schema-compliant JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            intent: args.intent,
            candidates: args.candidates,
          }),
        },
      ],
      validate: isConsistencySpec,
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
      : "OpenRouter consistency normalization failed unexpectedly.";

    return buildFallbackNodeResult(fallback, reason);
  }
}
