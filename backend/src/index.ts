import { getConnInfo } from "@hono/node-server/conninfo";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { getCookie } from "hono/cookie";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import type { AppEnv } from "./app-env.js";
import type { AppConfig } from "./config.js";
import { refreshConfigFromEnv, setActiveConfig } from "./config.js";
import { createEnhanceRouter } from "./routes/enhance.js";
import { getSession } from "./storage/session-store.js";
import { closeDatabase, configureDatabase } from "./storage/database.js";
import { cleanupExpiredRuntimeState, startRuntimeMaintenanceLoop, stopRuntimeMaintenanceLoop } from "./storage/runtime-maintenance.js";
import { prepareJobWorkerForStartup, shutdownJobWorker, startJobWorkerLoop } from "./jobs/job-worker.js";
import { logError, logEvent } from "./utils/log.js";
import { unsignValue } from "./utils/signing.js";
import { extractClientIp, parseTrustedProxyRules } from "./security/request-trust.js";

export function createApp(explicitConfig?: AppConfig) {
  const config = explicitConfig ?? refreshConfigFromEnv();
  const trustedProxyRules = parseTrustedProxyRules(config.trustedProxyRanges);
  setActiveConfig(config);
  configureDatabase(config.databasePath);
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
    let remoteAddress: string | null = null;

    try {
      remoteAddress = getConnInfo(c).remote.address ?? null;
    } catch {
      remoteAddress = c.env.incoming?.socket.remoteAddress ?? null;
    }

    c.set("requestId", requestId);
    c.set("clientIp", extractClientIp({
      remoteAddress,
      xForwardedFor: c.req.header("x-forwarded-for") ?? null,
      xRealIp: c.req.header("x-real-ip") ?? null,
      trustedProxyRules,
    }));
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

  app.route("/api", createEnhanceRouter(config));

  return app;
}

const app = createApp();

const currentFilePath = fileURLToPath(import.meta.url);
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : "";

let shuttingDown = false;

function installGracefulShutdown(server: ServerType, config: AppConfig): void {
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logEvent("warn", "shutdown.started", {
      signal,
    });

    stopRuntimeMaintenanceLoop();
    server.close();

    try {
      const workerShutdown = await shutdownJobWorker({
        drainTimeoutMs: config.shutdownDrainTimeoutMs,
      });

      closeDatabase();

      logEvent(workerShutdown.drained ? "info" : "warn", "shutdown.completed", {
        signal,
        drained: workerShutdown.drained,
        activeJobId: workerShutdown.activeJobId,
      });
    } catch (error) {
      logError("shutdown.failed", error, {
        signal,
      });
    } finally {
      process.exit(0);
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

if (entryFilePath === currentFilePath) {
  const config = refreshConfigFromEnv();
  setActiveConfig(config);
  configureDatabase(config.databasePath);
  void cleanupExpiredRuntimeState().catch((error) => {
    logError("runtime_maintenance.startup_failed", error, {});
  });
  void prepareJobWorkerForStartup().catch((error) => {
    logError("job_worker.startup_prepare_failed", error, {});
  });
  startJobWorkerLoop(config);
  startRuntimeMaintenanceLoop();
  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    logEvent("info", "server.started", {
      port: info.port,
      processor: config.processor,
      processorFailurePolicy: config.processorFailurePolicy,
      trustedProxyRanges: config.trustedProxyRanges,
      allowedHosts: config.allowedHosts,
    });
  });
  installGracefulShutdown(server, config);
}

export { app };
