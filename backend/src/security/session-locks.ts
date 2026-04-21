import { getDatabase } from "../storage/database.js";

export function acquireSessionProcessingLock(
  sessionId: string,
  requestId: string,
  ttlMs: number,
): boolean {
  const db = getDatabase();
  const now = Date.now();
  const expiresAt = now + ttlMs;

  const acquired = db.transaction(() => {
    db.prepare(
      "DELETE FROM session_processing_locks WHERE expires_at <= ?",
    ).run(now);

    const existing = db.prepare(
      "SELECT request_id FROM session_processing_locks WHERE session_id = ?",
    ).get(sessionId) as { request_id: string } | undefined;

    if (existing) {
      return false;
    }

    db.prepare(`
      INSERT INTO session_processing_locks (
        session_id,
        request_id,
        expires_at,
        created_at
      ) VALUES (?, ?, ?, ?)
    `).run(
      sessionId,
      requestId,
      expiresAt,
      new Date(now).toISOString(),
    );

    return true;
  })();

  return acquired;
}

export function releaseSessionProcessingLock(
  sessionId: string,
  requestId: string,
): void {
  const db = getDatabase();
  db.prepare(
    "DELETE FROM session_processing_locks WHERE session_id = ? AND request_id = ?",
  ).run(sessionId, requestId);
}

export function cleanupExpiredSessionProcessingLocks(nowMs = Date.now()): number {
  const db = getDatabase();
  const result = db.prepare(
    "DELETE FROM session_processing_locks WHERE expires_at <= ?",
  ).run(nowMs);

  return result.changes;
}
