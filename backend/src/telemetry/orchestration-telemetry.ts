import type { GraphNodeResult } from "../orchestration/types.js";
import { getDatabase } from "../storage/database.js";

export type OrchestrationNodeMetric = {
  nodeName: string;
  outcome: "succeeded" | "failed" | "skipped";
  latencyMs: number;
  attempts?: number;
  source?: string | null;
  model?: string | null;
  detail?: string | null;
};

export type OrchestrationTelemetry = {
  requestId?: string;
  jobId?: string | null;
  sessionId?: string | null;
  presetId: string;
  nodeMetrics: OrchestrationNodeMetric[];
  retryCount: number;
  replanCount: number;
  fallbackCount: number;
  verificationFailureCount: number;
  processorPath: string[];
  finalOutcomeClass: string;
};

export async function timeNode<T>(
  metrics: OrchestrationNodeMetric[],
  args: {
    nodeName: string;
    run: () => Promise<T>;
    detail?: string;
  },
): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await args.run();
    metrics.push({
      nodeName: args.nodeName,
      outcome: "succeeded",
      latencyMs: Date.now() - startedAt,
      detail: args.detail ?? null,
      ...(isGraphNodeResult(result)
        ? {
            attempts: result.attempts,
            source: result.source,
            model: result.model,
          }
        : {}),
    });
    return result;
  } catch (error) {
    metrics.push({
      nodeName: args.nodeName,
      outcome: "failed",
      latencyMs: Date.now() - startedAt,
      detail: args.detail ?? (error instanceof Error ? error.message : "unknown-error"),
    });
    throw error;
  }
}

function isGraphNodeResult(value: unknown): value is GraphNodeResult<unknown> {
  return typeof value === "object"
    && value !== null
    && "attempts" in value
    && "source" in value
    && "model" in value;
}

export async function recordOrchestrationTelemetry(args: OrchestrationTelemetry): Promise<void> {
  if (!args.jobId || !args.requestId || !args.sessionId) {
    return;
  }

  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO job_node_metrics (
      job_id,
      request_id,
      session_id,
      preset_id,
      node_name,
      outcome,
      latency_ms,
      attempts,
      source,
      model,
      detail,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  const transaction = db.transaction((nodeMetrics: OrchestrationNodeMetric[]) => {
    for (const metric of nodeMetrics) {
      insert.run(
        args.jobId,
        args.requestId,
        args.sessionId,
        args.presetId,
        metric.nodeName,
        metric.outcome,
        metric.latencyMs,
        metric.attempts ?? null,
        metric.source ?? null,
        metric.model ?? null,
        metric.detail ?? null,
        now,
      );
    }
  });

  transaction(args.nodeMetrics);
}

export function summarizeTelemetry(args: {
  nodeMetrics: OrchestrationNodeMetric[];
  retryCount: number;
  replanCount: number;
  fallbackCount: number;
  verificationFailureCount: number;
  finalOutcomeClass?: string;
}): Record<string, unknown> {
  return {
    retryCount: args.retryCount,
    replanCount: args.replanCount,
    fallbackCount: args.fallbackCount,
    verificationFailureCount: args.verificationFailureCount,
    finalOutcomeClass: args.finalOutcomeClass ?? null,
    nodeLatencies: args.nodeMetrics.map((metric) => ({
      nodeName: metric.nodeName,
      outcome: metric.outcome,
      latencyMs: metric.latencyMs,
      attempts: metric.attempts ?? null,
      source: metric.source ?? null,
      model: metric.model ?? null,
    })),
  };
}
