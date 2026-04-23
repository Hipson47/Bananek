import { cleanupExpiredOutputs } from "./output-store.js";
import { cleanupExpiredSessionProcessingLocks } from "../security/session-locks.js";
import { getDatabase } from "./database.js";
import { logError } from "../utils/log.js";
import { cleanupExpiredJobs } from "../jobs/job-store.js";
import { getConfig } from "../config.js";

let maintenanceTimer: NodeJS.Timeout | null = null;

export async function cleanupExpiredRuntimeState(
  nowMs = Date.now(),
): Promise<void> {
  await cleanupExpiredOutputs(Math.floor(nowMs / 1000));
  await cleanupExpiredJobs(getConfig().jobRetentionSeconds, Math.floor(nowMs / 1000));
  cleanupExpiredSessionProcessingLocks(nowMs);
  getDatabase().prepare("DELETE FROM rate_limits WHERE reset_at <= ?").run(nowMs);
}

export function startRuntimeMaintenanceLoop(intervalMs = 60_000): void {
  if (maintenanceTimer) {
    return;
  }

  maintenanceTimer = setInterval(() => {
    void cleanupExpiredRuntimeState().catch((error) => {
      logError("runtime_maintenance.failed", error, {
        intervalMs,
      });
    });
  }, intervalMs);

  maintenanceTimer.unref?.();
}

export function stopRuntimeMaintenanceLoop(): void {
  if (!maintenanceTimer) {
    return;
  }

  clearInterval(maintenanceTimer);
  maintenanceTimer = null;
}
