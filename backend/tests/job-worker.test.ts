import { afterEach, describe, expect, it } from "vitest";

import type { AppConfig } from "../src/config.js";
import { setActiveConfig } from "../src/config.js";
import {
  persistJobInput,
  prepareJobWorkerForStartup,
  resetJobWorkerForTests,
  runJobWorkerOnce,
  shutdownJobWorker,
} from "../src/jobs/job-worker.js";
import { claimNextQueuedJob, createEnhancementJob, getEnhancementJob } from "../src/jobs/job-store.js";
import { configureDatabase, closeDatabase, resetDatabaseForTests } from "../src/storage/database.js";
import { createSession } from "../src/storage/session-store.js";

const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGM4MS0FjhiI4wAA4dIcIR+QGUQAAAAASUVORK5CYII=";

function buildConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3001,
    allowedOrigins: ["http://localhost:5173"],
    allowedHosts: ["localhost:3001", "127.0.0.1:3001"],
    trustedProxyRanges: [],
    processor: "mock",
    processorFailurePolicy: "strict",
    databasePath: "backend/data/test-runtime.sqlite",
    objectStoragePath: "backend/data/test-object-store",
    sessionSecret: "super-secret-for-tests-1234567890",
    sessionCookieName: "enhancer_session",
    defaultSessionCredits: 3,
    rateLimitWindowMs: 60_000,
    enhanceRateLimitMax: 10,
    sessionBootstrapRateLimitMax: 30,
    outputUrlTtlSeconds: 3600,
    sessionLockTtlMs: 120_000,
    jobPollIntervalMs: 250,
    jobRetentionSeconds: 86_400,
    shutdownDrainTimeoutMs: 1_000,
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

async function queueJob(config: AppConfig) {
  setActiveConfig(config);
  configureDatabase(config.databasePath);
  const session = await createSession(2, "bootstrap-request");
  const inputObjectKey = await persistJobInput({
    filename: "shoe.png",
    bytes: Buffer.from(TINY_PNG_B64, "base64"),
  });

  const job = await createEnhancementJob({
    sessionId: session.id,
    presetId: "clean-background",
    requestId: "job-request",
    inputObjectKey,
    inputMimeType: "image/png",
    inputFilename: "shoe.png",
    consistencyScopeKey: `session:${session.id}:preset:clean-background`,
  });

  if (!job) {
    throw new Error("Expected test job to be created.");
  }

  return {
    session,
    job,
  };
}

afterEach(() => {
  resetJobWorkerForTests();
  closeDatabase();
  resetDatabaseForTests();
});

describe("job worker lifecycle", () => {
  it("drains in-flight work and stops claiming new jobs during shutdown", async () => {
    const config = buildConfig();
    const { session, job } = await queueJob(config);

    const runPromise = runJobWorkerOnce(config);
    await new Promise((resolve) => setTimeout(resolve, 25));

    const shutdownPromise = shutdownJobWorker({
      drainTimeoutMs: 1_000,
    });
    const secondRunAttempt = await runJobWorkerOnce(config);
    const shutdownResult = await shutdownPromise;

    expect(secondRunAttempt).toBe(false);
    expect(await runPromise).toBe(true);
    expect(shutdownResult.drained).toBe(true);

    const storedJob = await getEnhancementJob({
      sessionId: session.id,
      jobId: job.id,
    });
    expect(storedJob?.status).toBe("succeeded");
  });

  it("requeues running jobs on startup recovery", async () => {
    const config = buildConfig();
    const { session, job } = await queueJob(config);

    await claimNextQueuedJob();
    await prepareJobWorkerForStartup();

    const recoveredJob = await getEnhancementJob({
      sessionId: session.id,
      jobId: job.id,
    });

    expect(recoveredJob?.status).toBe("queued");
  });
});
