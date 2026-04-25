import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OPS_EVENTS,
  recordAbuseEvent,
  recordJobFailure,
  recordJobLifecycle,
  recordOrchestrationCounter,
  recordProcessorEvent,
  recordVerificationOutcome,
  recordWorkerShutdownEvent,
  resetOpsCountersForTests,
  snapshotOpsCounters,
} from "../src/utils/ops-metrics.js";

afterEach(() => {
  resetOpsCountersForTests();
  vi.restoreAllMocks();
});

describe("ops metrics", () => {
  it("increments abuse counters and emits warn-level logs", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    recordAbuseEvent(OPS_EVENTS.RATE_LIMIT_REJECTED, { clientIp: "1.2.3.4" });
    recordAbuseEvent(OPS_EVENTS.RATE_LIMIT_REJECTED, { clientIp: "1.2.3.4" });
    recordAbuseEvent(OPS_EVENTS.HOST_REJECTED, { host: "evil.example.com" });

    const counters = snapshotOpsCounters();
    expect(counters[OPS_EVENTS.RATE_LIMIT_REJECTED]).toBe(2);
    expect(counters[OPS_EVENTS.HOST_REJECTED]).toBe(1);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("increments job lifecycle counters", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    recordJobLifecycle(OPS_EVENTS.JOB_QUEUED, { jobId: "j1" });
    recordJobLifecycle(OPS_EVENTS.JOB_CLAIMED, { jobId: "j1" });
    recordJobLifecycle(OPS_EVENTS.JOB_COMPLETED, { jobId: "j1" });

    const counters = snapshotOpsCounters();
    expect(counters[OPS_EVENTS.JOB_QUEUED]).toBe(1);
    expect(counters[OPS_EVENTS.JOB_CLAIMED]).toBe(1);
    expect(counters[OPS_EVENTS.JOB_COMPLETED]).toBe(1);
  });

  it("records job failures at error level", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    recordJobFailure(new Error("boom"), { jobId: "j1" });

    const counters = snapshotOpsCounters();
    expect(counters[OPS_EVENTS.JOB_FAILED]).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0]?.[0];
    expect(typeof call).toBe("string");
    expect(call as string).toContain("errorMessage");
  });

  it("emits shutdown timed-out at warn level", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    recordWorkerShutdownEvent(OPS_EVENTS.WORKER_SHUTDOWN_STARTED, {});
    recordWorkerShutdownEvent(OPS_EVENTS.WORKER_SHUTDOWN_TIMED_OUT, {});
    recordWorkerShutdownEvent(OPS_EVENTS.WORKER_SHUTDOWN_COMPLETED, {});

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const counters = snapshotOpsCounters();
    expect(counters[OPS_EVENTS.WORKER_SHUTDOWN_STARTED]).toBe(1);
    expect(counters[OPS_EVENTS.WORKER_SHUTDOWN_TIMED_OUT]).toBe(1);
    expect(counters[OPS_EVENTS.WORKER_SHUTDOWN_COMPLETED]).toBe(1);
  });

  it("tracks verification, orchestration, and processor outcomes", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    recordVerificationOutcome("passed", { score: 0.91 });
    recordVerificationOutcome("failed", { score: 0.41 });
    recordOrchestrationCounter(OPS_EVENTS.ORCHESTRATION_FALLBACK, {});
    recordOrchestrationCounter(OPS_EVENTS.ORCHESTRATION_RETRY, {});
    recordOrchestrationCounter(OPS_EVENTS.ORCHESTRATION_REPLAN, {});
    recordProcessorEvent(OPS_EVENTS.PROCESSOR_FAILED, {});
    recordProcessorEvent(OPS_EVENTS.PROCESSOR_FALLBACK, {});

    const counters = snapshotOpsCounters();
    expect(counters[OPS_EVENTS.VERIFICATION_PASSED]).toBe(1);
    expect(counters[OPS_EVENTS.VERIFICATION_FAILED]).toBe(1);
    expect(counters[OPS_EVENTS.ORCHESTRATION_FALLBACK]).toBe(1);
    expect(counters[OPS_EVENTS.ORCHESTRATION_RETRY]).toBe(1);
    expect(counters[OPS_EVENTS.ORCHESTRATION_REPLAN]).toBe(1);
    expect(counters[OPS_EVENTS.PROCESSOR_FAILED]).toBe(1);
    expect(counters[OPS_EVENTS.PROCESSOR_FALLBACK]).toBe(1);
  });

  it("snapshot returns a defensive copy", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    recordAbuseEvent(OPS_EVENTS.RATE_LIMIT_REJECTED, {});
    const snapshot = snapshotOpsCounters();
    snapshot[OPS_EVENTS.RATE_LIMIT_REJECTED] = 999;
    expect(snapshotOpsCounters()[OPS_EVENTS.RATE_LIMIT_REJECTED]).toBe(1);
  });
});
