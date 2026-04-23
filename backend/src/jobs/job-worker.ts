import { randomUUID } from "node:crypto";
import path from "node:path";

import type { AppConfig } from "../config.js";
import { getConfig } from "../config.js";
import { orchestrateEnhancement } from "../orchestration/enhancement-orchestrator.js";
import { logError, logEvent } from "../utils/log.js";
import { deleteStoredObject, readStoredObject, writeStoredObject } from "../storage/object-store.js";
import { storeOutput } from "../storage/output-store.js";
import { getConsistencyProfile, upsertConsistencyProfile } from "../storage/consistency-profile-store.js";
import { refundSessionCredit } from "../storage/session-store.js";
import {
  claimNextQueuedJob,
  getEnhancementJob,
  markEnhancementJobFailed,
  markEnhancementJobSucceeded,
  requeueRunningJobs,
} from "./job-store.js";
import { recordOrchestrationTelemetry, summarizeTelemetry } from "../telemetry/orchestration-telemetry.js";

let workerTimer: NodeJS.Timeout | null = null;
let workerRunning = false;

const PROCESSING_FAILURE_MESSAGE =
  "We couldn't complete this enhancement. Try again or use a different product image.";

export function buildJobInputStorageKey(filename: string): string {
  const safeExtension = path.extname(filename) || ".bin";
  return path.posix.join("inputs", `${randomUUID()}${safeExtension}`);
}

export async function persistJobInput(args: {
  filename: string;
  bytes: Buffer;
}): Promise<string> {
  const storageKey = buildJobInputStorageKey(args.filename);
  await writeStoredObject({
    storageKey,
    bytes: args.bytes,
  });
  return storageKey;
}

function toPublicJobError(): { kind: "processing"; message: string } {
  return {
    kind: "processing",
    message: PROCESSING_FAILURE_MESSAGE,
  };
}

async function processClaimedJob(config: AppConfig): Promise<boolean> {
  const job = await claimNextQueuedJob();

  if (!job) {
    return false;
  }

  workerRunning = true;

  try {
    const inputBytes = await readStoredObject(job.inputObjectKey);
    const consistencyProfile = await getConsistencyProfile(job.consistencyScopeKey);
    const orchestrated = await orchestrateEnhancement({
      imageBuffer: inputBytes,
      originalMimeType: job.inputMimeType,
      presetId: job.presetId,
      config,
      requestId: job.requestId,
      userGoal: job.userGoal,
      consistencyMemory: consistencyProfile?.memory ?? null,
    });
    const storedOutput = await storeOutput({
      bytes: orchestrated.outputBuffer,
      sessionId: job.sessionId,
      filename: orchestrated.result.filename,
      mimeType: orchestrated.result.mimeType,
      requestId: job.requestId,
      signingSecret: config.sessionSecret,
      urlTtlSeconds: config.outputUrlTtlSeconds,
    });

    if (orchestrated.metadata.consistencyMemoryAfter) {
      await upsertConsistencyProfile({
        scopeKey: job.consistencyScopeKey,
        sessionId: job.sessionId,
        presetId: job.presetId,
        memory: orchestrated.metadata.consistencyMemoryAfter,
        jobId: job.id,
        requestId: job.requestId,
      });
    }

    await recordOrchestrationTelemetry({
      requestId: job.requestId,
      jobId: job.id,
      sessionId: job.sessionId,
      presetId: job.presetId,
      nodeMetrics: orchestrated.metadata.telemetry.nodeMetrics,
      retryCount: orchestrated.metadata.telemetry.retryCount,
      replanCount: orchestrated.metadata.telemetry.replanCount,
      fallbackCount: orchestrated.metadata.telemetry.fallbackCount,
      verificationFailureCount: orchestrated.metadata.telemetry.verificationFailureCount,
      processorPath: orchestrated.metadata.finalPath,
      finalOutcomeClass: "succeeded",
    });

    await markEnhancementJobSucceeded({
      jobId: job.id,
      outputId: storedOutput.outputId,
      retryCount: orchestrated.metadata.telemetry.retryCount,
      replanCount: orchestrated.metadata.telemetry.replanCount,
      fallbackCount: orchestrated.metadata.telemetry.fallbackCount,
      verificationStatus: orchestrated.metadata.verification.status,
      verificationScore: orchestrated.metadata.verification.score,
      processorPath: orchestrated.metadata.finalPath,
      telemetrySummary: summarizeTelemetry({
        nodeMetrics: orchestrated.metadata.telemetry.nodeMetrics,
        retryCount: orchestrated.metadata.telemetry.retryCount,
        replanCount: orchestrated.metadata.telemetry.replanCount,
        fallbackCount: orchestrated.metadata.telemetry.fallbackCount,
        verificationFailureCount: orchestrated.metadata.telemetry.verificationFailureCount,
        finalOutcomeClass: "succeeded",
      }),
      outcomeClass: "succeeded",
    });

    await deleteStoredObject(job.inputObjectKey);

    logEvent("info", "job.completed", {
      requestId: job.requestId,
      jobId: job.id,
      sessionId: job.sessionId,
      presetId: job.presetId,
      outputId: storedOutput.outputId,
      processorPath: orchestrated.metadata.finalPath,
    });
  } catch (error) {
    const failedJob = await getEnhancementJob({
      sessionId: job.sessionId,
      jobId: job.id,
    });
    const publicError = toPublicJobError();
    const retryCount = failedJob?.retryCount ?? 0;
    const replanCount = failedJob?.replanCount ?? 0;
    const fallbackCount = failedJob?.fallbackCount ?? 0;

    await markEnhancementJobFailed({
      jobId: job.id,
      errorKind: publicError.kind,
      errorMessage: publicError.message,
      retryCount,
      replanCount,
      fallbackCount,
      telemetrySummary: summarizeTelemetry({
        nodeMetrics: [],
        retryCount,
        replanCount,
        fallbackCount,
        verificationFailureCount: 0,
        finalOutcomeClass: "failed",
      }),
      outcomeClass: "failed",
    });
    await refundSessionCredit(job.sessionId, job.requestId, "job_failed");
    await deleteStoredObject(job.inputObjectKey);
    logError("job.failed", error, {
      requestId: job.requestId,
      jobId: job.id,
      sessionId: job.sessionId,
      presetId: job.presetId,
    });
  } finally {
    workerRunning = false;
  }

  return true;
}

export async function runJobWorkerOnce(config = getConfig()): Promise<boolean> {
  if (workerRunning) {
    return false;
  }

  return processClaimedJob(config);
}

export function kickJobWorker(config = getConfig()): void {
  if (workerRunning) {
    return;
  }

  void runJobWorkerOnce(config).catch((error) => {
    logError("job_worker.kick_failed", error, {});
  });
}

export async function prepareJobWorkerForStartup(): Promise<void> {
  await requeueRunningJobs();
}

export function startJobWorkerLoop(config = getConfig()): void {
  if (workerTimer) {
    return;
  }

  workerTimer = setInterval(() => {
    kickJobWorker(config);
  }, config.jobPollIntervalMs);

  workerTimer.unref?.();
}

export function stopJobWorkerLoop(): void {
  if (!workerTimer) {
    return;
  }

  clearInterval(workerTimer);
  workerTimer = null;
}
