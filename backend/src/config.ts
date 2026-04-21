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
  processor: "sharp" | "mock" | "fal";
  processorFailurePolicy: "strict" | "fallback-to-sharp";
  sessionSecret: string;
  sessionCookieName: string;
  defaultSessionCredits: number;
  rateLimitWindowMs: number;
  enhanceRateLimitMax: number;
  sessionBootstrapRateLimitMax: number;
  outputUrlTtlSeconds: number;
  falAllowedHostSuffixes: string[];
};

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

  const rawSessionSecret = process.env.APP_SESSION_SECRET?.trim();
  const defaultSessionSecret = "dev-only-session-secret-change-me";

  if (process.env.NODE_ENV === "production" && !rawSessionSecret) {
    throw new Error("Missing required environment variable: APP_SESSION_SECRET");
  }

  const rawFalAllowedHostSuffixes = optionalEnv("FAL_ALLOWED_HOST_SUFFIXES", "fal.media")
    .split(",")
    .map((value) => value.trim().replace(/^\*\./, ""))
    .filter(Boolean);

  return {
    port: rawPort,
    allowedOrigins: rawAllowedOrigins,
    processor: rawProcessor as "sharp" | "mock" | "fal",
    processorFailurePolicy: rawProcessorFailurePolicy as "strict" | "fallback-to-sharp",
    sessionSecret: rawSessionSecret || defaultSessionSecret,
    sessionCookieName: optionalEnv("SESSION_COOKIE_NAME", "enhancer_session"),
    defaultSessionCredits: optionalNumberEnv("DEFAULT_SESSION_CREDITS", 3),
    rateLimitWindowMs: optionalNumberEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    enhanceRateLimitMax: optionalNumberEnv("ENHANCE_RATE_LIMIT_MAX", 10),
    sessionBootstrapRateLimitMax: optionalNumberEnv("SESSION_BOOTSTRAP_RATE_LIMIT_MAX", 30),
    outputUrlTtlSeconds: optionalNumberEnv("OUTPUT_URL_TTL_SECONDS", 3_600),
    falAllowedHostSuffixes: rawFalAllowedHostSuffixes,
  };
}

export const config = readConfig();

// Export requireEnv / optionalEnv so processors and routes can use the same
// pattern when they need their own env vars.
export { requireEnv, optionalEnv };
