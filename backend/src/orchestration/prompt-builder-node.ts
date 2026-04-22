import type { AppConfig } from "../config.js";
import type { PresetId } from "../types.js";
import { buildAiPrompt } from "./prompt-builder.js";
import { callOpenRouterStructured, OpenRouterClientError } from "./openrouter-client.js";
import { buildFallbackNodeResult, isNumberInRange, isObject, isStringArray, materializePromptText } from "./node-utils.js";
import type { ConsistencySpec, GraphNodeResult, ImageAnalysis, IntentSpec, PromptPackage } from "./types.js";

const PROMPT_PACKAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    subjectClause: { type: "string" },
    sceneClause: { type: "string" },
    lightingClause: { type: "string" },
    detailClause: { type: "string" },
    constraintClauses: { type: "array", items: { type: "string" }, maxItems: 6 },
    negativeClauses: { type: "array", items: { type: "string" }, maxItems: 6 },
    executionNotes: { type: "array", items: { type: "string" }, maxItems: 4 },
    guidanceScale: { type: "number" },
  },
  required: [
    "subjectClause",
    "sceneClause",
    "lightingClause",
    "detailClause",
    "constraintClauses",
    "negativeClauses",
    "executionNotes",
    "guidanceScale",
  ],
} as const;

type PromptPackageEnvelope = Omit<PromptPackage, "promptText" | "negativePromptText">;

function buildDeterministicPromptPackage(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  intent: IntentSpec;
  consistency: ConsistencySpec;
  variant: "primary" | "retry";
  retryAdjustments?: string[];
}): PromptPackage {
  const deterministic = buildAiPrompt({
    presetId: args.presetId,
    analysis: args.analysis,
    originalMimeType: args.analysis.mimeType,
    variant: args.variant,
  });

  const envelope: PromptPackageEnvelope = {
    subjectClause: `Preserve the real product exactly with ${args.intent.detailGoal.replace(/-/g, " ")} priority.`,
    sceneClause: `Use ${args.consistency.finalBackground.replace(/-/g, " ")} background treatment with ${args.consistency.finalFraming.replace(/-/g, " ")} framing and ${args.consistency.finalCrop} crop.`,
    lightingClause: `Apply ${args.consistency.finalLighting.replace(/-/g, " ")} lighting while keeping the product realistic.`,
    detailClause: deterministic.directives.join(" "),
    constraintClauses: [
      ...args.consistency.keepConstraints,
      ...(args.retryAdjustments ?? []),
    ].slice(0, 6),
    negativeClauses: args.consistency.avoidConstraints.slice(0, 6),
    executionNotes: [
      `preset:${args.presetId}`,
      `variant:${args.variant}`,
      ...deterministic.directives.slice(0, 2),
    ].slice(0, 4),
    guidanceScale: deterministic.guidanceScale,
  };
  const text = materializePromptText(envelope);

  return {
    ...envelope,
    ...text,
  };
}

function isPromptPackageEnvelope(value: unknown): value is PromptPackageEnvelope {
  return isObject(value)
    && typeof value.subjectClause === "string"
    && typeof value.sceneClause === "string"
    && typeof value.lightingClause === "string"
    && typeof value.detailClause === "string"
    && isStringArray(value.constraintClauses, 6)
    && isStringArray(value.negativeClauses, 6)
    && isStringArray(value.executionNotes, 4)
    && isNumberInRange(value.guidanceScale, 1, 6);
}

export async function runPromptBuilderNode(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  intent: IntentSpec;
  consistency: ConsistencySpec;
  config: AppConfig;
  variant: "primary" | "retry";
  retryAdjustments?: string[];
}): Promise<GraphNodeResult<PromptPackage>> {
  const fallback = buildDeterministicPromptPackage(args);

  if (!args.config.openRouterApiKey || args.config.processor !== "fal") {
    return buildFallbackNodeResult(
      fallback,
      "OpenRouter prompt building is unavailable, so deterministic prompt packaging was used.",
    );
  }

  try {
    const response = await callOpenRouterStructured<PromptPackageEnvelope>({
      config: args.config,
      nodeName: "prompt-builder-node",
      model: args.config.openRouterModelPromptBuilder,
      schemaName: "prompt_package",
      schema: PROMPT_PACKAGE_SCHEMA as unknown as Record<string, unknown>,
      messages: [
        {
          role: "system",
          content:
            "Build a bounded product-photo prompt package for FAL image editing. Return only JSON with compact clauses and no hidden reasoning.",
        },
        {
          role: "user",
          content: JSON.stringify({
            presetId: args.presetId,
            variant: args.variant,
            imageAnalysis: args.analysis,
            intent: args.intent,
            consistency: args.consistency,
            retryAdjustments: args.retryAdjustments ?? [],
          }),
        },
      ],
      validate: isPromptPackageEnvelope,
    });
    const text = materializePromptText(response.data);

    return {
      data: {
        ...response.data,
        ...text,
      },
      source: "openrouter",
      model: response.model,
      attempts: response.attempts,
      fallbackReason: null,
    };
  } catch (error) {
    const reason = error instanceof OpenRouterClientError
      ? error.message
      : "OpenRouter prompt builder failed unexpectedly.";

    return buildFallbackNodeResult(fallback, reason);
  }
}
