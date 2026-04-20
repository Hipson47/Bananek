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

export const config = {
  port: rawPort,
  allowedOrigins: optionalEnv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
  // API keys for AI providers — uncomment and add to .env.example when real processing is added:
  // geminiApiKey: requireEnv("GEMINI_API_KEY"),
  // falApiKey: requireEnv("FAL_API_KEY"),
};

// Export requireEnv so routes/processors can use the same pattern when they
// need their own env vars (e.g. a future processor that reads OPENAI_API_KEY).
export { requireEnv, optionalEnv };
