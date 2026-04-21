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
    db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").run(now);

    const row = db.prepare(
      "SELECT count, reset_at FROM rate_limits WHERE bucket = ?",
    ).get(bucket) as RateLimitRow | undefined;

    if (!row) {
      const resetAt = now + windowMs;
      db.prepare(
        "INSERT INTO rate_limits (bucket, count, reset_at) VALUES (?, ?, ?)",
      ).run(bucket, 1, resetAt);

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
