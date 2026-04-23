import { ensureLocalDevSecret } from "./runtime-paths.js";
import { parseTrustedProxyRules } from "./security/request-trust.js";

/**
 * Load a required environment variable. Throws at startup if the variable is
 * missing or blank so misconfigurations surface immediately instead of causing
 * cryptic runtime failures.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

/**
 * Load an optional environment variable with a fallback default.
 */
function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name]?.trim() || defaultValue;
}

function optionalNumberEnv(name: string, defaultValue: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${name} value: "${rawValue}". Must be a number.`);
  }

  return parsed;
}

export type AppConfig = {
  port: number;
  allowedOrigins: string[];
  allowedHosts: string[];
  trustedProxyRanges: string[];
  processor: "sharp" | "mock" | "fal";
  processorFailurePolicy: "strict" | "fallback-to-sharp";
  databasePath: string;
  objectStoragePath: string;
  sessionSecret: string;
  sessionCookieName: string;
  defaultSessionCredits: number;
  rateLimitWindowMs: number;
  enhanceRateLimitMax: number;
  sessionBootstrapRateLimitMax: number;
  outputUrlTtlSeconds: number;
  sessionLockTtlMs: number;
  jobPollIntervalMs: number;
  jobRetentionSeconds: number;
  shutdownDrainTimeoutMs: number;
  falAllowedHostSuffixes: string[];
  openRouterApiKey: string | null;
  openRouterBaseUrl: string;
  openRouterTimeoutMs: number;
  openRouterMaxRetries: number;
  openRouterModelDefault: string;
  openRouterModelIntent: string;
  openRouterModelShotPlanner: string;
  openRouterModelConsistency: string;
  openRouterModelPromptBuilder: string;
  openRouterModelVerification: string;
};

function isProductionLikeEnvironment(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();

  return nodeEnv === "production"
    || appEnv === "production"
    || appEnv === "staging";
}

function validateSessionSecret(secret: string): string {
  const trimmed = secret.trim();
  const lowered = trimmed.toLowerCase();
  const uniqueCharacters = new Set(trimmed).size;

  if (trimmed.length < 32) {
    throw new Error("APP_SESSION_SECRET must be at least 32 characters long.");
  }

  if (
    lowered.includes("change-me")
    || lowered.includes("example")
    || lowered === "test-secret"
  ) {
    throw new Error("APP_SESSION_SECRET uses a placeholder value. Set a real secret.");
  }

  if (uniqueCharacters < 10) {
    throw new Error("APP_SESSION_SECRET is too weak. Use a high-entropy secret.");
  }

  return trimmed;
}

export function readConfig(): AppConfig {
  const rawPort = parseInt(optionalEnv("PORT", "3001"), 10);
  if (isNaN(rawPort) || rawPort < 1 || rawPort > 65535) {
    throw new Error(`Invalid PORT value: "${process.env.PORT}". Must be a number between 1 and 65535.`);
  }

  const rawProcessor = optionalEnv("PROCESSOR", "sharp");
  if (rawProcessor !== "mock" && rawProcessor !== "sharp" && rawProcessor !== "fal") {
    throw new Error(
      `Invalid PROCESSOR value: "${rawProcessor}". Must be "sharp", "mock", or "fal".`,
    );
  }

  const rawProcessorFailurePolicy = optionalEnv("PROCESSOR_FAILURE_POLICY", "strict");
  if (rawProcessorFailurePolicy !== "strict" && rawProcessorFailurePolicy !== "fallback-to-sharp") {
    throw new Error(
      `Invalid PROCESSOR_FAILURE_POLICY value: "${rawProcessorFailurePolicy}". Must be "strict" or "fallback-to-sharp".`,
    );
  }

  const rawAllowedOrigins = optionalEnv("ALLOWED_ORIGINS", "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const rawAllowedHosts = optionalEnv("ALLOWED_HOSTS", "localhost:3001,127.0.0.1:3001")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  const rawTrustedProxyRanges = optionalEnv("TRUSTED_PROXY_RANGES", "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  parseTrustedProxyRules(rawTrustedProxyRanges);

  const rawSessionSecret = process.env.APP_SESSION_SECRET?.trim();
  const allowGeneratedDevSecret = process.env.ALLOW_GENERATED_DEV_SESSION_SECRET?.trim().toLowerCase() === "true";

  if (isProductionLikeEnvironment() && !rawSessionSecret) {
    throw new Error("Missing required environment variable: APP_SESSION_SECRET");
  }

  if (!rawSessionSecret && process.env.NODE_ENV !== "test" && !allowGeneratedDevSecret) {
    throw new Error(
      "Missing APP_SESSION_SECRET. Set it explicitly or enable ALLOW_GENERATED_DEV_SESSION_SECRET=true for local development only.",
    );
  }

  const sessionSecret = validateSessionSecret(
    rawSessionSecret
      || ensureLocalDevSecret(optionalEnv("LOCAL_DEV_SESSION_SECRET_PATH", "backend/data/dev-session-secret.txt")),
  );

  const rawFalAllowedHostSuffixes = optionalEnv("FAL_ALLOWED_HOST_SUFFIXES", "fal.media")
    .split(",")
    .map((value) => value.trim().replace(/^\*\./, ""))
    .filter(Boolean);
  const rawOpenRouterApiKey = process.env.OPENROUTER_API_KEY?.trim() || null;
  const openRouterModelDefault = optionalEnv("OPENROUTER_MODEL_DEFAULT", "openai/gpt-4.1-mini");

  return {
    port: rawPort,
    allowedOrigins: rawAllowedOrigins,
    allowedHosts: rawAllowedHosts,
    trustedProxyRanges: rawTrustedProxyRanges,
    processor: rawProcessor as "sharp" | "mock" | "fal",
    processorFailurePolicy: rawProcessorFailurePolicy as "strict" | "fallback-to-sharp",
    databasePath: optionalEnv("DATABASE_PATH", "backend/data/app.sqlite"),
    objectStoragePath: optionalEnv("OBJECT_STORAGE_PATH", "backend/data/object-store"),
    sessionSecret,
    sessionCookieName: optionalEnv("SESSION_COOKIE_NAME", "enhancer_session"),
    defaultSessionCredits: optionalNumberEnv("DEFAULT_SESSION_CREDITS", 3),
    rateLimitWindowMs: optionalNumberEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    enhanceRateLimitMax: optionalNumberEnv("ENHANCE_RATE_LIMIT_MAX", 10),
    sessionBootstrapRateLimitMax: optionalNumberEnv("SESSION_BOOTSTRAP_RATE_LIMIT_MAX", 30),
    outputUrlTtlSeconds: optionalNumberEnv("OUTPUT_URL_TTL_SECONDS", 3_600),
    sessionLockTtlMs: optionalNumberEnv("SESSION_LOCK_TTL_MS", 120_000),
    jobPollIntervalMs: optionalNumberEnv("JOB_POLL_INTERVAL_MS", 250),
    jobRetentionSeconds: optionalNumberEnv("JOB_RETENTION_SECONDS", 86_400),
    shutdownDrainTimeoutMs: optionalNumberEnv("SHUTDOWN_DRAIN_TIMEOUT_MS", 30_000),
    falAllowedHostSuffixes: rawFalAllowedHostSuffixes,
    openRouterApiKey: rawOpenRouterApiKey,
    openRouterBaseUrl: optionalEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    openRouterTimeoutMs: optionalNumberEnv("OPENROUTER_TIMEOUT_MS", 12_000),
    openRouterMaxRetries: optionalNumberEnv("OPENROUTER_MAX_RETRIES", 1),
    openRouterModelDefault,
    openRouterModelIntent: optionalEnv("OPENROUTER_MODEL_INTENT", openRouterModelDefault),
    openRouterModelShotPlanner: optionalEnv("OPENROUTER_MODEL_SHOT_PLANNER", openRouterModelDefault),
    openRouterModelConsistency: optionalEnv("OPENROUTER_MODEL_CONSISTENCY", openRouterModelDefault),
    openRouterModelPromptBuilder: optionalEnv("OPENROUTER_MODEL_PROMPT_BUILDER", openRouterModelDefault),
    openRouterModelVerification: optionalEnv("OPENROUTER_MODEL_VERIFICATION", openRouterModelDefault),
  };
}

let activeConfig = readConfig();

export function getConfig(): AppConfig {
  return activeConfig;
}

export function setActiveConfig(nextConfig: AppConfig): AppConfig {
  activeConfig = nextConfig;
  return activeConfig;
}

export function refreshConfigFromEnv(): AppConfig {
  activeConfig = readConfig();
  return activeConfig;
}

// Export requireEnv / optionalEnv so processors and routes can use the same
// pattern when they need their own env vars.
export { requireEnv, optionalEnv };
