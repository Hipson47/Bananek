import { getConfig } from "../config.js";
import { logError, logEvent } from "../utils/log.js";
import {
  OPS_EVENTS,
  recordOrchestrationCounter,
  recordVerificationOutcome,
} from "../utils/ops-metrics.js";
import { processImage as mockProcessImage } from "../processors/mock-processor.js";
import { processImage as sharpProcessImage } from "../processors/sharp-processor.js";
import { processImage as falProcessImage } from "../processors/fal-processor.js";
import { decodeProcessedDataUrl } from "../processors/data-url.js";
import type { EnhancementProcessorMap } from "../processors/contracts.js";
import { analyzeImage } from "./analysis.js";
import { updateConsistencyMemory } from "./consistency-memory.js";
import { buildEnhancementPlan, selectReplanCandidate } from "./planner.js";
import { runConsistencyNode } from "./consistency-node.js";
import { runIntentNode } from "./intent-node.js";
import { runPromptBuilderNode } from "./prompt-builder-node.js";
import { runShotPlannerNode } from "./shot-planner-node.js";
import { verifyEnhancementOutput } from "./verification.js";
import { runVerificationNode } from "./verification-node.js";
import { summarizeTelemetry, timeNode } from "../telemetry/orchestration-telemetry.js";
import type {
  CandidatePlan,
  ConsistencyMemory,
  EnhancementPlan,
  EnhancementProcessor,
  FailedAttemptSummary,
  OrchestratedEnhancement,
  OrchestratorInput,
  PromptPackage,
  VerificationResult,
} from "./types.js";

const DEFAULT_PROCESSORS: EnhancementProcessorMap = {
  mock: mockProcessImage,
  sharp: sharpProcessImage,
  fal: falProcessImage,
};

function buildQualityVerificationError(): { kind: "processing"; message: string } {
  return {
    kind: "processing",
    message: "Enhancement output failed quality verification.",
  };
}

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
        stage: step.prompt?.variant === "retry"
          ? "retry"
          : index === 0
            ? "primary"
            : "planned-followup",
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

function buildProcessorPrompt(args: {
  promptPackage: PromptPackage;
  stepPurpose: string;
  stepLabel?: string;
  stage: "primary" | "retry";
}): NonNullable<EnhancementPlan["steps"][number]["prompt"]> {
  const focusDirective = args.stepLabel
    ? `${args.stepPurpose}: ${args.stepLabel}.`
    : `Focus on ${args.stepPurpose.replace(/-/g, " ")}.`;

  const recoveryDirective = args.stage === "retry" && args.promptPackage.recoveryPrompt
    ? [args.promptPackage.recoveryPrompt]
    : [];

  const text = [
    args.stage === "retry" && args.promptPackage.recoveryPrompt
      ? args.promptPackage.recoveryPrompt
      : args.promptPackage.promptText,
    focusDirective,
  ].filter(Boolean).join(" ");

  return {
    variant: args.stage,
    text,
    directives: [
      ...args.promptPackage.consistencyRules,
      ...args.promptPackage.compositionRules,
      ...args.promptPackage.brandSafetyRules,
      ...args.promptPackage.constraintClauses,
      ...recoveryDirective,
    ].slice(0, 12),
    guidanceScale: args.promptPackage.guidanceScale,
  };
}

function applyPromptPackageToPlan(args: {
  plan: EnhancementPlan;
  promptPackage: PromptPackage;
  stage: "primary" | "retry";
}): EnhancementPlan {
  return {
    ...args.plan,
    steps: args.plan.steps.map((step) => (
      step.processor === "fal"
        ? {
            ...step,
            prompt: buildProcessorPrompt({
              promptPackage: args.promptPackage,
              stepPurpose: step.purpose,
              stepLabel: step.label,
              stage: args.stage,
            }),
          }
        : step
    )),
  };
}

async function verifyExecution(args: {
  presetId: OrchestratorInput["presetId"];
  inputAnalysis: OrchestratedEnhancement["metadata"]["analysis"];
  output: OrchestratedEnhancement["result"];
  promptPackage: PromptPackage;
  config: OrchestratorInput["config"];
  plan: EnhancementPlan;
}): Promise<{
  heuristicVerification: VerificationResult;
  verificationNode: Awaited<ReturnType<typeof runVerificationNode>> | null;
}> {
  const heuristicVerification = await verifyEnhancementOutput({
    presetId: args.presetId,
    inputAnalysis: args.inputAnalysis,
    output: args.output,
    plan: args.plan,
  });
  const verificationNode = await runVerificationNode({
    presetId: args.presetId,
    inputAnalysis: args.inputAnalysis,
    outputAnalysis: heuristicVerification.outputAnalysis,
    promptPackage: args.promptPackage,
    config: args.config,
    heuristicAccepted: heuristicVerification.accepted,
    heuristicReasons: heuristicVerification.reasons,
  });

  return {
    heuristicVerification,
    verificationNode,
  };
}

function summarizeFailedAttempt(args: {
  plan: EnhancementPlan;
  verification: VerificationResult;
  promptPackage: PromptPackage;
}): FailedAttemptSummary {
  return {
    candidatePlanId: args.plan.selectedCandidateId ?? args.plan.strategy,
    verificationScore: args.verification.score,
    issues: args.verification.issues,
    promptSnippet: args.promptPackage.masterPrompt.slice(0, 240),
  };
}

function chooseCandidateFromPlan(plan: EnhancementPlan): CandidatePlan | null {
  return plan.candidates?.find((candidate) => candidate.id === plan.selectedCandidateId) ?? null;
}

async function executeFalWithGraph(args: {
  imageBuffer: Buffer;
  presetId: OrchestratorInput["presetId"];
  originalMimeType: string;
  requestId?: string;
  config: OrchestratorInput["config"];
  processors: EnhancementProcessorMap;
  userGoal?: string | null;
  consistencyMemory?: ConsistencyMemory | null;
}): Promise<OrchestratedEnhancement> {
  const nodeMetrics: import("../telemetry/orchestration-telemetry.js").OrchestrationNodeMetric[] = [];
  let replanCount = 0;
  let verificationFailureCount = 0;
  const analysis = await timeNode(nodeMetrics, {
    nodeName: "analyze",
    run: () => analyzeImage(args.imageBuffer, args.originalMimeType),
  });
  const consistencyMemoryBefore = args.consistencyMemory ?? null;
  const failedAttempts: FailedAttemptSummary[] = [];
  const attemptedCandidateIds: string[] = [];
  let consistencyMemoryAfter: ConsistencyMemory | null = consistencyMemoryBefore;

  const intent = await timeNode(nodeMetrics, {
    nodeName: "intent-node",
    run: () => runIntentNode({
      presetId: args.presetId,
      analysis,
      config: args.config,
      requestId: args.requestId,
      userGoal: args.userGoal,
    }),
  });
  const shotPlan = await timeNode(nodeMetrics, {
    nodeName: "shot-planner-node",
    run: () => runShotPlannerNode({
      intent: intent.data,
      analysis,
      config: args.config,
    }),
  });
  const consistency = await timeNode(nodeMetrics, {
    nodeName: "consistency-node",
    run: () => runConsistencyNode({
      intent: intent.data,
      candidates: shotPlan.data,
      config: args.config,
    }),
  });

  let activePlan = buildEnhancementPlan({
    presetId: args.presetId,
    originalMimeType: args.originalMimeType,
    analysis,
    config: args.config,
    consistencyMemory: consistencyMemoryBefore,
  });
  attemptedCandidateIds.push(activePlan.selectedCandidateId ?? activePlan.strategy);
  const attemptedStrategies = [activePlan.selectedCandidateId ?? activePlan.strategy];
  let fallbackApplied = false;
  let retryApplied = false;

  const buildPromptPackageForPlan = async (plan: EnhancementPlan, variant: "primary" | "retry", retryAdjustments?: string[]) => (
    timeNode(nodeMetrics, {
      nodeName: "prompt-builder-node",
      detail: `${variant}:${plan.selectedCandidateId ?? plan.strategy}`,
      run: () => runPromptBuilderNode({
        presetId: args.presetId,
        analysis,
        intent: intent.data,
        consistency: consistency.data,
        selectedPlan: chooseCandidateFromPlan(plan),
        consistencyMemory: consistencyMemoryBefore,
        failedAttempts,
        config: args.config,
        variant,
        retryAdjustments,
      }),
    })
  );

  let promptPackage = await buildPromptPackageForPlan(activePlan, "primary");

  try {
    let planForExecution = applyPromptPackageToPlan({
      plan: activePlan,
      promptPackage: promptPackage.data,
      stage: "primary",
    });
    let execution = await timeNode(nodeMetrics, {
      nodeName: "execute",
      detail: activePlan.selectedCandidateId ?? activePlan.strategy,
      run: () => executePlan({
        plan: planForExecution,
        imageBuffer: args.imageBuffer,
        originalMimeType: args.originalMimeType,
        presetId: args.presetId,
        requestId: args.requestId,
        processors: args.processors,
      }),
    });
    let verificationState = await timeNode(nodeMetrics, {
      nodeName: "verify",
      detail: activePlan.selectedCandidateId ?? activePlan.strategy,
      run: () => verifyExecution({
        presetId: args.presetId,
        inputAnalysis: analysis,
        output: execution.result,
        promptPackage: promptPackage.data,
        config: args.config,
        plan: activePlan,
      }),
    });

    if (!verificationState.heuristicVerification.passed) {
      verificationFailureCount += 1;
      recordVerificationOutcome("failed", {
        requestId: args.requestId,
        presetId: args.presetId,
        score: verificationState.heuristicVerification.score,
        attempt: "initial",
      });
      failedAttempts.push(summarizeFailedAttempt({
        plan: activePlan,
        verification: verificationState.heuristicVerification,
        promptPackage: promptPackage.data,
      }));

      const alternateCandidate = selectReplanCandidate({
        candidates: activePlan.candidates ?? [],
        attemptedCandidateIds,
        currentCandidateId: activePlan.selectedCandidateId,
        suggestedCandidateId: verificationState.heuristicVerification.suggestedReplan,
      });

      if (alternateCandidate) {
        const verificationNode = verificationState.verificationNode;
        if (!verificationNode) {
          throw buildQualityVerificationError();
        }
        retryApplied = true;
        replanCount += 1;
        recordOrchestrationCounter(OPS_EVENTS.ORCHESTRATION_REPLAN, {
          requestId: args.requestId,
          presetId: args.presetId,
          candidateId: alternateCandidate.id,
        });
        activePlan = buildEnhancementPlan({
          presetId: args.presetId,
          originalMimeType: args.originalMimeType,
          analysis,
          config: args.config,
          forcedCandidateId: alternateCandidate.id,
          promptVariant: "retry",
          reasonOverride: `verification requested replanning to ${alternateCandidate.id} after the first output scored ${verificationState.heuristicVerification.score.toFixed(2)}.`,
          consistencyMemory: consistencyMemoryBefore,
        });
        attemptedCandidateIds.push(alternateCandidate.id);
        attemptedStrategies.push(alternateCandidate.id);
        promptPackage = await buildPromptPackageForPlan(
          activePlan,
          "retry",
          verificationNode.data.promptAdjustments,
        );
        planForExecution = applyPromptPackageToPlan({
          plan: activePlan,
          promptPackage: promptPackage.data,
          stage: "retry",
        });
        execution = await timeNode(nodeMetrics, {
          nodeName: "execute",
          detail: `replan:${activePlan.selectedCandidateId ?? activePlan.strategy}`,
          run: () => executePlan({
            plan: planForExecution,
            imageBuffer: args.imageBuffer,
            originalMimeType: args.originalMimeType,
            presetId: args.presetId,
            requestId: args.requestId,
            processors: args.processors,
          }),
        });
        verificationState = await timeNode(nodeMetrics, {
          nodeName: "verify",
          detail: `replan:${activePlan.selectedCandidateId ?? activePlan.strategy}`,
          run: () => verifyExecution({
            presetId: args.presetId,
            inputAnalysis: analysis,
            output: execution.result,
            promptPackage: promptPackage.data,
            config: args.config,
            plan: activePlan,
          }),
        });
      } else if (
        verificationState.verificationNode?.data.decision === "retry"
        && args.presetId !== "clean-background"
      ) {
        const verificationNode = verificationState.verificationNode;
        if (!verificationNode) {
          throw buildQualityVerificationError();
        }
        retryApplied = true;
        recordOrchestrationCounter(OPS_EVENTS.ORCHESTRATION_RETRY, {
          requestId: args.requestId,
          presetId: args.presetId,
          strategy: activePlan.selectedCandidateId ?? activePlan.strategy,
        });
        attemptedStrategies.push(`${activePlan.selectedCandidateId ?? activePlan.strategy}-retry`);
        promptPackage = await buildPromptPackageForPlan(
          activePlan,
          "retry",
          verificationNode.data.promptAdjustments,
        );
        promptPackage = {
          ...promptPackage,
          data: {
            ...promptPackage.data,
            guidanceScale: Math.max(
              1,
              Math.min(6, promptPackage.data.guidanceScale + verificationNode.data.guidanceScaleAdjustment),
            ),
          },
        };
        planForExecution = applyPromptPackageToPlan({
          plan: activePlan,
          promptPackage: promptPackage.data,
          stage: "retry",
        });
        execution = await timeNode(nodeMetrics, {
          nodeName: "execute",
          detail: `retry:${activePlan.selectedCandidateId ?? activePlan.strategy}`,
          run: () => executePlan({
            plan: planForExecution,
            imageBuffer: args.imageBuffer,
            originalMimeType: args.originalMimeType,
            presetId: args.presetId,
            requestId: args.requestId,
            processors: args.processors,
          }),
        });
        verificationState = await timeNode(nodeMetrics, {
          nodeName: "verify",
          detail: `retry:${activePlan.selectedCandidateId ?? activePlan.strategy}`,
          run: () => verifyExecution({
            presetId: args.presetId,
            inputAnalysis: analysis,
            output: execution.result,
            promptPackage: promptPackage.data,
            config: args.config,
            plan: activePlan,
          }),
        });
      }
    }

    if (!verificationState.heuristicVerification.passed) {
      if (
        args.config.processorFailurePolicy === "fallback-to-sharp"
        && activePlan.strategy !== "sharp-only"
        && !attemptedStrategies.includes("sharp-only")
      ) {
        fallbackApplied = true;
        recordOrchestrationCounter(OPS_EVENTS.ORCHESTRATION_FALLBACK, {
          requestId: args.requestId,
          presetId: args.presetId,
          fallbackStrategy: "sharp-only",
        });
        activePlan = buildEnhancementPlan({
          presetId: args.presetId,
          originalMimeType: args.originalMimeType,
          analysis,
          config: { ...args.config, processor: "sharp" },
          forcedStrategy: "sharp-only",
          reasonOverride: `verification failed after ${activePlan.selectedCandidateId ?? activePlan.strategy}, so orchestration fell back to deterministic sharp execution.`,
          consistencyMemory: consistencyMemoryBefore,
        });
        attemptedCandidateIds.push(activePlan.selectedCandidateId ?? activePlan.strategy);
        attemptedStrategies.push(activePlan.selectedCandidateId ?? activePlan.strategy);
        execution = await timeNode(nodeMetrics, {
          nodeName: "execute",
          detail: "fallback:sharp-only",
          run: () => executePlan({
            plan: activePlan,
            imageBuffer: args.imageBuffer,
            originalMimeType: args.originalMimeType,
            presetId: args.presetId,
            requestId: args.requestId,
            processors: args.processors,
          }),
        });
        verificationState = {
          heuristicVerification: await timeNode(nodeMetrics, {
            nodeName: "verify",
            detail: "fallback:sharp-only",
            run: () => verifyEnhancementOutput({
              presetId: args.presetId,
              inputAnalysis: analysis,
              output: execution.result,
              plan: activePlan,
            }),
          }),
          verificationNode: null,
        };
      }
    }

    if (!verificationState.heuristicVerification.passed) {
      throw buildQualityVerificationError();
    }

    consistencyMemoryAfter = updateConsistencyMemory({
      previousMemory: consistencyMemoryBefore,
      consistency: consistency.data,
      outputAnalysis: verificationState.heuristicVerification.outputAnalysis,
      promptPackage: promptPackage.data,
    });

    logEvent("info", "orchestrator.graph.completed", {
      requestId: args.requestId,
      presetId: args.presetId,
      analysisSummary: {
        format: analysis.format,
        dimensions: analysis.dimensions,
        readyScore: analysis.marketplaceSignals.readyScore,
        brightnessScore: analysis.quality.brightnessScore,
        contrastScore: analysis.quality.contrastScore,
        cropQuality: analysis.framing.cropQuality,
        likelyWhiteBackground: analysis.background.likelyWhite,
      },
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
          source: verificationState.verificationNode?.source ?? null,
          model: verificationState.verificationNode?.model ?? null,
          decision: verificationState.verificationNode?.data.decision ?? "accept",
          reasons: verificationState.verificationNode?.data.reasons ?? [],
        },
      },
      selectedPlan: activePlan.selectedCandidateId ?? activePlan.strategy,
      candidateScores: (activePlan.candidates ?? []).map((candidate) => ({
        id: candidate.id,
        score: candidate.score,
        expectedQuality: candidate.expectedQuality,
      })),
      promptPackageSummary: {
        guidanceScale: promptPackage.data.guidanceScale,
        masterPrompt: promptPackage.data.masterPrompt.slice(0, 200),
        recoveryPrompt: promptPackage.data.recoveryPrompt ?? null,
      },
      finalPath: execution.path,
      retryApplied,
      fallbackApplied,
      failedAttempts,
      telemetry: summarizeTelemetry({
        nodeMetrics,
        retryCount: retryApplied ? 1 : 0,
        replanCount,
        fallbackCount: fallbackApplied ? 1 : 0,
        verificationFailureCount,
      }),
      verificationResult: {
        status: verificationState.heuristicVerification.status,
        score: verificationState.heuristicVerification.score,
        issues: verificationState.heuristicVerification.issues,
        suggestedReplan: verificationState.heuristicVerification.suggestedReplan,
      },
      consistencyMemoryBefore,
      consistencyMemoryAfter,
    });

    return {
      result: execution.result,
      outputBuffer: execution.outputBuffer,
      metadata: {
        analysis,
        plan: activePlan,
        intent,
        shotPlan,
        consistency,
        promptPackage,
        verificationNode: verificationState.verificationNode,
        consistencyMemoryBefore,
        consistencyMemoryAfter,
        attemptedStrategies,
        failedAttempts,
        finalPath: execution.path,
        verification: verificationState.heuristicVerification,
        fallbackApplied,
        retryApplied,
        telemetry: {
          nodeMetrics,
          retryCount: retryApplied ? 1 : 0,
          replanCount,
          fallbackCount: fallbackApplied ? 1 : 0,
          verificationFailureCount,
          finalOutcomeClass: "succeeded",
        },
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
      consistencyMemory: consistencyMemoryBefore,
    });
    attemptedStrategies.push("sharp-only");
    logError("orchestrator.graph_failed", error, {
      requestId: args.requestId,
      presetId: args.presetId,
    });
    const execution = await timeNode(nodeMetrics, {
      nodeName: "execute",
      detail: "graph-failure-fallback:sharp-only",
      run: () => executePlan({
        plan: sharpPlan,
        imageBuffer: args.imageBuffer,
        originalMimeType: args.originalMimeType,
        presetId: args.presetId,
        requestId: args.requestId,
        processors: args.processors,
      }),
    });
    const verification = await timeNode(nodeMetrics, {
      nodeName: "verify",
      detail: "graph-failure-fallback:sharp-only",
      run: () => verifyEnhancementOutput({
        presetId: args.presetId,
        inputAnalysis: analysis,
        output: execution.result,
        plan: sharpPlan,
      }),
    });

    if (!verification.passed) {
      throw buildQualityVerificationError();
    }

    return {
      result: execution.result,
      outputBuffer: execution.outputBuffer,
      metadata: {
        analysis,
        plan: sharpPlan,
        intent,
        shotPlan,
        consistency,
        promptPackage,
        verificationNode: null,
        consistencyMemoryBefore,
        consistencyMemoryAfter: consistencyMemoryBefore,
        attemptedStrategies,
        failedAttempts,
        finalPath: execution.path,
        verification,
        fallbackApplied,
        retryApplied,
        telemetry: {
          nodeMetrics,
          retryCount: retryApplied ? 1 : 0,
          replanCount,
          fallbackCount: fallbackApplied ? 1 : 0,
          verificationFailureCount,
          finalOutcomeClass: "succeeded",
        },
      },
    };
  }
}

export async function orchestrateEnhancement(input: OrchestratorInput): Promise<OrchestratedEnhancement> {
  const config = input.config ?? getConfig();
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
      consistencyMemory: input.consistencyMemory,
    });
  }

  const nodeMetrics: import("../telemetry/orchestration-telemetry.js").OrchestrationNodeMetric[] = [];
  let verificationFailureCount = 0;
  const analysis = await timeNode(nodeMetrics, {
    nodeName: "analyze",
    run: () => analyzeImage(input.imageBuffer, input.originalMimeType),
  });
  const initialPlan = buildEnhancementPlan({
    presetId: input.presetId,
    originalMimeType: input.originalMimeType,
    analysis,
    config,
    consistencyMemory: input.consistencyMemory,
  });
  const attemptedStrategies = [initialPlan.selectedCandidateId ?? initialPlan.strategy];
  let activePlan = initialPlan;
  let fallbackApplied = false;
  let retryApplied = false;
  let execution: Awaited<ReturnType<typeof executePlan>>;

  try {
    execution = await timeNode(nodeMetrics, {
      nodeName: "execute",
      detail: activePlan.selectedCandidateId ?? activePlan.strategy,
      run: () => executePlan({
        plan: activePlan,
        imageBuffer: input.imageBuffer,
        originalMimeType: input.originalMimeType,
        presetId: input.presetId,
        requestId: input.requestId,
        processors,
      }),
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
      consistencyMemory: input.consistencyMemory,
    });
    attemptedStrategies.push(activePlan.selectedCandidateId ?? activePlan.strategy);
    logError("orchestrator.primary_failed", error, {
      requestId: input.requestId,
      presetId: input.presetId,
      fallbackStrategy: activePlan.strategy,
    });
    execution = await timeNode(nodeMetrics, {
      nodeName: "execute",
      detail: `fallback:${activePlan.selectedCandidateId ?? activePlan.strategy}`,
      run: () => executePlan({
        plan: activePlan,
        imageBuffer: input.imageBuffer,
        originalMimeType: input.originalMimeType,
        presetId: input.presetId,
        requestId: input.requestId,
        processors,
      }),
    });
  }

  let verification = await timeNode(nodeMetrics, {
    nodeName: "verify",
    detail: activePlan.selectedCandidateId ?? activePlan.strategy,
    run: () => verifyEnhancementOutput({
      presetId: input.presetId,
      inputAnalysis: analysis,
      output: execution.result,
      plan: activePlan,
    }),
  });

  const safeRecommendedStrategy = verification.recommendedStrategy?.includes("ai")
      ? "sharp-only"
      : verification.recommendedStrategy;

  if (!verification.accepted && verification.status === "retry" && safeRecommendedStrategy) {
    verificationFailureCount += 1;
    const needsFallback =
      activePlan.fallbackStrategy === safeRecommendedStrategy ||
      safeRecommendedStrategy === "sharp-only";

    if (safeRecommendedStrategy !== activePlan.strategy) {
      retryApplied = true;
      fallbackApplied = fallbackApplied || needsFallback;
      activePlan = buildEnhancementPlan({
        presetId: input.presetId,
        originalMimeType: input.originalMimeType,
        analysis,
        config,
        forcedStrategy: safeRecommendedStrategy,
        promptVariant: safeRecommendedStrategy.includes("ai") ? "retry" : undefined,
        reasonOverride: `verification requested ${safeRecommendedStrategy} after the initial output missed quality checks.`,
        consistencyMemory: input.consistencyMemory,
      });
      attemptedStrategies.push(activePlan.selectedCandidateId ?? activePlan.strategy);
      execution = await timeNode(nodeMetrics, {
        nodeName: "execute",
        detail: `retry:${activePlan.selectedCandidateId ?? activePlan.strategy}`,
        run: () => executePlan({
          plan: activePlan,
          imageBuffer: input.imageBuffer,
          originalMimeType: input.originalMimeType,
          presetId: input.presetId,
          requestId: input.requestId,
          processors,
        }),
      });
      verification = await timeNode(nodeMetrics, {
        nodeName: "verify",
        detail: `retry:${activePlan.selectedCandidateId ?? activePlan.strategy}`,
        run: () => verifyEnhancementOutput({
          presetId: input.presetId,
          inputAnalysis: analysis,
          output: execution.result,
          plan: activePlan,
        }),
      });
    }
  }

  if (!verification.passed) {
    throw buildQualityVerificationError();
  }

  recordVerificationOutcome("passed", {
    requestId: input.requestId,
    presetId: input.presetId,
    score: verification.score,
  });

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
    chosenPlan: activePlan.selectedCandidateId ?? activePlan.strategy,
    processorPath: execution.path,
    attemptedStrategies,
    fallbackApplied,
    retryApplied,
    telemetry: summarizeTelemetry({
      nodeMetrics,
      retryCount: retryApplied ? 1 : 0,
      replanCount: 0,
      fallbackCount: fallbackApplied ? 1 : 0,
      verificationFailureCount,
    }),
    verificationStatus: verification.status,
    verificationScore: verification.score,
    verificationReasons: verification.reasons,
  });

  return {
    result: execution.result,
    outputBuffer: execution.outputBuffer,
    metadata: {
      analysis,
      plan: activePlan,
      intent: null,
      shotPlan: null,
      consistency: null,
      promptPackage: null,
      verificationNode: null,
      consistencyMemoryBefore: input.consistencyMemory ?? null,
      consistencyMemoryAfter: input.consistencyMemory ?? null,
      attemptedStrategies,
      failedAttempts: [],
      finalPath: execution.path,
      verification,
      fallbackApplied,
      retryApplied,
      telemetry: {
        nodeMetrics,
        retryCount: retryApplied ? 1 : 0,
        replanCount: 0,
        fallbackCount: fallbackApplied ? 1 : 0,
        verificationFailureCount,
        finalOutcomeClass: "succeeded",
      },
    },
  };
}
