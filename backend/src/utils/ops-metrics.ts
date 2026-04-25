/**
 * Ops-grade counters and helpers that wrap the structured logger so operators
 * get consistent event names for abuse, job lifecycle, and processor health.
 *
 * Counters are kept in-process and exposed via `snapshotOpsCounters` so they
 * can be scraped by an internal readiness/metrics endpoint or flushed on
 * shutdown. The counter store is intentionally lightweight — it is not a
 * replacement for a real metrics pipeline, but it guarantees that every
 * ops-relevant log event is also reflected in a stable counter that tests
 * and humans can assert against.
 */

import { logError, logEvent } from "./log.js";

type CounterStore = Record<string, number>;

/**
 * Stable event names used by the ops dashboard. Keep these immutable — renaming
 * them will break alerts and dashboards.
 */
export const OPS_EVENTS = {
  // Abuse / rejected requests
  RATE_LIMIT_REJECTED: "abuse.rate_limit_rejected",
  HOST_REJECTED: "abuse.host_rejected",
  ORIGIN_REJECTED: "abuse.origin_rejected",
  SESSION_LOCK_CONTENDED: "abuse.session_lock_contended",

  // Job lifecycle
  JOB_QUEUED: "job.lifecycle.queued",
  JOB_CLAIMED: "job.lifecycle.claimed",
  JOB_COMPLETED: "job.lifecycle.completed",
  JOB_FAILED: "job.lifecycle.failed",
  JOB_REQUEUED: "job.lifecycle.requeued",

  // Drain / shutdown
  WORKER_SHUTDOWN_STARTED: "worker.shutdown_started",
  WORKER_SHUTDOWN_COMPLETED: "worker.shutdown_completed",
  WORKER_SHUTDOWN_TIMED_OUT: "worker.shutdown_timed_out",

  // Verification / orchestration outcomes
  VERIFICATION_FAILED: "orchestration.verification_failed",
  VERIFICATION_PASSED: "orchestration.verification_passed",
  ORCHESTRATION_FALLBACK: "orchestration.fallback_triggered",
  ORCHESTRATION_RETRY: "orchestration.retry",
  ORCHESTRATION_REPLAN: "orchestration.replan",

  // Processor health
  PROCESSOR_FAILED: "processor.failed",
  PROCESSOR_FALLBACK: "processor.fallback_used",
} as const;

export type OpsEventName = typeof OPS_EVENTS[keyof typeof OPS_EVENTS];

const counters: CounterStore = Object.create(null);

function increment(key: string, amount = 1): void {
  counters[key] = (counters[key] ?? 0) + amount;
}

/**
 * Record an abuse-class event. These should always be `warn` level so operators
 * can watch for spikes without drowning in info logs.
 */
export function recordAbuseEvent(
  event: typeof OPS_EVENTS[
    | "RATE_LIMIT_REJECTED"
    | "HOST_REJECTED"
    | "ORIGIN_REJECTED"
    | "SESSION_LOCK_CONTENDED"
  ],
  fields: Record<string, unknown> = {},
): void {
  increment(event);
  logEvent("warn", event, fields);
}

/**
 * Record a job lifecycle transition. These are info-level; failures use
 * `recordJobFailure` so error details flow through the right channel.
 */
export function recordJobLifecycle(
  event: typeof OPS_EVENTS[
    | "JOB_QUEUED"
    | "JOB_CLAIMED"
    | "JOB_COMPLETED"
    | "JOB_REQUEUED"
  ],
  fields: Record<string, unknown> = {},
): void {
  increment(event);
  logEvent("info", event, fields);
}

export function recordJobFailure(
  error: unknown,
  fields: Record<string, unknown> = {},
): void {
  increment(OPS_EVENTS.JOB_FAILED);
  logError(OPS_EVENTS.JOB_FAILED, error, fields);
}

export function recordWorkerShutdownEvent(
  event: typeof OPS_EVENTS[
    | "WORKER_SHUTDOWN_STARTED"
    | "WORKER_SHUTDOWN_COMPLETED"
    | "WORKER_SHUTDOWN_TIMED_OUT"
  ],
  fields: Record<string, unknown> = {},
): void {
  increment(event);
  logEvent(
    event === OPS_EVENTS.WORKER_SHUTDOWN_TIMED_OUT ? "warn" : "info",
    event,
    fields,
  );
}

export function recordVerificationOutcome(
  outcome: "passed" | "failed",
  fields: Record<string, unknown> = {},
): void {
  const event = outcome === "passed"
    ? OPS_EVENTS.VERIFICATION_PASSED
    : OPS_EVENTS.VERIFICATION_FAILED;
  increment(event);
  logEvent(outcome === "passed" ? "info" : "warn", event, fields);
}

export function recordOrchestrationCounter(
  event: typeof OPS_EVENTS[
    | "ORCHESTRATION_FALLBACK"
    | "ORCHESTRATION_RETRY"
    | "ORCHESTRATION_REPLAN"
  ],
  fields: Record<string, unknown> = {},
): void {
  increment(event);
  logEvent("info", event, fields);
}

export function recordProcessorEvent(
  event: typeof OPS_EVENTS["PROCESSOR_FAILED" | "PROCESSOR_FALLBACK"],
  fields: Record<string, unknown> = {},
): void {
  increment(event);
  logEvent(event === OPS_EVENTS.PROCESSOR_FAILED ? "warn" : "info", event, fields);
}

/**
 * Return a defensive copy of the current counter store. The counters are
 * monotonic within a process; callers that want deltas should diff against
 * a previous snapshot.
 */
export function snapshotOpsCounters(): CounterStore {
  return { ...counters };
}

/**
 * Reset counters — only intended for tests. Production code should treat the
 * counters as append-only.
 */
export function resetOpsCountersForTests(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
}
