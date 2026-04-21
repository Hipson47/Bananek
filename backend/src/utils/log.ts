type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function normaliseError(error: unknown): LogFields {
  if (!(error instanceof Error)) {
    return { error };
  }

  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
  };
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function logError(
  event: string,
  error: unknown,
  fields: LogFields = {},
): void {
  logEvent("error", event, {
    ...fields,
    ...normaliseError(error),
  });
}
