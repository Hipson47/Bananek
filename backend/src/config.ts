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

// Fail fast at startup if FAL_API_KEY is missing when the FAL processor is selected.
if (rawProcessor === "fal") {
  requireEnv("FAL_API_KEY");
}

export const config = {
  port: rawPort,
  allowedOrigins: optionalEnv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
  /**
   * Which image processor to use.
   *   sharp  -- real deterministic transforms via libvips (default)
   *   fal    -- AI transforms via FAL.ai (requires FAL_API_KEY)
   *   mock   -- no-op; returns original bytes unchanged; for contract-only tests
   */
  processor: rawProcessor as "sharp" | "mock" | "fal",
};

// Export requireEnv / optionalEnv so processors and routes can use the same
// pattern when they need their own env vars.
export { requireEnv, optionalEnv };
