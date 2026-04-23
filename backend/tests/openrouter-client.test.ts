import { describe, expect, it, vi } from "vitest";

import { callOpenRouterStructured, OpenRouterClientError } from "../src/orchestration/openrouter-client.js";
import type { AppConfig } from "../src/config.js";

function buildConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3001,
    allowedOrigins: ["http://localhost:5173"],
    processor: "fal",
    processorFailurePolicy: "strict",
    databasePath: "backend/data/test-runtime.sqlite",
    objectStoragePath: "backend/data/test-object-store",
    sessionSecret: "test-secret",
    sessionCookieName: "enhancer_session",
    defaultSessionCredits: 3,
    rateLimitWindowMs: 60_000,
    enhanceRateLimitMax: 10,
    sessionBootstrapRateLimitMax: 30,
    outputUrlTtlSeconds: 3600,
    sessionLockTtlMs: 120_000,
    jobPollIntervalMs: 250,
    jobRetentionSeconds: 86_400,
    falAllowedHostSuffixes: ["fal.media"],
    openRouterApiKey: "test-openrouter-key",
    openRouterBaseUrl: "https://openrouter.ai/api/v1",
    openRouterTimeoutMs: 2000,
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

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("OpenRouter client", () => {
  it("maps authentication errors safely", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(401, { error: { message: "bad key" } })));

    await expect(
      callOpenRouterStructured({
        config: buildConfig(),
        nodeName: "intent-node",
        model: "openai/gpt-4.1-mini",
        schemaName: "simple",
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
        messages: [{ role: "user", content: "hello" }],
        validate: (value): value is { ok: boolean } =>
          typeof value === "object" && value !== null && "ok" in value,
      }),
    ).rejects.toMatchObject({
      name: "OpenRouterClientError",
      code: "auth",
    });
  });

  it("retries once and then fails on invalid schema output", async () => {
    const fetchMock = vi.fn(async () => response(200, {
      model: "openai/gpt-4.1-mini",
      choices: [{ message: { content: JSON.stringify({ wrong: true }) } }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callOpenRouterStructured({
        config: buildConfig({ openRouterMaxRetries: 1 }),
        nodeName: "intent-node",
        model: "openai/gpt-4.1-mini",
        schemaName: "simple",
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
        messages: [{ role: "user", content: "hello" }],
        validate: (value): value is { ok: boolean } =>
          typeof value === "object" && value !== null && "ok" in value,
      }),
    ).rejects.toBeInstanceOf(OpenRouterClientError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
