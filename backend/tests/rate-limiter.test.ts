import { afterEach, describe, expect, it } from "vitest";

import { clearRateLimits, cleanupExpiredRateLimits, consumeRateLimit } from "../src/security/rate-limiter.js";
import { closeDatabase, configureDatabase, getDatabase, resetDatabaseForTests } from "../src/storage/database.js";

afterEach(() => {
  clearRateLimits();
  closeDatabase();
  resetDatabaseForTests();
});

describe("rate limiter", () => {
  it("does not delete unrelated expired buckets inline on the hot path", () => {
    configureDatabase("backend/data/test-runtime.sqlite");

    consumeRateLimit("expired-bucket", 1, -1);
    consumeRateLimit("active-bucket", 5, 60_000);
    const result = consumeRateLimit("new-bucket", 5, 60_000);
    const countBeforeCleanup = getDatabase().prepare(
      "SELECT COUNT(*) as count FROM rate_limits",
    ).get() as { count: number };

    expect(result).not.toBeNull();
    expect(countBeforeCleanup.count).toBe(3);
    expect(cleanupExpiredRateLimits(Date.now())).toBeGreaterThanOrEqual(1);
  });

  it("resets an expired bucket correctly without requiring inline cleanup", async () => {
    configureDatabase("backend/data/test-runtime.sqlite");

    const first = consumeRateLimit("bucket", 2, 1);
    expect(first?.remaining).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 5));

    const second = consumeRateLimit("bucket", 2, 60_000);
    expect(second?.remaining).toBe(1);
  });
});
