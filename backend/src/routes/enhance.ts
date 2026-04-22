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
  readStoredOutput,
  resolveStoredOutput,
  storeOutput,
} from "../storage/output-store.js";
import { logError, logEvent } from "../utils/log.js";
import { signValue } from "../utils/signing.js";

const PROCESSING_FAILURE_MESSAGE =
  "We couldn't complete this enhancement. Try again or use a different product image.";

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
      let parsedInput;
      const contentType = c.req.header("content-type") ?? "";

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

      if ("kind" in parsedInput) {
        return c.json({ error: parsedInput }, 400);
      }

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
          analysis: {
            format: orchestrated.metadata.analysis.format,
            dimensions: orchestrated.metadata.analysis.dimensions,
            readyScore: orchestrated.metadata.analysis.marketplaceSignals.readyScore,
            brightnessScore: orchestrated.metadata.analysis.quality.brightnessScore,
          },
          strategy: orchestrated.metadata.plan.strategy,
          attemptedStrategies: orchestrated.metadata.attemptedStrategies,
          finalPath: orchestrated.metadata.finalPath,
          graph: {
            intentSource: orchestrated.metadata.intent?.source ?? null,
            shotPlannerSource: orchestrated.metadata.shotPlan?.source ?? null,
            consistencySource: orchestrated.metadata.consistency?.source ?? null,
            promptBuilderSource: orchestrated.metadata.promptPackage?.source ?? null,
            verificationSource: orchestrated.metadata.verificationNode?.source ?? null,
          },
          fallbackApplied: orchestrated.metadata.fallbackApplied,
          retryApplied: orchestrated.metadata.retryApplied,
          verification: {
            status: orchestrated.metadata.verification.status,
            reasons: orchestrated.metadata.verification.reasons,
          },
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
