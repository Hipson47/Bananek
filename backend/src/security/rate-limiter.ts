type RateLimitResult = {
  remaining: number;
  resetAt: number;
};

type FixedWindowState = {
  count: number;
  resetAt: number;
};

const WINDOW_STATE = new Map<string, FixedWindowState>();

function pruneExpired(now: number): void {
  for (const [key, value] of WINDOW_STATE) {
    if (value.resetAt <= now) {
      WINDOW_STATE.delete(key);
    }
  }
}

export function consumeRateLimit(
  bucket: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult | null {
  const now = Date.now();
  pruneExpired(now);

  const current = WINDOW_STATE.get(bucket);

  if (!current || current.resetAt <= now) {
    WINDOW_STATE.set(bucket, { count: 1, resetAt: now + windowMs });
    return { remaining: Math.max(0, maxRequests - 1), resetAt: now + windowMs };
  }

  if (current.count >= maxRequests) {
    return null;
  }

  current.count += 1;
  WINDOW_STATE.set(bucket, current);

  return {
    remaining: Math.max(0, maxRequests - current.count),
    resetAt: current.resetAt,
  };
}

export function clearRateLimits(): void {
  WINDOW_STATE.clear();
}
