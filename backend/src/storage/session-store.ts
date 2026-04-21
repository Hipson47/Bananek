import { randomUUID } from "node:crypto";

import { getDatabase } from "./database.js";

export type SessionRecord = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  creditsRemaining: number;
  creditsUsed: number;
};

type SessionRow = {
  id: string;
  created_at: string;
  last_seen_at: string;
  credits_remaining: number;
  credits_used: number;
};

type UsageEventParams = {
  event: string;
  sessionId: string;
  requestId?: string;
  detail?: string;
  timestamp: string;
  creditsRemaining: number;
  creditsUsed: number;
};

function mapSessionRow(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    creditsRemaining: row.credits_remaining,
    creditsUsed: row.credits_used,
  };
}

function insertUsageEvent(params: UsageEventParams): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO usage_events (
      event,
      session_id,
      request_id,
      detail,
      timestamp,
      credits_remaining,
      credits_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.event,
    params.sessionId,
    params.requestId ?? null,
    params.detail ?? null,
    params.timestamp,
    params.creditsRemaining,
    params.creditsUsed,
  );
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const db = getDatabase();
  const row = db.prepare(
    "SELECT id, created_at, last_seen_at, credits_remaining, credits_used FROM sessions WHERE id = ?",
  ).get(sessionId) as SessionRow | undefined;

  return row ? mapSessionRow(row) : null;
}

export async function createSession(
  initialCredits: number,
  requestId?: string,
): Promise<SessionRecord> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = randomUUID();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO sessions (
        id,
        created_at,
        last_seen_at,
        credits_remaining,
        credits_used
      ) VALUES (?, ?, ?, ?, ?)
    `).run(id, now, now, initialCredits, 0);

    insertUsageEvent({
      event: "session.created",
      sessionId: id,
      requestId,
      timestamp: now,
      creditsRemaining: initialCredits,
      creditsUsed: 0,
    });
  })();

  return {
    id,
    createdAt: now,
    lastSeenAt: now,
    creditsRemaining: initialCredits,
    creditsUsed: 0,
  };
}

export async function touchSession(session: SessionRecord): Promise<SessionRecord> {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE sessions SET last_seen_at = ? WHERE id = ?",
  ).run(now, session.id);

  return {
    ...session,
    lastSeenAt: now,
  };
}

export async function reserveSessionCredit(
  sessionId: string,
  requestId: string,
  detail: string,
): Promise<SessionRecord | null> {
  const db = getDatabase();

  const reserved = db.transaction(() => {
    const now = new Date().toISOString();
    const update = db.prepare(`
      UPDATE sessions
      SET
        credits_remaining = credits_remaining - 1,
        credits_used = credits_used + 1,
        last_seen_at = ?
      WHERE id = ? AND credits_remaining > 0
    `).run(now, sessionId);

    if (update.changes === 0) {
      return null;
    }

    const row = db.prepare(
      "SELECT id, created_at, last_seen_at, credits_remaining, credits_used FROM sessions WHERE id = ?",
    ).get(sessionId) as SessionRow;
    const session = mapSessionRow(row);

    insertUsageEvent({
      event: "credits.consumed",
      sessionId,
      requestId,
      detail,
      timestamp: session.lastSeenAt,
      creditsRemaining: session.creditsRemaining,
      creditsUsed: session.creditsUsed,
    });

    return session;
  })();

  return reserved;
}

export async function refundSessionCredit(
  sessionId: string,
  requestId: string,
  detail: string,
): Promise<SessionRecord | null> {
  const db = getDatabase();

  const refunded = db.transaction(() => {
    const now = new Date().toISOString();
    const update = db.prepare(`
      UPDATE sessions
      SET
        credits_remaining = credits_remaining + 1,
        credits_used = CASE WHEN credits_used > 0 THEN credits_used - 1 ELSE 0 END,
        last_seen_at = ?
      WHERE id = ?
    `).run(now, sessionId);

    if (update.changes === 0) {
      return null;
    }

    const row = db.prepare(
      "SELECT id, created_at, last_seen_at, credits_remaining, credits_used FROM sessions WHERE id = ?",
    ).get(sessionId) as SessionRow;
    const session = mapSessionRow(row);

    insertUsageEvent({
      event: "credits.refunded",
      sessionId,
      requestId,
      detail,
      timestamp: session.lastSeenAt,
      creditsRemaining: session.creditsRemaining,
      creditsUsed: session.creditsUsed,
    });

    return session;
  })();

  return refunded;
}
