import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { getCookie } from "hono/cookie";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import type { AppEnv } from "./app-env.js";
import { readConfig } from "./config.js";
import { enhanceRouter } from "./routes/enhance.js";
import { getSession } from "./storage/session-store.js";
import { logError, logEvent } from "./utils/log.js";
import { unsignValue } from "./utils/signing.js";

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function createApp() {
  const config = readConfig();
  const app = new Hono<AppEnv>();

  app.use(
    "/api/*",
    cors({
      origin: config.allowedOrigins,
      credentials: true,
      allowHeaders: ["Content-Type", "X-Session-Id"],
      exposeHeaders: ["X-Request-Id", "X-Credits-Remaining", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    }),
  );

  app.use("/api/*", bodyLimit({ maxSize: 20 * 1024 * 1024 }));

  app.use("/api/*", async (c, next) => {
    const requestId = randomUUID();
    const startedAt = Date.now();

    c.set("requestId", requestId);
    c.set("clientIp", getClientIp(c.req.raw));
    c.set("session", null);
    c.header("X-Request-Id", requestId);

    const signedSessionId = getCookie(c, config.sessionCookieName);
    if (signedSessionId) {
      const sessionId = unsignValue(signedSessionId, config.sessionSecret);
      if (sessionId) {
        const session = await getSession(sessionId);
        if (session) {
          c.set("session", session);
        }
      }
    }

    try {
      await next();
    } catch (error) {
      logError("request.unhandled", error, {
        requestId,
        path: new URL(c.req.url).pathname,
        method: c.req.method,
      });
      throw error;
    } finally {
      logEvent("info", "request.completed", {
        requestId,
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        status: c.res.status,
        durationMs: Date.now() - startedAt,
        sessionId: c.get("session")?.id ?? null,
        clientIp: c.get("clientIp"),
      });
    }
  });

  app.route("/api", enhanceRouter);

  return app;
}

const app = createApp();

const currentFilePath = fileURLToPath(import.meta.url);
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (entryFilePath === currentFilePath) {
  const config = readConfig();
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    logEvent("info", "server.started", {
      port: info.port,
      processor: config.processor,
      processorFailurePolicy: config.processorFailurePolicy,
    });
  });
}

export { app };
