import type { GraphNodeResult, PromptPackage } from "./types.js";

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown, maxLength = 12): value is string[] {
  return Array.isArray(value)
    && value.length <= maxLength
    && value.every((entry) => typeof entry === "string");
}

export function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function buildFallbackNodeResult<T>(data: T, reason: string): GraphNodeResult<T> {
  return {
    data,
    source: "deterministic-fallback",
    model: null,
    attempts: 0,
    fallbackReason: reason,
  };
}

export function materializePromptText(promptPackage: Omit<PromptPackage, "promptText" | "negativePromptText">): Pick<PromptPackage, "promptText" | "negativePromptText"> {
  const positiveParts = [
    promptPackage.subjectClause,
    promptPackage.sceneClause,
    promptPackage.lightingClause,
    promptPackage.detailClause,
    ...promptPackage.constraintClauses,
  ].filter(Boolean);
  const negativePromptText = promptPackage.negativeClauses.join(", ");

  return {
    promptText: positiveParts.join(" "),
    negativePromptText,
  };
}
