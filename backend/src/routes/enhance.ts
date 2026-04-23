import { Hono } from "hono";
import type { Context } from "hono";

import type { AppEnv } from "../app-env.js";
import type { AppConfig } from "../config.js";
import {
  inspectUploadedImage,
  isAppError,
  parseJsonEnhanceBody,
  parseMultipartEnhanceBody,
} from "../image-validation.js";
import { orchestrateEnhancement } from "../orchestration/enhancement-orchestrator.js";
import { consumeRateLimit } from "../security/rate-limiter.js";
import {
  acquireSessionProcessingLock,
  releaseSessionProcessingLock,
} from "../security/session-locks.js";
import {
  createSession,
  refundSessionCredit,
  reserveSessionCredit,
  touchSession,
} from "../storage/session-store.js";
import {
  buildStoredOutputUrl,
  getStoredOutputById,
  readStoredOutput,
  resolveStoredOutput,
  storeOutput,
} from "../storage/output-store.js";
import {
  buildDefaultConsistencyScope,
} from "../storage/consistency-profile-store.js";
import { deleteStoredObject } from "../storage/object-store.js";
import { persistJobInput, kickJobWorker } from "../jobs/job-worker.js";
import {
  createEnhancementJob,
  getEnhancementJob,
} from "../jobs/job-store.js";
import { getCustomerProcessorLabel } from "../processors/customer-label.js";
import { isAllowedHost, isAllowedOrigin } from "../security/request-trust.js";
import { logError, logEvent } from "../utils/log.js";
import { signValue } from "../utils/signing.js";

const PROCESSING_FAILURE_MESSAGE =
  "We couldn't complete this enhancement. Try again or use a different product image.";

type AcceptedEnhancementJob = {
  jobId: string;
  status: "queued" | "running";
  statusUrl: string;
};

function serialiseSession(session: {
  id: string;
  creditsRemaining: number;
  creditsUsed: number;
}) {
  return {
    sessionId: session.id,
    creditsRemaining: session.creditsRemaining,
    creditsUsed: session.creditsUsed,
  };
}

function toPublicErrorResponse(err: unknown): {
  status: 400 | 500;
  body: { error: { kind: "validation" | "processing"; message: string } };
} {
  const appError = isAppError(err)
    ? err
    : { kind: "processing" as const, message: "Image processing failed." };

  if (appError.kind === "validation") {
    return {
      status: 400,
      body: { error: appError },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        kind: "processing",
        message: PROCESSING_FAILURE_MESSAGE,
      },
    },
  };
}

function applyRateLimitHeaders(c: Context<AppEnv>, remaining: number, resetAt: number): void {
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-Reset", String(resetAt));
}

function buildAcceptedJobResponse(jobId: string): AcceptedEnhancementJob {
  return {
    jobId,
    status: "queued",
    statusUrl: `/api/jobs/${jobId}`,
  };
}

function rejectStateChangingRequestBoundary(c: Context<AppEnv>, config: AppConfig): Response | null {
  const origin = c.req.header("origin") ?? null;
  const host = c.req.header("host") ?? null;

  if (!isAllowedHost(host, config.allowedHosts)) {
    logEvent("warn", "request.host_rejected", {
      requestId: c.get("requestId"),
      host,
      allowedHosts: config.allowedHosts,
      clientIp: c.get("clientIp"),
      method: c.req.method,
      path: new URL(c.req.url).pathname,
    });

    return c.json(
      { error: { kind: "processing", message: "Request host is not allowed." } },
      403,
    );
  }

  if (origin && !isAllowedOrigin(origin, config.allowedOrigins)) {
    logEvent("warn", "request.origin_rejected", {
      requestId: c.get("requestId"),
      origin,
      allowedOrigins: config.allowedOrigins,
      clientIp: c.get("clientIp"),
      method: c.req.method,
      path: new URL(c.req.url).pathname,
    });

    return c.json(
      { error: { kind: "processing", message: "Request origin is not allowed." } },
      403,
    );
  }

  return null;
}

export function createEnhanceRouter(config: AppConfig) {
  const router = new Hono<AppEnv>();

  router.get("/health", (c) => c.json({ status: "ok" }));

  router.get("/session", async (c) => {
    const requestId = c.get("requestId");
    const clientIp = c.get("clientIp");
    const rateLimit = consumeRateLimit(
      `session-bootstrap:${clientIp}`,
      config.sessionBootstrapRateLimitMax,
      config.rateLimitWindowMs,
    );

    if (!rateLimit) {
      logEvent("warn", "rate_limit.rejected", {
        requestId,
        clientIp,
        route: "session-bootstrap",
        ipLimited: true,
      });
      return c.json(
        { error: { kind: "processing", message: "Too many session requests. Try again shortly." } },
        429,
      );
    }

    applyRateLimitHeaders(c, rateLimit.remaining, rateLimit.resetAt);

    const currentSession = c.get("session");
    const session = currentSession
      ? await touchSession(currentSession)
      : await createSession(config.defaultSessionCredits, requestId);

    const signedSessionId = signValue(session.id, config.sessionSecret);

    c.header(
      "Set-Cookie",
      `${config.sessionCookieName}=${signedSessionId}; Path=/api; Max-Age=2592000; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    c.header("Cache-Control", "no-store");

    return c.json(serialiseSession(session), 200);
  });

  router.get("/jobs/:jobId", async (c) => {
    const session = c.get("session");

    if (!session) {
      return c.json(
        { error: { kind: "processing", message: "Valid session required." } },
        401,
      );
    }

    const job = await getEnhancementJob({
      sessionId: session.id,
      jobId: c.req.param("jobId"),
    });

    if (!job) {
      return c.notFound();
    }

    c.header("Cache-Control", "no-store");

    if (job.status === "queued" || job.status === "running") {
      return c.json({
        jobId: job.id,
        status: job.status,
      }, 200);
    }

    if (job.status === "failed") {
      return c.json({
        jobId: job.id,
        status: job.status,
        error: {
          kind: job.errorKind ?? "processing",
          message: job.errorMessage ?? PROCESSING_FAILURE_MESSAGE,
        },
      }, 200);
    }

    if (!job.outputId) {
      return c.json({
        jobId: job.id,
        status: "failed",
        error: {
          kind: "processing",
          message: PROCESSING_FAILURE_MESSAGE,
        },
      }, 200);
    }

    const output = await getStoredOutputById({
      outputId: job.outputId,
      sessionId: session.id,
    });

    if (!output) {
      return c.json({
        jobId: job.id,
        status: "failed",
        error: {
          kind: "processing",
          message: PROCESSING_FAILURE_MESSAGE,
        },
      }, 200);
    }

    return c.json({
      filename: output.filename,
      mimeType: output.mimeType,
      processedUrl: buildStoredOutputUrl({
        outputId: output.id,
        sessionId: session.id,
        signingSecret: config.sessionSecret,
        urlTtlSeconds: config.outputUrlTtlSeconds,
      }),
      processorLabel: getCustomerProcessorLabel(job.presetId),
    }, 200);
  });

  router.get("/outputs/:outputId", async (c) => {
    const session = c.get("session");

    if (!session) {
      return c.json(
        { error: { kind: "processing", message: "Valid session required." } },
        401,
      );
    }

    const outputId = c.req.param("outputId");
    const expires = Number(c.req.query("expires"));
    const signature = c.req.query("sig");

    if (!outputId || !Number.isFinite(expires) || !signature) {
      return c.notFound();
    }

    const record = await resolveStoredOutput({
      outputId,
      sessionId: session.id,
      expiresAt: expires,
      signature,
      signingSecret: config.sessionSecret,
    });

    if (!record) {
      return c.notFound();
    }

    const bytes = await readStoredOutput(record);
    return c.newResponse(new Uint8Array(bytes), 200, {
      "Cache-Control": "private, max-age=300",
      "Content-Type": record.mimeType,
      "Content-Disposition": `inline; filename="${record.filename}"`,
      "X-Content-Type-Options": "nosniff",
    });
  });

  router.post("/enhance", async (c) => {
    const requestId = c.get("requestId");
    const clientIp = c.get("clientIp");
    const session = c.get("session");
    const boundaryRejection = rejectStateChangingRequestBoundary(c, config);

    if (boundaryRejection) {
      return boundaryRejection;
    }

    if (!session) {
      return c.json(
        { error: { kind: "processing", message: "Valid session required." } },
        401,
      );
    }

    if (c.req.header("x-session-id") !== session.id) {
      return c.json(
        { error: { kind: "processing", message: "Session header mismatch." } },
        401,
      );
    }

    const ipRateLimit = consumeRateLimit(
      `enhance-ip:${clientIp}`,
      config.enhanceRateLimitMax,
      config.rateLimitWindowMs,
    );
    const sessionRateLimit = consumeRateLimit(
      `enhance-session:${session.id}`,
      config.enhanceRateLimitMax,
      config.rateLimitWindowMs,
    );

    if (!ipRateLimit || !sessionRateLimit) {
      logEvent("warn", "rate_limit.rejected", {
        requestId,
        clientIp,
        sessionId: session.id,
        route: "enhance",
        ipLimited: !ipRateLimit,
        sessionLimited: !sessionRateLimit,
      });
      return c.json(
        { error: { kind: "processing", message: "Too many enhancement requests. Try again shortly." } },
        429,
      );
    }

    applyRateLimitHeaders(
      c,
      Math.min(ipRateLimit.remaining, sessionRateLimit.remaining),
      Math.max(ipRateLimit.resetAt, sessionRateLimit.resetAt),
    );

    let parsedInput;
    const contentType = c.req.header("content-type") ?? "";

    try {
      if (contentType.includes("multipart/form-data")) {
        const formData = await c.req.formData();
        const parsed = await parseMultipartEnhanceBody(formData);
        parsedInput = "kind" in parsed
          ? parsed
          : await inspectUploadedImage(parsed);
      } else {
        let body: unknown;

        try {
          body = await c.req.json();
        } catch {
          return c.json(
            { error: { kind: "validation", message: "Invalid JSON body." } },
            400,
          );
        }

        const parsed = parseJsonEnhanceBody(body);
        parsedInput = "kind" in parsed
          ? parsed
          : await inspectUploadedImage({
              presetId: parsed.presetId,
              imageBuffer: parsed.imageBuffer,
              declaredMimeType: parsed.declaredMimeType,
              userGoal: parsed.userGoal,
            });
      }
    } catch (error) {
      const response = toPublicErrorResponse(error);
      return c.json(response.body, response.status);
    }

    if ("kind" in parsedInput) {
      return c.json({ error: parsedInput }, 400);
    }

    if (config.processor === "fal") {
      let reservedSessionId: string | null = null;
      let inputObjectKey: string | null = null;

      try {
        const reservedSession = await reserveSessionCredit(
          session.id,
          requestId,
          `preset:${parsedInput.presetId}`,
        );

        if (!reservedSession) {
          return c.json(
            { error: { kind: "processing", message: "No credits remaining for this session." } },
            402,
          );
        }

        reservedSessionId = reservedSession.id;
        inputObjectKey = await persistJobInput({
          filename: parsedInput.originalFilename,
          bytes: parsedInput.imageBuffer,
        });

        const job = await createEnhancementJob({
          sessionId: reservedSession.id,
          presetId: parsedInput.presetId,
          requestId,
          inputObjectKey,
          inputMimeType: parsedInput.mimeType,
          inputFilename: parsedInput.originalFilename,
          userGoal: parsedInput.userGoal,
          consistencyScopeKey: buildDefaultConsistencyScope({
            sessionId: reservedSession.id,
            presetId: parsedInput.presetId,
          }),
        });

        if (!job) {
          if (inputObjectKey) {
            await deleteStoredObject(inputObjectKey);
          }
          await refundSessionCredit(reservedSession.id, requestId, "job_rejected_active_job");
          return c.json(
            { error: { kind: "processing", message: "Only one enhancement can run at a time per session." } },
            409,
          );
        }

        c.header("X-Credits-Remaining", String(reservedSession.creditsRemaining));
        c.header("Cache-Control", "no-store");

        kickJobWorker(config);

        logEvent("info", "enhance.job_queued", {
          requestId,
          jobId: job.id,
          sessionId: reservedSession.id,
          clientIp,
          presetId: parsedInput.presetId,
        });

        return c.json(buildAcceptedJobResponse(job.id), 202);
      } catch (err) {
        if (inputObjectKey) {
          await deleteStoredObject(inputObjectKey);
        }
        if (reservedSessionId) {
          await refundSessionCredit(
            reservedSessionId,
            requestId,
            "processing_failed",
          );
        }

        logError("enhance.failed", err, {
          requestId,
          sessionId: session.id,
          clientIp,
        });

        const response = toPublicErrorResponse(err);
        return c.json(response.body, response.status);
      }
    }

    const lockAcquired = acquireSessionProcessingLock(
      session.id,
      requestId,
      config.sessionLockTtlMs,
    );

    if (!lockAcquired) {
      return c.json(
        { error: { kind: "processing", message: "Only one enhancement can run at a time per session." } },
        409,
      );
    }

    let reservedSessionId: string | null = null;

    try {
      const reservedSession = await reserveSessionCredit(
        session.id,
        requestId,
        `preset:${parsedInput.presetId}`,
      );

      if (!reservedSession) {
        return c.json(
          { error: { kind: "processing", message: "No credits remaining for this session." } },
          402,
        );
      }

      reservedSessionId = reservedSession.id;

      const orchestrated = await orchestrateEnhancement({
        imageBuffer: parsedInput.imageBuffer,
        originalMimeType: parsedInput.mimeType,
        presetId: parsedInput.presetId,
        config,
        requestId,
        userGoal: parsedInput.userGoal,
      });
      const storedOutput = await storeOutput({
        bytes: orchestrated.outputBuffer,
        sessionId: reservedSession.id,
        filename: orchestrated.result.filename,
        mimeType: orchestrated.result.mimeType,
        requestId,
        signingSecret: config.sessionSecret,
        urlTtlSeconds: config.outputUrlTtlSeconds,
      });

      c.header("X-Credits-Remaining", String(reservedSession.creditsRemaining));
      c.header("Cache-Control", "no-store");

      logEvent("info", "enhance.completed", {
        requestId,
        sessionId: reservedSession.id,
        clientIp,
        presetId: parsedInput.presetId,
        outputId: storedOutput.outputId,
        mimeType: orchestrated.result.mimeType,
        creditsRemaining: reservedSession.creditsRemaining,
        orchestration: {
          strategy: orchestrated.metadata.plan.strategy,
          attemptedStrategies: orchestrated.metadata.attemptedStrategies,
          finalPath: orchestrated.metadata.finalPath,
          verification: {
            status: orchestrated.metadata.verification.status,
            reasons: orchestrated.metadata.verification.reasons,
          },
          telemetry: orchestrated.metadata.telemetry,
        },
      });

      return c.json(
        {
          ...orchestrated.result,
          processedUrl: storedOutput.processedUrl,
        },
        200,
      );
    } catch (err) {
      if (reservedSessionId) {
        await refundSessionCredit(
          reservedSessionId,
          requestId,
          "processing_failed",
        );
      }

      logError("enhance.failed", err, {
        requestId,
        sessionId: session.id,
        clientIp,
      });

      const response = toPublicErrorResponse(err);
      return c.json(response.body, response.status);
    } finally {
      releaseSessionProcessingLock(session.id, requestId);
    }
  });

  return router;
}
