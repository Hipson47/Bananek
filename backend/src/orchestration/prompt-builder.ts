import type { PresetId } from "../types.js";
import type { AiPromptSpec, ConsistencyMemory, FailedAttemptSummary, ImageAnalysis } from "./types.js";

function orderedDirectives(presetId: PresetId, analysis: ImageAnalysis, variant: "primary" | "retry"): string[] {
  const directives: string[] = [];

  if (presetId === "clean-background") {
    directives.push("Preserve the product shape and product details exactly.");
    directives.push("Place the product on a clean pure white background.");

    if (analysis.hasAlpha || !analysis.background.likelyWhite) {
      directives.push("Remove distracting or non-white background content completely.");
    }

    if (analysis.quality.brightnessScore < 0.55) {
      directives.push("Lift exposure slightly while keeping the product realistic.");
    }
  }

  if (presetId === "marketplace-ready") {
    directives.push("Create a professional marketplace listing photo.");
    directives.push("Use a pure white background with clean edges.");

    if (!analysis.marketplaceSignals.squareComposition) {
      directives.push("Center the subject in a square composition with balanced margins.");
    }

    if (!analysis.marketplaceSignals.brightnessAcceptable) {
      directives.push("Increase brightness carefully so the product reads clearly.");
    }

    if (!analysis.marketplaceSignals.contrastAcceptable) {
      directives.push("Increase local contrast for crisp edges and catalog clarity.");
    }
  }

  if (presetId === "studio-polish") {
    directives.push("Create a premium studio product photo.");
    directives.push("Preserve the real product identity and material detail.");

    if (analysis.quality.brightnessScore < 0.45) {
      directives.push("Improve lighting and exposure for a refined premium look.");
    }

    if (analysis.quality.contrastScore < 0.12) {
      directives.push("Increase tonal separation while keeping the product realistic.");
    }
  }

  if (variant === "retry") {
    directives.push("Apply the transformation more decisively while keeping the product unchanged.");
  }

  return directives;
}

function buildBaseInstruction(presetId: PresetId): string {
  if (presetId === "clean-background") {
    return "Enhance this product photo for clean-background output.";
  }

  if (presetId === "marketplace-ready") {
    return "Enhance this product photo for a marketplace listing.";
  }

  return "Enhance this product photo for a polished studio presentation.";
}

export function buildAiPrompt(args: {
  presetId: PresetId;
  analysis: ImageAnalysis;
  originalMimeType: string;
  variant: "primary" | "retry";
  consistencyMemory?: ConsistencyMemory | null;
  failedAttempts?: FailedAttemptSummary[];
  planId?: string | null;
}): AiPromptSpec {
  const directives = orderedDirectives(args.presetId, args.analysis, args.variant);

  if (args.consistencyMemory?.backgroundStyle) {
    directives.push(`Match the established catalog background style: ${args.consistencyMemory.backgroundStyle}.`);
  }

  if (args.consistencyMemory?.lightingDirection) {
    directives.push(`Keep lighting direction consistent with prior catalog images: ${args.consistencyMemory.lightingDirection}.`);
  }

  if (args.failedAttempts?.length) {
    const lastAttempt = args.failedAttempts[args.failedAttempts.length - 1];
    directives.push(`Avoid the previous failure pattern: ${lastAttempt.issues.slice(0, 2).join(", ")}.`);
  }

  const text = [
    buildBaseInstruction(args.presetId),
    args.planId ? `Candidate plan: ${args.planId}.` : null,
    `Input format: ${args.originalMimeType}.`,
    `Input frame: ${args.analysis.dimensions.width}x${args.analysis.dimensions.height}.`,
    ...directives,
  ].filter(Boolean).join(" ");

  return {
    variant: args.variant,
    text,
    directives,
    guidanceScale: args.variant === "retry" ? 4.0 : 3.5,
  };
}
