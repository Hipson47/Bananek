import { randomUUID } from "node:crypto";
import path from "node:path";

import type { AppConfig } from "../config.js";
import { getConfig } from "../config.js";
import { orchestrateEnhancement } from "../orchestration/enhancement-orchestrator.js";
import { logError } from "../utils/log.js";
import {
  OPS_EVENTS,
  recordJobFailure,
  recordJobLifecycle,
  recordWorkerShutdownEvent,
} from "../utils/ops-metrics.js";
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
let workerShuttingDown = false;
let activeRunPromise: Promise<boolean> | null = null;
let activeJobId: string | null = null;

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
  if (workerShuttingDown) {
    return false;
  }

  const job = await claimNextQueuedJob();

  if (!job) {
    return false;
  }

  workerRunning = true;
  activeJobId = job.id;
  const queueWaitMs = Math.max(0, Date.now() - Date.parse(job.createdAt));

  recordJobLifecycle(OPS_EVENTS.JOB_CLAIMED, {
    requestId: job.requestId,
    jobId: job.id,
    sessionId: job.sessionId,
    presetId: job.presetId,
    queueWaitMs,
  });

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

    recordJobLifecycle(OPS_EVENTS.JOB_COMPLETED, {
      requestId: job.requestId,
      jobId: job.id,
      sessionId: job.sessionId,
      presetId: job.presetId,
      outputId: storedOutput.outputId,
      processorPath: orchestrated.metadata.finalPath,
      queueWaitMs,
      totalJobMs: Date.now() - Date.parse(job.createdAt),
      retryCount: orchestrated.metadata.telemetry.retryCount,
      replanCount: orchestrated.metadata.telemetry.replanCount,
      fallbackCount: orchestrated.metadata.telemetry.fallbackCount,
      verificationFailureCount: orchestrated.metadata.telemetry.verificationFailureCount,
      verificationStatus: orchestrated.metadata.verification.status,
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

    try {
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
    } catch (markFailure) {
      logError("job.mark_failed_error", markFailure, {
        requestId: job.requestId,
        jobId: job.id,
        sessionId: job.sessionId,
      });
    }

    try {
      await refundSessionCredit(job.sessionId, job.requestId, "job_failed");
    } catch (refundFailure) {
      logError("job.refund_error", refundFailure, {
        requestId: job.requestId,
        jobId: job.id,
        sessionId: job.sessionId,
      });
    }

    try {
      await deleteStoredObject(job.inputObjectKey);
    } catch (deleteFailure) {
      logError("job.input_delete_error", deleteFailure, {
        requestId: job.requestId,
        jobId: job.id,
        sessionId: job.sessionId,
      });
    }

    recordJobFailure(error, {
      requestId: job.requestId,
      jobId: job.id,
      sessionId: job.sessionId,
      presetId: job.presetId,
      queueWaitMs,
      totalJobMs: Date.now() - Date.parse(job.createdAt),
    });
  } finally {
    workerRunning = false;
    activeJobId = null;
  }

  return true;
}

export async function runJobWorkerOnce(config = getConfig()): Promise<boolean> {
  if (workerRunning || workerShuttingDown) {
    return false;
  }

  activeRunPromise = processClaimedJob(config);

  try {
    return await activeRunPromise;
  } finally {
    activeRunPromise = null;
  }
}

export function kickJobWorker(config = getConfig()): void {
  if (workerRunning || workerShuttingDown) {
    return;
  }

  void runJobWorkerOnce(config).catch((error) => {
    logError("job_worker.kick_failed", error, {});
  });
}

export async function prepareJobWorkerForStartup(): Promise<void> {
  const requeuedJobs = await requeueRunningJobs();
  if (requeuedJobs > 0) {
    recordJobLifecycle(OPS_EVENTS.JOB_REQUEUED, {
      requeuedJobs,
      source: "startup",
    });
  }
}

export function startJobWorkerLoop(config = getConfig()): void {
  if (workerTimer || workerShuttingDown) {
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

export function isJobWorkerShuttingDown(): boolean {
  return workerShuttingDown;
}

export function getActiveJobId(): string | null {
  return activeJobId;
}

export async function shutdownJobWorker(args: {
  drainTimeoutMs: number;
}): Promise<{ drained: boolean; activeJobId: string | null }> {
  workerShuttingDown = true;
  stopJobWorkerLoop();

  const startedAt = Date.now();
  recordWorkerShutdownEvent(OPS_EVENTS.WORKER_SHUTDOWN_STARTED, {
    activeJobId,
    workerRunning,
    drainTimeoutMs: args.drainTimeoutMs,
  });

  if (!activeRunPromise) {
    recordWorkerShutdownEvent(OPS_EVENTS.WORKER_SHUTDOWN_COMPLETED, {
      activeJobId: null,
      drained: true,
      drainDurationMs: Date.now() - startedAt,
    });
    return { drained: true, activeJobId: null };
  }

  const timedOut = await Promise.race([
    activeRunPromise.then(() => false),
    new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(true), args.drainTimeoutMs);
      timeout.unref?.();
    }),
  ]);

  if (timedOut) {
    const releasedJobs = await requeueRunningJobs();
    recordWorkerShutdownEvent(OPS_EVENTS.WORKER_SHUTDOWN_TIMED_OUT, {
      activeJobId,
      releasedJobs,
      drainDurationMs: Date.now() - startedAt,
    });
    return { drained: false, activeJobId };
  }

  recordWorkerShutdownEvent(OPS_EVENTS.WORKER_SHUTDOWN_COMPLETED, {
    activeJobId: null,
    drained: true,
    drainDurationMs: Date.now() - startedAt,
  });
  return { drained: true, activeJobId: null };
}
export function resetJobWorkerForTests(): void {
  stopJobWorkerLoop();
  workerRunning = false;
  workerShuttingDown = false;
  activeRunPromise = null;
  activeJobId = null;
}

export function resumeJobWorkerClaims(): void {
  workerShuttingDown = false;
}
