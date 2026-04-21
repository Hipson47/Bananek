export type BackendSession = {
  sessionId: string;
  creditsRemaining: number;
  creditsUsed: number;
};

let cachedSession: BackendSession | null = null;

function isBackendSession(value: unknown): value is BackendSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const session = value as Record<string, unknown>;

  return (
    typeof session.sessionId === "string" &&
    typeof session.creditsRemaining === "number" &&
    typeof session.creditsUsed === "number"
  );
}

export async function getBackendSession(forceRefresh = false): Promise<BackendSession> {
  if (!forceRefresh && cachedSession) {
    return cachedSession;
  }

  let response: Response;

  try {
    response = await fetch("/api/session", {
      method: "GET",
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Could not start a secure enhancement session.");
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message =
      errorBody?.error?.message ??
      `Session bootstrap failed (status ${response.status}).`;
    throw new Error(message);
  }

  const session = await response.json().catch(() => null);

  if (!isBackendSession(session)) {
    throw new Error("Enhancement session bootstrap returned an invalid response.");
  }

  cachedSession = session;
  return session;
}

export function syncSessionFromEnhanceResponse(response: Response): void {
  const remainingRaw = response.headers.get("X-Credits-Remaining");

  if (!cachedSession || remainingRaw === null) {
    return;
  }

  const remaining = Number(remainingRaw);

  if (!Number.isFinite(remaining)) {
    return;
  }

  cachedSession = {
    ...cachedSession,
    creditsRemaining: remaining,
    creditsUsed: cachedSession.creditsUsed + 1,
  };
}

export function clearBackendSessionCache(): void {
  cachedSession = null;
}
