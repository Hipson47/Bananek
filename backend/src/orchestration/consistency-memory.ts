import type { ConsistencyMemory, ConsistencySpec, ImageAnalysis, PromptPackage } from "./types.js";

function inferColorTemperature(analysis: ImageAnalysis): string {
  const [r, , b] = analysis.background.dominantRgb;

  if (r > b + 12) {
    return "warm-neutral";
  }

  if (b > r + 12) {
    return "cool-neutral";
  }

  return analysis.quality.brightnessScore > 0.7 ? "bright-neutral" : "balanced-neutral";
}

export function updateConsistencyMemory(args: {
  previousMemory?: ConsistencyMemory | null;
  consistency: ConsistencySpec;
  outputAnalysis: ImageAnalysis;
  promptPackage: PromptPackage;
}): ConsistencyMemory {
  return {
    backgroundStyle: args.consistency.finalBackground,
    lightingDirection: args.consistency.finalLighting,
    shadowStyle: args.promptPackage.executionNotes.find((entry) => entry.includes("shadow")) ?? args.previousMemory?.shadowStyle ?? "soft-catalog",
    cropStyle: args.consistency.finalCrop,
    colorTemperature: args.previousMemory?.colorTemperature ?? inferColorTemperature(args.outputAnalysis),
  };
}
