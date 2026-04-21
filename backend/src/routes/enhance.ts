import { Hono } from "hono";
import type { Context } from "hono";

import type { AppEnv } from "../app-env.js";
import { readConfig } from "../config.js";
import {
  inspectUploadedImage,
  isAppError,
  parseJsonEnhanceBody,
  parseMultipartEnhanceBody,
} from "../image-validation.js";
import { processImage } from "../processors/index.js";
import { consumeRateLimit } from "../security/rate-limiter.js";
import {
  consumeSessionCredit,
  createSession,
  touchSession,
} from "../storage/session-store.js";
import {
  readStoredOutput,
  resolveStoredOutput,
  storeOutput,
} from "../storage/output-store.js";
import { logError, logEvent } from "../utils/log.js";
import { signValue } from "../utils/signing.js";

const router = new Hono<AppEnv>();
const PROCESSING_FAILURE_MESSAGE =
  "We couldn't complete this enhancement. Try again or use a different product image.";
const IN_FLIGHT_SESSIONS = new Set<string>();

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

function toPublicErrorResponse(err: unknown): { status: 400 | 500; body: { error: { kind: "validation" | "processing"; message: string } } } {
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

function decodeProcessedDataUrl(dataUrl: string, expectedMimeType: string): Buffer {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match || match[1] !== expectedMimeType) {
    throw {
      kind: "processing" as const,
      message: "Processor returned an invalid asset payload.",
    };
  }

  return Buffer.from(match[2], "base64");
}

function applyRateLimitHeaders(c: Context<AppEnv>, remaining: number, resetAt: number): void {
  c.header("X-RateLimit-Remaining", String(remaining));
  c.header("X-RateLimit-Reset", String(resetAt));
}

router.get("/health", (c) => c.json({ status: "ok" }));

router.get("/session", async (c) => {
  const config = readConfig();
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
  const config = readConfig();
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
  const config = readConfig();
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

  if (session.creditsRemaining <= 0) {
    return c.json(
      { error: { kind: "processing", message: "No credits remaining for this session." } },
      402,
    );
  }

  if (IN_FLIGHT_SESSIONS.has(session.id)) {
    return c.json(
      { error: { kind: "processing", message: "Only one enhancement can run at a time per session." } },
      409,
    );
  }

  IN_FLIGHT_SESSIONS.add(session.id);

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
          });
    }

    if ("kind" in parsedInput) {
      return c.json({ error: parsedInput }, 400);
    }

    const processed = await processImage(
      parsedInput.imageBuffer,
      parsedInput.mimeType,
      parsedInput.presetId,
    );

    const outputBytes = decodeProcessedDataUrl(
      processed.processedUrl,
      processed.mimeType,
    );
    const storedOutput = await storeOutput({
      bytes: outputBytes,
      sessionId: session.id,
      filename: processed.filename,
      mimeType: processed.mimeType,
      requestId,
      signingSecret: config.sessionSecret,
      urlTtlSeconds: config.outputUrlTtlSeconds,
    });
    const nextSession = await consumeSessionCredit(
      session,
      requestId,
      `preset:${parsedInput.presetId}`,
    );

    c.header("X-Credits-Remaining", String(nextSession.creditsRemaining));
    c.header("Cache-Control", "no-store");

    logEvent("info", "enhance.completed", {
      requestId,
      sessionId: session.id,
      clientIp,
      presetId: parsedInput.presetId,
      outputId: storedOutput.outputId,
      mimeType: processed.mimeType,
      creditsRemaining: nextSession.creditsRemaining,
    });

    return c.json(
      {
        ...processed,
        processedUrl: storedOutput.processedUrl,
      },
      200,
    );
  } catch (err) {
    logError("enhance.failed", err, {
      requestId,
      sessionId: session.id,
      clientIp,
    });

    const response = toPublicErrorResponse(err);
    return c.json(response.body, response.status);
  } finally {
    IN_FLIGHT_SESSIONS.delete(session.id);
  }
});

export { router as enhanceRouter };
