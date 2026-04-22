import { readConfig } from "../config.js";
import { logError, logEvent } from "../utils/log.js";
import { processImage as mockProcessImage } from "../processors/mock-processor.js";
import { processImage as sharpProcessImage } from "../processors/sharp-processor.js";
import { processImage as falProcessImage } from "../processors/fal-processor.js";
import { decodeProcessedDataUrl } from "../processors/data-url.js";
import type { EnhancementProcessorMap } from "../processors/contracts.js";
import { analyzeImage } from "./analysis.js";
import { buildEnhancementPlan } from "./planner.js";
import { runConsistencyNode } from "./consistency-node.js";
import { runIntentNode } from "./intent-node.js";
import { runPromptBuilderNode } from "./prompt-builder-node.js";
import { runShotPlannerNode } from "./shot-planner-node.js";
import { verifyEnhancementOutput } from "./verification.js";
import { runVerificationNode } from "./verification-node.js";
import type { EnhancementPlan, EnhancementProcessor, OrchestratedEnhancement, OrchestratorInput, PromptPackage } from "./types.js";

const DEFAULT_PROCESSORS: EnhancementProcessorMap = {
  mock: mockProcessImage,
  sharp: sharpProcessImage,
  fal: falProcessImage,
};

async function executePlan(args: {
  plan: EnhancementPlan;
  imageBuffer: Buffer;
  originalMimeType: string;
  presetId: OrchestratorInput["presetId"];
  requestId?: string;
  processors: EnhancementProcessorMap;
}): Promise<{
  result: OrchestratedEnhancement["result"];
  outputBuffer: Buffer;
  path: EnhancementProcessor[];
}> {
  let currentBuffer = args.imageBuffer;
  let currentMimeType = args.originalMimeType;
  let finalResult = null as OrchestratedEnhancement["result"] | null;
  const path: EnhancementProcessor[] = [];

  for (const [index, step] of args.plan.steps.entries()) {
    const processor = args.processors[step.processor];
    finalResult = await processor(
      currentBuffer,
      currentMimeType,
      args.presetId,
      {
        requestId: args.requestId,
        stage: index === 0 ? "primary" : "retry",
        prompt: step.prompt,
      },
    );
    currentBuffer = decodeProcessedDataUrl(finalResult.processedUrl, finalResult.mimeType);
    currentMimeType = finalResult.mimeType;
    path.push(step.processor);
  }

  if (!finalResult) {
    throw {
      kind: "processing" as const,
      message: "Enhancement plan did not execute any processors.",
    };
  }

  return {
    result: finalResult,
    outputBuffer: currentBuffer,
    path,
  };
}

async function executeFalWithGraph(args: {
  imageBuffer: Buffer;
  presetId: OrchestratorInput["presetId"];
  originalMimeType: string;
  requestId?: string;
  config: OrchestratorInput["config"];
  processors: EnhancementProcessorMap;
  userGoal?: string | null;
}): Promise<OrchestratedEnhancement> {
  const analysis = await analyzeImage(args.imageBuffer, args.originalMimeType);
  const intent = await runIntentNode({
    presetId: args.presetId,
    analysis,
    config: args.config,
    requestId: args.requestId,
    userGoal: args.userGoal,
  });
  const shotPlan = await runShotPlannerNode({
    intent: intent.data,
    analysis,
    config: args.config,
  });
  const consistency = await runConsistencyNode({
    intent: intent.data,
    candidates: shotPlan.data,
    config: args.config,
  });

  let promptPackage = await runPromptBuilderNode({
    presetId: args.presetId,
    analysis,
    intent: intent.data,
    consistency: consistency.data,
    config: args.config,
    variant: "primary",
  });
  const attemptedStrategies = ["fal-graph-primary"] as string[];
  let fallbackApplied = false;
  let retryApplied = false;
  const initialGraphPlan: EnhancementPlan = {
    strategy: "ai-only",
    reason: "OpenRouter planning graph selected FAL as the execution backend.",
    steps: [{ processor: "fal", purpose: "creative", prompt: {
      variant: "primary",
      text: promptPackage.data.promptText,
      directives: promptPackage.data.constraintClauses,
      guidanceScale: promptPackage.data.guidanceScale,
    } }],
    fallbackStrategy: args.config.processorFailurePolicy === "fallback-to-sharp" ? "sharp-only" : null,
    verificationPolicy: "retry-once",
  };

  const executeFal = async (pkg: PromptPackage, stage: "primary" | "retry" | "fallback") => {
    const result = await args.processors.fal(
      args.imageBuffer,
      args.originalMimeType,
      args.presetId,
      {
        requestId: args.requestId,
        stage,
        prompt: {
          variant: stage === "retry" ? "retry" : "primary",
          text: pkg.promptText,
          directives: pkg.constraintClauses,
          guidanceScale: pkg.guidanceScale,
        },
      },
    );
    const outputBuffer = decodeProcessedDataUrl(result.processedUrl, result.mimeType);
    const heuristicVerification = await verifyEnhancementOutput({
      presetId: args.presetId,
      inputAnalysis: analysis,
      output: result,
    });
    const verificationNode = await runVerificationNode({
      presetId: args.presetId,
      inputAnalysis: analysis,
      outputAnalysis: heuristicVerification.outputAnalysis,
      promptPackage: pkg,
      config: args.config,
      heuristicAccepted: heuristicVerification.accepted,
      heuristicReasons: heuristicVerification.reasons,
    });

    return {
      result,
      outputBuffer,
      heuristicVerification,
      verificationNode,
    };
  };

  try {
    let execution = await executeFal(promptPackage.data, "primary");
    let finalVerification = execution.heuristicVerification;
    let verificationNode = execution.verificationNode;

    if (
      (!execution.heuristicVerification.accepted || verificationNode.data.decision === "retry")
      && args.presetId !== "clean-background"
    ) {
      retryApplied = true;
      attemptedStrategies.push("fal-graph-retry");
      promptPackage = await runPromptBuilderNode({
        presetId: args.presetId,
        analysis,
        intent: intent.data,
        consistency: consistency.data,
        config: args.config,
        variant: "retry",
        retryAdjustments: verificationNode.data.promptAdjustments,
      });
      const adjustedGuidanceScale = Math.max(
        1,
        Math.min(6, promptPackage.data.guidanceScale + verificationNode.data.guidanceScaleAdjustment),
      );
      promptPackage = {
        ...promptPackage,
        data: {
          ...promptPackage.data,
          guidanceScale: adjustedGuidanceScale,
        },
      };
      execution = await executeFal(promptPackage.data, "retry");
      finalVerification = execution.heuristicVerification;
      verificationNode = execution.verificationNode;
    }

    logEvent("info", "orchestrator.graph.completed", {
      requestId: args.requestId,
      presetId: args.presetId,
      nodeOutputs: {
        intent: {
          source: intent.source,
          model: intent.model,
          objective: intent.data.primaryObjective,
        },
        shotPlanner: {
          source: shotPlan.source,
          model: shotPlan.model,
          candidateCount: shotPlan.data.length,
          topCandidate: shotPlan.data[0]?.candidateId ?? null,
        },
        consistency: {
          source: consistency.source,
          model: consistency.model,
          selectionMode: consistency.data.selectionMode,
          selectedCandidateIds: consistency.data.selectedCandidateIds,
        },
        promptBuilder: {
          source: promptPackage.source,
          model: promptPackage.model,
          guidanceScale: promptPackage.data.guidanceScale,
          executionNotes: promptPackage.data.executionNotes,
        },
        verification: {
          source: verificationNode.source,
          model: verificationNode.model,
          decision: verificationNode.data.decision,
          reasons: verificationNode.data.reasons,
        },
      },
      selectedPlan: "fal-graph",
      promptPackageSummary: {
        guidanceScale: promptPackage.data.guidanceScale,
        subjectClause: promptPackage.data.subjectClause,
        sceneClause: promptPackage.data.sceneClause,
      },
      falExecutionPath: ["fal"],
      retryApplied,
      fallbackApplied,
      verificationResult: {
        status: finalVerification.status,
        reasons: finalVerification.reasons,
      },
    });

    return {
      result: execution.result,
      outputBuffer: execution.outputBuffer,
      metadata: {
        analysis,
        plan: initialGraphPlan,
        intent,
        shotPlan,
        consistency,
        promptPackage,
        verificationNode,
        attemptedStrategies: attemptedStrategies as Array<"mock-only" | "sharp-only" | "ai-only" | "sharp-then-ai" | "ai-then-sharp">,
        finalPath: ["fal"],
        verification: finalVerification,
        fallbackApplied,
        retryApplied,
      },
    };
  } catch (error) {
    if (args.config.processorFailurePolicy !== "fallback-to-sharp") {
      throw error;
    }

    fallbackApplied = true;
    const sharpPlan = buildEnhancementPlan({
      presetId: args.presetId,
      originalMimeType: args.originalMimeType,
      analysis,
      config: { ...args.config, processor: "sharp" },
      forcedStrategy: "sharp-only",
      reasonOverride: "FAL graph failed, so orchestration fell back to deterministic sharp execution.",
    });
    attemptedStrategies.push("sharp-only");
    logError("orchestrator.graph_failed", error, {
      requestId: args.requestId,
      presetId: args.presetId,
    });
    const execution = await executePlan({
      plan: sharpPlan,
      imageBuffer: args.imageBuffer,
      originalMimeType: args.originalMimeType,
      presetId: args.presetId,
      requestId: args.requestId,
      processors: args.processors,
    });
    const verification = await verifyEnhancementOutput({
      presetId: args.presetId,
      inputAnalysis: analysis,
      output: execution.result,
    });

    return {
      result: execution.result,
      outputBuffer: execution.outputBuffer,
      metadata: {
        analysis,
        plan: initialGraphPlan,
        intent,
        shotPlan,
        consistency,
        promptPackage,
        verificationNode: null,
        attemptedStrategies: attemptedStrategies as Array<"mock-only" | "sharp-only" | "ai-only" | "sharp-then-ai" | "ai-then-sharp">,
        finalPath: execution.path,
        verification,
        fallbackApplied,
        retryApplied,
      },
    };
  }
}

export async function orchestrateEnhancement(input: OrchestratorInput): Promise<OrchestratedEnhancement> {
  const config = input.config ?? readConfig();
  const processors = input.processors ?? DEFAULT_PROCESSORS;

  if (config.processor === "fal") {
    return executeFalWithGraph({
      imageBuffer: input.imageBuffer,
      presetId: input.presetId,
      originalMimeType: input.originalMimeType,
      requestId: input.requestId,
      config,
      processors,
      userGoal: input.userGoal,
    });
  }

  const analysis = await analyzeImage(input.imageBuffer, input.originalMimeType);
  const initialPlan = buildEnhancementPlan({
    presetId: input.presetId,
    originalMimeType: input.originalMimeType,
    analysis,
    config,
  });
  const attemptedStrategies = [initialPlan.strategy];
  let activePlan = initialPlan;
  let fallbackApplied = false;
  let retryApplied = false;
  let execution;

  try {
    execution = await executePlan({
      plan: activePlan,
      imageBuffer: input.imageBuffer,
      originalMimeType: input.originalMimeType,
      presetId: input.presetId,
      requestId: input.requestId,
      processors,
    });
  } catch (error) {
    if (!activePlan.fallbackStrategy) {
      throw error;
    }

    fallbackApplied = true;
    activePlan = buildEnhancementPlan({
      presetId: input.presetId,
      originalMimeType: input.originalMimeType,
      analysis,
      config,
      forcedStrategy: activePlan.fallbackStrategy,
      reasonOverride: "AI execution failed, so orchestration fell back to deterministic processing.",
    });
    attemptedStrategies.push(activePlan.strategy);
    logError("orchestrator.primary_failed", error, {
      requestId: input.requestId,
      presetId: input.presetId,
      fallbackStrategy: activePlan.strategy,
    });
    execution = await executePlan({
      plan: activePlan,
      imageBuffer: input.imageBuffer,
      originalMimeType: input.originalMimeType,
      presetId: input.presetId,
      requestId: input.requestId,
      processors,
    });
  }

  let verification = await verifyEnhancementOutput({
    presetId: input.presetId,
    inputAnalysis: analysis,
    output: execution.result,
  });

  if (!verification.accepted && verification.status === "retry" && verification.recommendedStrategy) {
    const needsFallback =
      activePlan.fallbackStrategy === verification.recommendedStrategy ||
      verification.recommendedStrategy === "sharp-only";

    if (verification.recommendedStrategy !== activePlan.strategy) {
      retryApplied = true;
      fallbackApplied = fallbackApplied || needsFallback;
      activePlan = buildEnhancementPlan({
        presetId: input.presetId,
        originalMimeType: input.originalMimeType,
        analysis,
        config,
        forcedStrategy: verification.recommendedStrategy,
        promptVariant: verification.recommendedStrategy.includes("ai") ? "retry" : undefined,
        reasonOverride: `verification requested ${verification.recommendedStrategy} after the initial output missed quality checks.`,
      });
      attemptedStrategies.push(activePlan.strategy);
      execution = await executePlan({
        plan: activePlan,
        imageBuffer: input.imageBuffer,
        originalMimeType: input.originalMimeType,
        presetId: input.presetId,
        requestId: input.requestId,
        processors,
      });
      verification = await verifyEnhancementOutput({
        presetId: input.presetId,
        inputAnalysis: analysis,
        output: execution.result,
      });
    }
  }

  logEvent("info", "orchestrator.completed", {
    requestId: input.requestId,
    presetId: input.presetId,
    analysisSummary: {
      format: analysis.format,
      dimensions: analysis.dimensions,
      readyScore: analysis.marketplaceSignals.readyScore,
      brightnessScore: analysis.quality.brightnessScore,
      contrastScore: analysis.quality.contrastScore,
      cropQuality: analysis.framing.cropQuality,
      likelyWhiteBackground: analysis.background.likelyWhite,
    },
    chosenPlan: activePlan.strategy,
    processorPath: execution.path,
    attemptedStrategies,
    fallbackApplied,
    retryApplied,
    verificationStatus: verification.status,
    verificationReasons: verification.reasons,
  });

  return {
    result: execution.result,
    outputBuffer: execution.outputBuffer,
    metadata: {
      analysis,
      plan: initialPlan,
      intent: null,
      shotPlan: null,
      consistency: null,
      promptPackage: null,
      verificationNode: null,
      attemptedStrategies,
      finalPath: execution.path,
      verification,
      fallbackApplied,
      retryApplied,
    },
  };
}
