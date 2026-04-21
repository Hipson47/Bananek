import { cleanupExpiredOutputs } from "./output-store.js";
import { cleanupExpiredSessionProcessingLocks } from "../security/session-locks.js";
import { getDatabase } from "./database.js";

export async function cleanupExpiredRuntimeState(
  nowMs = Date.now(),
): Promise<void> {
  await cleanupExpiredOutputs(Math.floor(nowMs / 1000));
  cleanupExpiredSessionProcessingLocks(nowMs);
  getDatabase().prepare("DELETE FROM rate_limits WHERE reset_at <= ?").run(nowMs);
}
