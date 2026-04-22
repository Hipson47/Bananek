import type { AppConfig } from "../config.js";
import type { ProcessorPromptContext, EnhancementProcessor, EnhancementProcessorMap } from "../processors/contracts.js";
import type { PresetId, ProcessedImageResult } from "../types.js";

export type { EnhancementProcessor } from "../processors/contracts.js";

export type ImageAnalysis = {
  format: "jpeg" | "png" | "webp";
  mimeType: string;
  dimensions: {
    width: number;
    height: number;
  };
  aspectRatio: number;
  hasAlpha: boolean;
  quality: {
    brightnessScore: number;
    contrastScore: number;
    sharpnessScore: number;
  };
  background: {
    dominantRgb: [number, number, number];
    likelyPlain: boolean;
    likelyWhite: boolean;
    borderBrightnessScore: number;
  };
  framing: {
    squareScore: number;
    cropQuality: "square" | "balanced" | "wide" | "tall";
  };
  marketplaceSignals: {
    squareComposition: boolean;
    whiteBackgroundLikely: boolean;
    brightnessAcceptable: boolean;
    contrastAcceptable: boolean;
    readyScore: number;
  };
};

export type AiPromptSpec = ProcessorPromptContext;

export type OpenRouterNodeSource = "openrouter" | "deterministic-fallback";

export type IntentSpec = {
  presetId: PresetId;
  customerGoal: string | null;
  primaryObjective: string;
  backgroundGoal: "pure-white" | "clean-white" | "neutral" | "transparent-cutout";
  framingGoal: "square-centered" | "balanced-centered" | "tight-product";
  lightingGoal: "neutral-lift" | "studio-premium" | "catalog-clean";
  detailGoal: "shape-preservation" | "catalog-clarity" | "material-richness";
  realismGuard: "strict";
  emphasis: string[];
};

export type ShotPlanCandidate = {
  candidateId: "option-a" | "option-b" | "option-c" | "option-d";
  title: string;
  framing: IntentSpec["framingGoal"];
  background: IntentSpec["backgroundGoal"];
  lighting: IntentSpec["lightingGoal"];
  crop: "loose" | "balanced" | "tight";
  rationale: string;
  fitScore: number;
  riskFlags: string[];
};

export type ConsistencyMemory = {
  backgroundStyle?: string;
  lightingDirection?: string;
  shadowStyle?: string;
  cropStyle?: string;
  colorTemperature?: string;
};

export type FailedAttemptSummary = {
  candidatePlanId: string;
  verificationScore: number;
  issues: string[];
  promptSnippet: string;
};

export type ConsistencySpec = {
  selectionMode: "selected" | "merged";
  selectedCandidateIds: Array<ShotPlanCandidate["candidateId"]>;
  finalFraming: IntentSpec["framingGoal"];
  finalBackground: IntentSpec["backgroundGoal"];
  finalLighting: IntentSpec["lightingGoal"];
  finalCrop: "loose" | "balanced" | "tight";
  keepConstraints: string[];
  avoidConstraints: string[];
  rationale: string;
};

export type PromptPackage = {
  masterPrompt: string;
  negativePrompt?: string;
  consistencyRules: string[];
  compositionRules: string[];
  brandSafetyRules: string[];
  recoveryPrompt?: string;
  promptText: string;
  negativePromptText: string;
  guidanceScale: number;
  subjectClause: string;
  sceneClause: string;
  lightingClause: string;
  detailClause: string;
  constraintClauses: string[];
  negativeClauses: string[];
  executionNotes: string[];
};

export type VerificationDecision = {
  decision: "accept" | "retry";
  confidence: number;
  reasons: string[];
  promptAdjustments: string[];
  guidanceScaleAdjustment: number;
};

export type GraphNodeResult<T> = {
  data: T;
  source: OpenRouterNodeSource;
  model: string | null;
  attempts: number;
  fallbackReason: string | null;
};

export type EnhancementPlanStrategy =
  | "mock-only"
  | "sharp-only"
  | "ai-only"
  | "sharp-then-ai"
  | "ai-then-sharp";

export type EnhancementPlanStep = {
  processor: EnhancementProcessor;
  purpose:
    | "deterministic"
    | "creative"
    | "normalize"
    | "repair"
    | "background"
    | "relight"
    | "upscale";
  label?: string;
  prompt?: AiPromptSpec;
};

export type CandidatePlan = {
  id: string;
  strategy: string;
  orderedSteps: EnhancementPlanStep[];
  estimatedCost: number;
  estimatedLatency: number;
  expectedQuality: number;
  confidence: number;
  score: number;
  reasons: string[];
};

export type EnhancementPlan = {
  strategy: EnhancementPlanStrategy;
  reason: string;
  steps: EnhancementPlanStep[];
  fallbackStrategy: EnhancementPlanStrategy | null;
  verificationPolicy: "accept" | "retry-once";
  candidates?: CandidatePlan[];
  selectedCandidateId?: string;
};

export type VerificationResult = {
  passed: boolean;
  score: number;
  issues: string[];
  suggestedReplan?: string | null;
  accepted: boolean;
  status: "accepted" | "retry" | "rejected";
  reasons: string[];
  recommendedStrategy: EnhancementPlanStrategy | null;
  outputAnalysis: ImageAnalysis;
};

export type EnhancementExecutionResult = ProcessedImageResult;

export type OrchestrationMetadata = {
  analysis: ImageAnalysis;
  plan: EnhancementPlan;
  intent: GraphNodeResult<IntentSpec> | null;
  shotPlan: GraphNodeResult<ShotPlanCandidate[]> | null;
  consistency: GraphNodeResult<ConsistencySpec> | null;
  promptPackage: GraphNodeResult<PromptPackage> | null;
  verificationNode: GraphNodeResult<VerificationDecision> | null;
  consistencyMemoryBefore: ConsistencyMemory | null;
  consistencyMemoryAfter: ConsistencyMemory | null;
  attemptedStrategies: string[];
  failedAttempts: FailedAttemptSummary[];
  finalPath: EnhancementProcessor[];
  verification: VerificationResult;
  fallbackApplied: boolean;
  retryApplied: boolean;
};

export type OrchestratedEnhancement = {
  result: ProcessedImageResult;
  outputBuffer: Buffer;
  metadata: OrchestrationMetadata;
};

export type OrchestratorInput = {
  imageBuffer: Buffer;
  originalMimeType: string;
  presetId: PresetId;
  config: AppConfig;
  requestId?: string;
  userGoal?: string | null;
  consistencyMemory?: ConsistencyMemory | null;
  processors?: EnhancementProcessorMap;
};
