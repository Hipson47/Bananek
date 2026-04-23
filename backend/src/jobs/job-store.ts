import { randomUUID } from "node:crypto";

import type { PresetId } from "../types.js";
import { getDatabase } from "../storage/database.js";

export type EnhancementJobStatus = "queued" | "running" | "succeeded" | "failed";

type EnhancementJobRow = {
  id: string;
  session_id: string;
  preset_id: PresetId;
  request_id: string;
  status: EnhancementJobStatus;
  input_object_key: string;
  input_mime_type: string;
  input_filename: string;
  user_goal: string | null;
  consistency_scope_key: string;
  output_id: string | null;
  error_kind: "validation" | "processing" | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  replan_count: number;
  fallback_count: number;
  final_outcome_class: string | null;
  verification_status: string | null;
  verification_score: number | null;
  processor_path: string | null;
  telemetry_summary: string | null;
};

export type EnhancementJobRecord = {
  id: string;
  sessionId: string;
  presetId: PresetId;
  requestId: string;
  status: EnhancementJobStatus;
  inputObjectKey: string;
  inputMimeType: string;
  inputFilename: string;
  userGoal: string | null;
  consistencyScopeKey: string;
  outputId: string | null;
  errorKind: "validation" | "processing" | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  replanCount: number;
  fallbackCount: number;
  finalOutcomeClass: string | null;
  verificationStatus: string | null;
  verificationScore: number | null;
  processorPath: string[] | null;
  telemetrySummary: Record<string, unknown> | null;
};

function mapJobRow(row: EnhancementJobRow): EnhancementJobRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    presetId: row.preset_id,
    requestId: row.request_id,
    status: row.status,
    inputObjectKey: row.input_object_key,
    inputMimeType: row.input_mime_type,
    inputFilename: row.input_filename,
    userGoal: row.user_goal,
    consistencyScopeKey: row.consistency_scope_key,
    outputId: row.output_id,
    errorKind: row.error_kind,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    retryCount: row.retry_count,
    replanCount: row.replan_count,
    fallbackCount: row.fallback_count,
    finalOutcomeClass: row.final_outcome_class,
    verificationStatus: row.verification_status,
    verificationScore: row.verification_score,
    processorPath: row.processor_path ? JSON.parse(row.processor_path) as string[] : null,
    telemetrySummary: row.telemetry_summary
      ? JSON.parse(row.telemetry_summary) as Record<string, unknown>
      : null,
  };
}

export async function createEnhancementJob(args: {
  sessionId: string;
  presetId: PresetId;
  requestId: string;
  inputObjectKey: string;
  inputMimeType: string;
  inputFilename: string;
  userGoal?: string | null;
  consistencyScopeKey: string;
}): Promise<EnhancementJobRecord | null> {
  const db = getDatabase();
  const jobId = randomUUID();
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO enhancement_jobs (
        id,
        session_id,
        preset_id,
        request_id,
        status,
        input_object_key,
        input_mime_type,
        input_filename,
        user_goal,
        consistency_scope_key,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      args.sessionId,
      args.presetId,
      args.requestId,
      args.inputObjectKey,
      args.inputMimeType,
      args.inputFilename,
      args.userGoal ?? null,
      args.consistencyScopeKey,
      now,
      now,
    );
  } catch (error) {
    if (error instanceof Error && /idx_enhancement_jobs_active_session/.test(error.message)) {
      return null;
    }
    throw error;
  }

  return {
    id: jobId,
    sessionId: args.sessionId,
    presetId: args.presetId,
    requestId: args.requestId,
    status: "queued",
    inputObjectKey: args.inputObjectKey,
    inputMimeType: args.inputMimeType,
    inputFilename: args.inputFilename,
    userGoal: args.userGoal ?? null,
    consistencyScopeKey: args.consistencyScopeKey,
    outputId: null,
    errorKind: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    replanCount: 0,
    fallbackCount: 0,
    finalOutcomeClass: null,
    verificationStatus: null,
    verificationScore: null,
    processorPath: null,
    telemetrySummary: null,
  };
}

export async function getEnhancementJob(args: {
  sessionId: string;
  jobId: string;
}): Promise<EnhancementJobRecord | null> {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT *
    FROM enhancement_jobs
    WHERE id = ? AND session_id = ?
  `).get(args.jobId, args.sessionId) as EnhancementJobRow | undefined;

  return row ? mapJobRow(row) : null;
}

export async function claimNextQueuedJob(): Promise<EnhancementJobRecord | null> {
  const db = getDatabase();

  const claimed = db.transaction(() => {
    const next = db.prepare(`
      SELECT *
      FROM enhancement_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `).get() as EnhancementJobRow | undefined;

    if (!next) {
      return null;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE enhancement_jobs
      SET
        status = 'running',
        updated_at = ?,
        started_at = COALESCE(started_at, ?)
      WHERE id = ? AND status = 'queued'
    `).run(now, now, next.id);

    const row = db.prepare("SELECT * FROM enhancement_jobs WHERE id = ?").get(next.id) as EnhancementJobRow;
    return mapJobRow(row);
  })();

  return claimed;
}

export async function markEnhancementJobSucceeded(args: {
  jobId: string;
  outputId: string;
  retryCount: number;
  replanCount: number;
  fallbackCount: number;
  verificationStatus: string;
  verificationScore: number;
  processorPath: string[];
  telemetrySummary: Record<string, unknown>;
  outcomeClass: string;
}): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE enhancement_jobs
    SET
      status = 'succeeded',
      output_id = ?,
      updated_at = ?,
      completed_at = ?,
      retry_count = ?,
      replan_count = ?,
      fallback_count = ?,
      verification_status = ?,
      verification_score = ?,
      processor_path = ?,
      telemetry_summary = ?,
      final_outcome_class = ?,
      error_kind = NULL,
      error_message = NULL
    WHERE id = ?
  `).run(
    args.outputId,
    now,
    now,
    args.retryCount,
    args.replanCount,
    args.fallbackCount,
    args.verificationStatus,
    args.verificationScore,
    JSON.stringify(args.processorPath),
    JSON.stringify(args.telemetrySummary),
    args.outcomeClass,
    args.jobId,
  );
}

export async function markEnhancementJobFailed(args: {
  jobId: string;
  errorKind: "validation" | "processing";
  errorMessage: string;
  retryCount: number;
  replanCount: number;
  fallbackCount: number;
  verificationStatus?: string | null;
  verificationScore?: number | null;
  processorPath?: string[] | null;
  telemetrySummary: Record<string, unknown>;
  outcomeClass: string;
}): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE enhancement_jobs
    SET
      status = 'failed',
      updated_at = ?,
      completed_at = ?,
      retry_count = ?,
      replan_count = ?,
      fallback_count = ?,
      verification_status = ?,
      verification_score = ?,
      processor_path = ?,
      telemetry_summary = ?,
      final_outcome_class = ?,
      error_kind = ?,
      error_message = ?
    WHERE id = ?
  `).run(
    now,
    now,
    args.retryCount,
    args.replanCount,
    args.fallbackCount,
    args.verificationStatus ?? null,
    args.verificationScore ?? null,
    args.processorPath ? JSON.stringify(args.processorPath) : null,
    JSON.stringify(args.telemetrySummary),
    args.outcomeClass,
    args.errorKind,
    args.errorMessage,
    args.jobId,
  );
}

export async function requeueRunningJobs(): Promise<number> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE enhancement_jobs
    SET
      status = 'queued',
      updated_at = ?,
      error_kind = NULL,
      error_message = NULL
    WHERE status = 'running'
  `).run(now);

  return result.changes;
}

export async function cleanupExpiredJobs(retentionSeconds: number, nowEpochSeconds = Math.floor(Date.now() / 1000)): Promise<number> {
  const db = getDatabase();
  const cutoff = new Date((nowEpochSeconds - retentionSeconds) * 1000).toISOString();
  const result = db.prepare(`
    DELETE FROM enhancement_jobs
    WHERE status IN ('succeeded', 'failed') AND completed_at IS NOT NULL AND completed_at < ?
  `).run(cutoff);

  return result.changes;
}
