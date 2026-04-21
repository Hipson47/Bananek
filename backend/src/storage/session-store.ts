import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type SessionRecord = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  creditsRemaining: number;
  creditsUsed: number;
};

type UsageEvent = {
  event: string;
  sessionId: string;
  requestId?: string;
  detail?: string;
  timestamp: string;
  creditsRemaining: number;
  creditsUsed: number;
};

const SESSION_CACHE = new Map<string, SessionRecord>();

function getSessionsDir(): string {
  return path.resolve(process.cwd(), "backend/data/sessions");
}

function getUsageLogPath(): string {
  return path.resolve(process.cwd(), "backend/data/usage-events.ndjson");
}

function getSessionPath(sessionId: string): string {
  return path.join(getSessionsDir(), `${sessionId}.json`);
}

async function ensureStorage(): Promise<void> {
  await mkdir(getSessionsDir(), { recursive: true });
  await mkdir(path.dirname(getUsageLogPath()), { recursive: true });
}

async function persistSession(session: SessionRecord): Promise<void> {
  await ensureStorage();
  SESSION_CACHE.set(session.id, session);
  await writeFile(
    getSessionPath(session.id),
    JSON.stringify(session, null, 2),
    "utf-8",
  );
}

export async function appendUsageEvent(event: UsageEvent): Promise<void> {
  await ensureStorage();
  await appendFile(getUsageLogPath(), `${JSON.stringify(event)}\n`, "utf-8");
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const cached = SESSION_CACHE.get(sessionId);
  if (cached) {
    return cached;
  }

  try {
    const raw = await readFile(getSessionPath(sessionId), "utf-8");
    const parsed = JSON.parse(raw) as SessionRecord;
    SESSION_CACHE.set(sessionId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function createSession(
  initialCredits: number,
  requestId?: string,
): Promise<SessionRecord> {
  const now = new Date().toISOString();
  const session: SessionRecord = {
    id: randomUUID(),
    createdAt: now,
    lastSeenAt: now,
    creditsRemaining: initialCredits,
    creditsUsed: 0,
  };

  await persistSession(session);
  await appendUsageEvent({
    event: "session.created",
    sessionId: session.id,
    requestId,
    timestamp: now,
    creditsRemaining: session.creditsRemaining,
    creditsUsed: session.creditsUsed,
  });

  return session;
}

export async function touchSession(session: SessionRecord): Promise<SessionRecord> {
  const nextSession = {
    ...session,
    lastSeenAt: new Date().toISOString(),
  };

  await persistSession(nextSession);
  return nextSession;
}

export async function consumeSessionCredit(
  session: SessionRecord,
  requestId: string,
  detail: string,
): Promise<SessionRecord> {
  const nextSession: SessionRecord = {
    ...session,
    lastSeenAt: new Date().toISOString(),
    creditsRemaining: session.creditsRemaining - 1,
    creditsUsed: session.creditsUsed + 1,
  };

  await persistSession(nextSession);
  await appendUsageEvent({
    event: "credits.consumed",
    sessionId: session.id,
    requestId,
    detail,
    timestamp: nextSession.lastSeenAt,
    creditsRemaining: nextSession.creditsRemaining,
    creditsUsed: nextSession.creditsUsed,
  });

  return nextSession;
}
