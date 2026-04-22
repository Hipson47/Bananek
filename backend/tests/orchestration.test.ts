import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { analyzeImage } from "../src/orchestration/analysis.js";
import { runConsistencyNode } from "../src/orchestration/consistency-node.js";
import { buildAiPrompt } from "../src/orchestration/prompt-builder.js";
import { runPromptBuilderNode } from "../src/orchestration/prompt-builder-node.js";
import { buildCandidatePlans, buildEnhancementPlan } from "../src/orchestration/planner.js";
import { runShotPlannerNode } from "../src/orchestration/shot-planner-node.js";
import { orchestrateEnhancement } from "../src/orchestration/enhancement-orchestrator.js";
import { runIntentNode } from "../src/orchestration/intent-node.js";
import { verifyEnhancementOutput } from "../src/orchestration/verification.js";
import type { AppConfig } from "../src/config.js";
import type { EnhancementExecutionResult } from "../src/orchestration/types.js";
import type { EnhancementProcessorMap } from "../src/processors/contracts.js";

async function makeImage(args: {
  width: number;
  height: number;
  format: "png" | "jpeg";
  background: { r: number; g: number; b: number; alpha?: number };
}) {
  const instance = sharp({
    create: {
      width: args.width,
      height: args.height,
      channels: args.background.alpha === undefined ? 3 : 4,
      background: args.background,
    },
  });

  if (args.format === "jpeg") {
    return instance.jpeg({ quality: 85 }).toBuffer();
  }

  return instance.png().toBuffer();
}

function buildConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3001,
    allowedOrigins: ["http://localhost:5173"],
    processor: "sharp",
    processorFailurePolicy: "strict",
    databasePath: "backend/data/test-runtime.sqlite",
    sessionSecret: "test-secret",
    sessionCookieName: "enhancer_session",
    defaultSessionCredits: 3,
    rateLimitWindowMs: 60_000,
    enhanceRateLimitMax: 10,
    sessionBootstrapRateLimitMax: 30,
    outputUrlTtlSeconds: 3600,
    sessionLockTtlMs: 120_000,
    falAllowedHostSuffixes: ["fal.media"],
    openRouterApiKey: null,
    openRouterBaseUrl: "https://openrouter.ai/api/v1",
    openRouterTimeoutMs: 12_000,
    openRouterMaxRetries: 1,
    openRouterModelDefault: "openai/gpt-4.1-mini",
    openRouterModelIntent: "openai/gpt-4.1-mini",
    openRouterModelShotPlanner: "openai/gpt-4.1-mini",
    openRouterModelConsistency: "openai/gpt-4.1-mini",
    openRouterModelPromptBuilder: "openai/gpt-4.1-mini",
    openRouterModelVerification: "openai/gpt-4.1-mini",
    ...overrides,
  };
}

function createResult(result: {
  filename: string;
  mimeType: string;
  bytes: Buffer;
  processorLabel?: string;
}): EnhancementExecutionResult {
  return {
    filename: result.filename,
    mimeType: result.mimeType,
    processedUrl: `data:${result.mimeType};base64,${result.bytes.toString("base64")}`,
    processorLabel: result.processorLabel ?? "Test enhancement",
  };
}

describe("orchestration analysis", () => {
  it("returns structured analysis with quality and marketplace signals", async () => {
    const imageBuffer = await makeImage({
      width: 1200,
      height: 1200,
      format: "png",
      background: { r: 252, g: 252, b: 252 },
    });

    const analysis = await analyzeImage(imageBuffer, "image/png");

    expect(analysis.format).toBe("png");
    expect(analysis.dimensions).toEqual({ width: 1200, height: 1200 });
    expect(analysis.background.likelyPlain).toBe(true);
    expect(analysis.marketplaceSignals.squareComposition).toBe(true);
    expect(analysis.marketplaceSignals.whiteBackgroundLikely).toBe(true);
    expect(analysis.quality.brightnessScore).toBeGreaterThan(0.9);
  });
});

describe("orchestration planning", () => {
  it("returns multiple scored candidate plans for the active processor", async () => {
    const imageBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 40, g: 40, b: 40 },
    });
    const analysis = await analyzeImage(imageBuffer, "image/jpeg");

    const candidates = buildCandidatePlans({
      presetId: "marketplace-ready",
      analysis,
      config: buildConfig({
        processor: "fal",
        processorFailurePolicy: "fallback-to-sharp",
      }),
    });

    expect(candidates.length).toBeGreaterThanOrEqual(3);
    expect(candidates.length).toBeLessThanOrEqual(5);
    expect(candidates[0]?.score).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.orderedSteps.length >= 1)).toBe(true);
  });

  it("prefers a deterministic sharp-only plan when sharp is the active processor", async () => {
    const imageBuffer = await makeImage({
      width: 1200,
      height: 1200,
      format: "png",
      background: { r: 255, g: 255, b: 255 },
    });
    const analysis = await analyzeImage(imageBuffer, "image/png");

    const plan = buildEnhancementPlan({
      presetId: "marketplace-ready",
      originalMimeType: "image/png",
      analysis,
      config: buildConfig({ processor: "sharp" }),
    });

    expect(plan.strategy).toBe("sharp-only");
    expect(plan.steps.map((step) => step.processor)).toEqual(["sharp"]);
    expect(plan.fallbackStrategy).toBe(null);
  });

  it("chooses a repair-first candidate for a weak marketplace input", async () => {
    const imageBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 40, g: 40, b: 40 },
    });
    const analysis = await analyzeImage(imageBuffer, "image/jpeg");

    const plan = buildEnhancementPlan({
      presetId: "marketplace-ready",
      originalMimeType: "image/jpeg",
      analysis,
      config: buildConfig({
        processor: "fal",
        processorFailurePolicy: "fallback-to-sharp",
      }),
    });

    expect(plan.candidates?.length).toBeGreaterThanOrEqual(3);
    expect(plan.selectedCandidateId).not.toBe("sharp_only");
    expect(plan.reason.toLowerCase()).toMatch(/repair|background|marketplace|heavy/);
    expect(plan.steps.some((step) => step.processor === "fal")).toBe(true);
    expect(plan.fallbackStrategy).toBe("sharp-only");
  });

  it("chooses the minimal pipeline for a clean ready image", async () => {
    const imageBuffer = await makeImage({
      width: 1200,
      height: 1200,
      format: "png",
      background: { r: 255, g: 255, b: 255 },
    });
    const analysis = await analyzeImage(imageBuffer, "image/png");

    const plan = buildEnhancementPlan({
      presetId: "marketplace-ready",
      originalMimeType: "image/png",
      analysis,
      config: buildConfig({
        processor: "fal",
        processorFailurePolicy: "fallback-to-sharp",
      }),
    });

    expect(plan.selectedCandidateId).toBe("sharp_only");
    expect(plan.steps.map((step) => step.processor)).toEqual(["sharp"]);
  });
});

describe("OpenRouter planning nodes", () => {
  it("shot planner returns a bounded structured candidate set", async () => {
    const imageBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 40, g: 40, b: 40 },
    });
    const analysis = await analyzeImage(imageBuffer, "image/jpeg");
    const intent = await runIntentNode({
      presetId: "marketplace-ready",
      analysis,
      config: buildConfig(),
    });

    const planner = await runShotPlannerNode({
      intent: intent.data,
      analysis,
      config: buildConfig(),
    });

    expect(planner.data.length).toBeGreaterThanOrEqual(3);
    expect(planner.data.length).toBeLessThanOrEqual(4);
    expect(planner.data[0]).toMatchObject({
      candidateId: "option-a",
    });
  });

  it("consistency node deterministically selects the strongest candidate when OpenRouter is unavailable", async () => {
    const consistency = await runConsistencyNode({
      intent: {
        presetId: "marketplace-ready",
        customerGoal: null,
        primaryObjective: "deliver a marketplace-ready listing image",
        backgroundGoal: "pure-white",
        framingGoal: "square-centered",
        lightingGoal: "catalog-clean",
        detailGoal: "catalog-clarity",
        realismGuard: "strict",
        emphasis: ["square framing", "white background"],
      },
      candidates: [
        {
          candidateId: "option-a",
          title: "A",
          framing: "balanced-centered",
          background: "clean-white",
          lighting: "catalog-clean",
          crop: "balanced",
          rationale: "safe",
          fitScore: 0.6,
          riskFlags: [],
        },
        {
          candidateId: "option-b",
          title: "B",
          framing: "square-centered",
          background: "pure-white",
          lighting: "catalog-clean",
          crop: "balanced",
          rationale: "best",
          fitScore: 0.9,
          riskFlags: [],
        },
        {
          candidateId: "option-c",
          title: "C",
          framing: "tight-product",
          background: "neutral",
          lighting: "neutral-lift",
          crop: "tight",
          rationale: "risky",
          fitScore: 0.4,
          riskFlags: ["tight crop"],
        },
      ],
      config: buildConfig(),
    });

    expect(consistency.source).toBe("deterministic-fallback");
    expect(consistency.data.selectedCandidateIds).toEqual(["option-b"]);
    expect(consistency.data.finalBackground).toBe("pure-white");
  });
});

describe("orchestration prompt builder", () => {
  it("builds deterministic prompts from preset and analysis facts", async () => {
    const imageBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 50, g: 50, b: 50 },
    });
    const analysis = await analyzeImage(imageBuffer, "image/jpeg");

    const promptA = buildAiPrompt({
      presetId: "marketplace-ready",
      analysis,
      originalMimeType: "image/jpeg",
      variant: "primary",
    });
    const promptB = buildAiPrompt({
      presetId: "marketplace-ready",
      analysis,
      originalMimeType: "image/jpeg",
      variant: "primary",
    });

    expect(promptA).toEqual(promptB);
    expect(promptA.text.toLowerCase()).toContain("marketplace listing");
    expect(promptA.directives.some((directive) => directive.includes("white background"))).toBe(true);
  });

  it("falls back to deterministic prompt packaging when OpenRouter is unavailable", async () => {
    const imageBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 50, g: 50, b: 50 },
    });
    const analysis = await analyzeImage(imageBuffer, "image/jpeg");

    const promptPackage = await runPromptBuilderNode({
      presetId: "marketplace-ready",
      analysis,
      intent: {
        presetId: "marketplace-ready",
        customerGoal: null,
        primaryObjective: "deliver a marketplace-ready listing image",
        backgroundGoal: "pure-white",
        framingGoal: "square-centered",
        lightingGoal: "catalog-clean",
        detailGoal: "catalog-clarity",
        realismGuard: "strict",
        emphasis: ["square framing", "white background"],
      },
      consistency: {
        selectionMode: "selected",
        selectedCandidateIds: ["option-a"],
        finalFraming: "square-centered",
        finalBackground: "pure-white",
        finalLighting: "catalog-clean",
        finalCrop: "balanced",
        keepConstraints: ["preserve product geometry"],
        avoidConstraints: ["no extra props"],
        rationale: "deterministic fallback",
      },
      config: buildConfig(),
      variant: "primary",
    });

    expect(promptPackage.source).toBe("deterministic-fallback");
    expect(promptPackage.data.promptText.toLowerCase()).toContain("preserve the real product");
    expect(promptPackage.data.masterPrompt.toLowerCase()).toContain("background goal");
    expect(promptPackage.data.consistencyRules.length).toBeGreaterThan(0);
    expect(promptPackage.data.brandSafetyRules).toContain("Do not change the product identity.");
  });
});

describe("orchestration verification", () => {
  it("accepts a marketplace-ready output that meets square and brightness checks", async () => {
    const inputBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 70, g: 70, b: 70 },
    });
    const outputBuffer = await makeImage({
      width: 1000,
      height: 1000,
      format: "jpeg",
      background: { r: 252, g: 252, b: 252 },
    });
    const inputAnalysis = await analyzeImage(inputBuffer, "image/jpeg");

    const verification = await verifyEnhancementOutput({
      presetId: "marketplace-ready",
      inputAnalysis,
      output: createResult({
        filename: "product-marketplace-ready.jpg",
        mimeType: "image/jpeg",
        bytes: outputBuffer,
      }),
    });

    expect(verification.accepted).toBe(true);
    expect(verification.status).toBe("accepted");
    expect(verification.score).toBeGreaterThanOrEqual(0.74);
  });

  it("rejects a non-square marketplace output and suggests replanning", async () => {
    const inputBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 70, g: 70, b: 70 },
    });
    const outputBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 80, g: 80, b: 80 },
    });
    const inputAnalysis = await analyzeImage(inputBuffer, "image/jpeg");

    const verification = await verifyEnhancementOutput({
      presetId: "marketplace-ready",
      inputAnalysis,
      output: createResult({
        filename: "product-marketplace-ready.jpg",
        mimeType: "image/jpeg",
        bytes: outputBuffer,
      }),
    });

    expect(verification.accepted).toBe(false);
    expect(verification.status).toBe("retry");
    expect(verification.score).toBeLessThan(0.74);
    expect(verification.suggestedReplan).toBeTruthy();
  });
});

describe("enhancement orchestrator", () => {
  it("replans when verification fails on the first AI attempt", async () => {
    const imageBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 60, g: 60, b: 60 },
    });
    const failedOutputBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 80, g: 80, b: 80 },
    });
    const successfulOutputBuffer = await makeImage({
      width: 1000,
      height: 1000,
      format: "jpeg",
      background: { r: 252, g: 252, b: 252 },
    });

    let executionCount = 0;
    const respondWithSequencedOutput = async () => {
      executionCount += 1;
      return createResult({
        filename: "product-marketplace-ready.jpg",
        mimeType: "image/jpeg",
        bytes: executionCount <= 3 ? failedOutputBuffer : successfulOutputBuffer,
        processorLabel: "Marketplace Ready enhancement",
      });
    };

    const processors = {
      mock: vi.fn(),
      sharp: vi.fn(respondWithSequencedOutput),
      fal: vi.fn(respondWithSequencedOutput),
    } as unknown as EnhancementProcessorMap;

    const orchestrated = await orchestrateEnhancement({
      imageBuffer,
      originalMimeType: "image/jpeg",
      presetId: "marketplace-ready",
      config: buildConfig({
        processor: "fal",
        processorFailurePolicy: "fallback-to-sharp",
      }),
      processors,
    });

    expect((processors.fal as any).mock.calls.length + (processors.sharp as any).mock.calls.length).toBeGreaterThan(3);
    expect(orchestrated.metadata.retryApplied).toBe(true);
    expect(orchestrated.metadata.failedAttempts).toHaveLength(1);
    expect(orchestrated.metadata.attemptedStrategies.length).toBeGreaterThanOrEqual(2);
    expect(orchestrated.metadata.verification.passed).toBe(true);
  });

  it("reuses consistency memory across a batch", async () => {
    const firstImage = await makeImage({
      width: 1200,
      height: 1200,
      format: "png",
      background: { r: 255, g: 255, b: 255 },
    });
    const outputBuffer = await makeImage({
      width: 1000,
      height: 1000,
      format: "jpeg",
      background: { r: 252, g: 252, b: 252 },
    });

    const processors = {
      mock: vi.fn(),
      sharp: vi.fn(async () => createResult({
        filename: "product-marketplace-ready.jpg",
        mimeType: "image/jpeg",
        bytes: outputBuffer,
        processorLabel: "Marketplace Ready enhancement",
      })),
      fal: vi.fn(async () => createResult({
        filename: "product-marketplace-ready.jpg",
        mimeType: "image/jpeg",
        bytes: outputBuffer,
        processorLabel: "Marketplace Ready enhancement",
      })),
    } as unknown as EnhancementProcessorMap;

    const firstRun = await orchestrateEnhancement({
      imageBuffer: firstImage,
      originalMimeType: "image/png",
      presetId: "marketplace-ready",
      config: buildConfig({
        processor: "fal",
        processorFailurePolicy: "fallback-to-sharp",
      }),
      processors,
    });

    const secondRun = await orchestrateEnhancement({
      imageBuffer: firstImage,
      originalMimeType: "image/png",
      presetId: "marketplace-ready",
      config: buildConfig({
        processor: "fal",
        processorFailurePolicy: "fallback-to-sharp",
      }),
      consistencyMemory: firstRun.metadata.consistencyMemoryAfter,
      processors,
    });

    expect(firstRun.metadata.consistencyMemoryAfter).toBeTruthy();
    expect(secondRun.metadata.consistencyMemoryBefore).toEqual(firstRun.metadata.consistencyMemoryAfter);
    expect(secondRun.metadata.promptPackage?.data.consistencyRules.join(" ").toLowerCase()).toContain("catalog");
  });

  it("falls back to deterministic sharp-only execution when the AI path fails", async () => {
    const imageBuffer = await makeImage({
      width: 1600,
      height: 900,
      format: "jpeg",
      background: { r: 60, g: 60, b: 60 },
    });
    const sharpOutputBuffer = await makeImage({
      width: 1000,
      height: 1000,
      format: "jpeg",
      background: { r: 252, g: 252, b: 252 },
    });

    const processors = {
      mock: vi.fn(async () => createResult({
        filename: "product-marketplace-ready.jpg",
        mimeType: "image/jpeg",
        bytes: sharpOutputBuffer,
        processorLabel: "Mock enhancement",
      })),
      sharp: vi.fn(async () => createResult({
        filename: "product-marketplace-ready.jpg",
        mimeType: "image/jpeg",
        bytes: sharpOutputBuffer,
        processorLabel: "Marketplace Ready enhancement",
      })),
      fal: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    } as unknown as EnhancementProcessorMap;

    const orchestrated = await orchestrateEnhancement({
      imageBuffer,
      originalMimeType: "image/jpeg",
      presetId: "marketplace-ready",
      config: buildConfig({
        processor: "fal",
        processorFailurePolicy: "fallback-to-sharp",
      }),
      processors,
    });

    expect(processors.fal).toHaveBeenCalledTimes(1);
    expect(processors.sharp).toHaveBeenCalledTimes(1);
    expect(orchestrated.result.processedUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(orchestrated.metadata.plan.strategy).toBe("sharp-only");
    expect(orchestrated.metadata.finalPath).toEqual(["sharp"]);
    expect(orchestrated.metadata.verification.status).toBe("accepted");
    expect(orchestrated.metadata.fallbackApplied).toBe(true);
    expect(orchestrated.metadata.attemptedStrategies).toEqual(["background_then_relight_then_upscale", "sharp-only"]);
  });
});
