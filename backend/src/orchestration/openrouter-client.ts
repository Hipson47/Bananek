import type { AppConfig } from "../config.js";

export type OpenRouterJsonSchema = Record<string, unknown>;

export class OpenRouterClientError extends Error {
  readonly kind = "processing" as const;

  constructor(
    readonly code:
      | "config"
      | "auth"
      | "rate_limit"
      | "timeout"
      | "network"
      | "unavailable"
      | "invalid_response"
      | "invalid_schema",
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenRouterClientError";
  }
}

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type StructuredCallArgs<T> = {
  config: AppConfig;
  nodeName: string;
  model: string;
  schemaName: string;
  schema: OpenRouterJsonSchema;
  messages: OpenRouterMessage[];
  validate(value: unknown): value is T;
};

type StructuredCallResult<T> = {
  data: T;
  model: string;
  attempts: number;
};

function mapStatusToError(status: number): OpenRouterClientError {
  if (status === 401 || status === 403) {
    return new OpenRouterClientError("auth", "OpenRouter authentication failed.", status);
  }

  if (status === 429) {
    return new OpenRouterClientError("rate_limit", "OpenRouter rate limit exceeded.", status);
  }

  if (status >= 500) {
    return new OpenRouterClientError("unavailable", "OpenRouter is temporarily unavailable.", status);
  }

  return new OpenRouterClientError("invalid_response", `OpenRouter request failed (HTTP ${status}).`, status);
}

function extractMessageContent(payload: unknown): string {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("choices" in payload) ||
    !Array.isArray((payload as { choices?: unknown[] }).choices) ||
    (payload as { choices: unknown[] }).choices.length === 0
  ) {
    throw new OpenRouterClientError("invalid_response", "OpenRouter returned an unexpected response shape.");
  }

  const choice = (payload as { choices: Array<{ message?: { content?: unknown } }> }).choices[0];
  const content = choice?.message?.content;

  if (typeof content !== "string") {
    throw new OpenRouterClientError("invalid_response", "OpenRouter returned non-text structured content.");
  }

  return content;
}

export async function callOpenRouterStructured<T>(args: StructuredCallArgs<T>): Promise<StructuredCallResult<T>> {
  const apiKey = args.config.openRouterApiKey;

  if (!apiKey) {
    throw new OpenRouterClientError("config", "OpenRouter is not configured.");
  }

  const maxAttempts = Math.max(1, args.config.openRouterMaxRetries + 1);
  let lastError: OpenRouterClientError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await globalThis.fetch(
        `${args.config.openRouterBaseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: args.model,
            messages: args.messages,
            temperature: 0,
            seed: 17,
            stream: false,
            provider: {
              require_parameters: true,
              data_collection: "deny",
            },
            plugins: [{ id: "response-healing" }],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: args.schemaName,
                strict: true,
                schema: args.schema,
              },
            },
          }),
          signal: AbortSignal.timeout(args.config.openRouterTimeoutMs),
        },
      );

      if (!response.ok) {
        throw mapStatusToError(response.status);
      }

      const body = await response.json();
      const content = extractMessageContent(body);
      let parsed: unknown;

      try {
        parsed = JSON.parse(content);
      } catch {
        throw new OpenRouterClientError("invalid_response", "OpenRouter returned invalid JSON content.");
      }

      if (!args.validate(parsed)) {
        throw new OpenRouterClientError("invalid_schema", `OpenRouter ${args.nodeName} returned invalid schema output.`);
      }

      return {
        data: parsed,
        model: typeof (body as { model?: unknown }).model === "string"
          ? (body as { model: string }).model
          : args.model,
        attempts: attempt,
      };
    } catch (error) {
      let mapped: OpenRouterClientError;

      if (error instanceof OpenRouterClientError) {
        mapped = error;
      } else if (error instanceof Error && error.name === "AbortError") {
        mapped = new OpenRouterClientError("timeout", "OpenRouter request timed out.");
      } else if (error instanceof TypeError) {
        mapped = new OpenRouterClientError("network", "OpenRouter request failed due to a network error.");
      } else {
        mapped = new OpenRouterClientError("invalid_response", "OpenRouter request failed unexpectedly.");
      }

      lastError = mapped;

      if (
        attempt >= maxAttempts ||
        (mapped.code !== "timeout"
          && mapped.code !== "network"
          && mapped.code !== "unavailable"
          && mapped.code !== "invalid_schema")
      ) {
        throw mapped;
      }
    }
  }

  throw lastError ?? new OpenRouterClientError("invalid_response", "OpenRouter request failed.");
}
