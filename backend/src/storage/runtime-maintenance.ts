import { cleanupExpiredOutputs } from "./output-store.js";
import { cleanupExpiredSessionProcessingLocks } from "../security/session-locks.js";
import { cleanupExpiredRateLimits } from "../security/rate-limiter.js";
import { logError, logEvent } from "../utils/log.js";
import { cleanupExpiredJobs } from "../jobs/job-store.js";
import { getConfig } from "../config.js";

let maintenanceTimer: NodeJS.Timeout | null = null;

export async function cleanupExpiredRuntimeState(
  nowMs = Date.now(),
): Promise<void> {
  const expiredOutputs = await cleanupExpiredOutputs(Math.floor(nowMs / 1000));
  const expiredJobs = await cleanupExpiredJobs(getConfig().jobRetentionSeconds, Math.floor(nowMs / 1000));
  const expiredLocks = cleanupExpiredSessionProcessingLocks(nowMs);
  const expiredRateLimits = cleanupExpiredRateLimits(nowMs);

  if (expiredOutputs > 0 || expiredJobs > 0 || expiredLocks > 0 || expiredRateLimits > 0) {
    logEvent("info", "runtime_maintenance.cleaned", {
      expiredOutputs,
      expiredJobs,
      expiredLocks,
      expiredRateLimits,
    });
  }
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
