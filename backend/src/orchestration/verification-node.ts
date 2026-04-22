import type { AppConfig } from "../config.js";
import type { PresetId } from "../types.js";
import { callOpenRouterStructured, OpenRouterClientError } from "./openrouter-client.js";
import { buildFallbackNodeResult, isNumberInRange, isObject, isStringArray } from "./node-utils.js";
import type { GraphNodeResult, ImageAnalysis, PromptPackage, VerificationDecision } from "./types.js";

const VERIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: ["accept", "retry"] },
    confidence: { type: "number" },
    reasons: { type: "array", items: { type: "string" }, maxItems: 5 },
    promptAdjustments: { type: "array", items: { type: "string" }, maxItems: 5 },
    guidanceScaleAdjustment: { type: "number" },
  },
  required: [
    "decision",
    "confidence",
    "reasons",
    "promptAdjustments",
    "guidanceScaleAdjustment",
  ],
} as const;

function buildDeterministicVerification(args: {
  presetId: PresetId;
  heuristicAccepted: boolean;
  heuristicReasons: string[];
}): VerificationDecision {
  if (args.heuristicAccepted) {
    return {
      decision: "accept",
      confidence: 0.9,
      reasons: [],
      promptAdjustments: [],
      guidanceScaleAdjustment: 0,
    };
  }

  return {
    decision: "retry",
    confidence: 0.8,
    reasons: args.heuristicReasons,
    promptAdjustments: args.presetId === "marketplace-ready"
      ? ["enforce square centered framing", "clean pure white background", "lift brightness slightly"]
      : ["preserve product shape more strictly", "improve exposure carefully"],
    guidanceScaleAdjustment: 0.3,
  };
}

function isVerificationDecision(value: unknown): value is VerificationDecision {
  return isObject(value)
    && ["accept", "retry"].includes(String(value.decision))
    && isNumberInRange(value.confidence, 0, 1)
    && isStringArray(value.reasons, 5)
    && isStringArray(value.promptAdjustments, 5)
    && isNumberInRange(value.guidanceScaleAdjustment, -1, 1);
}

export async function runVerificationNode(args: {
  presetId: PresetId;
  inputAnalysis: ImageAnalysis;
  outputAnalysis: ImageAnalysis;
  promptPackage: PromptPackage;
  config: AppConfig;
  heuristicAccepted: boolean;
  heuristicReasons: string[];
}): Promise<GraphNodeResult<VerificationDecision>> {
  const fallback = buildDeterministicVerification(args);

  if (!args.config.openRouterApiKey || args.config.processor !== "fal") {
    return buildFallbackNodeResult(
      fallback,
      "OpenRouter verification is unavailable, so deterministic verification was used.",
    );
  }

  try {
    const response = await callOpenRouterStructured<VerificationDecision>({
      config: args.config,
      nodeName: "verification-node",
      model: args.config.openRouterModelVerification,
      schemaName: "verification_decision",
      schema: VERIFICATION_SCHEMA as unknown as Record<string, unknown>,
      messages: [
        {
          role: "system",
          content:
            "Evaluate whether the product-photo output satisfies the preset. Use the input and output analysis summaries. Return only the schema JSON.",
        },
        {
          role: "user",
          content: JSON.stringify({
            presetId: args.presetId,
            heuristicAccepted: args.heuristicAccepted,
            heuristicReasons: args.heuristicReasons,
            inputAnalysis: args.inputAnalysis,
            outputAnalysis: args.outputAnalysis,
            promptPackage: {
              guidanceScale: args.promptPackage.guidanceScale,
              executionNotes: args.promptPackage.executionNotes,
            },
          }),
        },
      ],
      validate: isVerificationDecision,
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
      : "OpenRouter verification failed unexpectedly.";

    return buildFallbackNodeResult(fallback, reason);
  }
}
