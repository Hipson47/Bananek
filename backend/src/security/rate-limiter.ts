import { getDatabase } from "../storage/database.js";

type RateLimitResult = {
  remaining: number;
  resetAt: number;
};

type RateLimitRow = {
  count: number;
  reset_at: number;
};

export function consumeRateLimit(
  bucket: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult | null {
  const db = getDatabase();
  const now = Date.now();

  const result = db.transaction(() => {
    const row = db.prepare(
      "SELECT count, reset_at FROM rate_limits WHERE bucket = ?",
    ).get(bucket) as RateLimitRow | undefined;

    if (!row || row.reset_at <= now) {
      const resetAt = now + windowMs;
      db.prepare(`
        INSERT INTO rate_limits (bucket, count, reset_at)
        VALUES (?, ?, ?)
        ON CONFLICT(bucket) DO UPDATE SET
          count = excluded.count,
          reset_at = excluded.reset_at
      `).run(bucket, 1, resetAt);

      return {
        remaining: Math.max(0, maxRequests - 1),
        resetAt,
      };
    }

    if (row.count >= maxRequests) {
      return null;
    }

    const nextCount = row.count + 1;
    db.prepare(
      "UPDATE rate_limits SET count = ?, reset_at = ? WHERE bucket = ?",
    ).run(nextCount, row.reset_at, bucket);

    return {
      remaining: Math.max(0, maxRequests - nextCount),
      resetAt: row.reset_at,
    };
  })();

  return result;
}

export function clearRateLimits(): void {
  const db = getDatabase();
  db.prepare("DELETE FROM rate_limits").run();
}

export function cleanupExpiredRateLimits(nowMs = Date.now()): number {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").run(nowMs);
  return result.changes;
}
