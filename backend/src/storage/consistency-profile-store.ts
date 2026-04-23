import type { PresetId } from "../types.js";
import { getDatabase } from "./database.js";
import type { ConsistencyMemory } from "../orchestration/types.js";

type ConsistencyProfileRow = {
  scope_key: string;
  session_id: string;
  preset_id: PresetId;
  memory_json: string;
  updated_at: string;
  last_job_id: string | null;
  last_request_id: string | null;
};

export type ConsistencyProfile = {
  scopeKey: string;
  sessionId: string;
  presetId: PresetId;
  memory: ConsistencyMemory;
  updatedAt: string;
  lastJobId: string | null;
  lastRequestId: string | null;
};

export function buildDefaultConsistencyScope(args: {
  sessionId: string;
  presetId: PresetId;
}): string {
  return `session:${args.sessionId}:preset:${args.presetId}`;
}

function mapRow(row: ConsistencyProfileRow): ConsistencyProfile {
  return {
    scopeKey: row.scope_key,
    sessionId: row.session_id,
    presetId: row.preset_id,
    memory: JSON.parse(row.memory_json) as ConsistencyMemory,
    updatedAt: row.updated_at,
    lastJobId: row.last_job_id,
    lastRequestId: row.last_request_id,
  };
}

export async function getConsistencyProfile(scopeKey: string): Promise<ConsistencyProfile | null> {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      scope_key,
      session_id,
      preset_id,
      memory_json,
      updated_at,
      last_job_id,
      last_request_id
    FROM consistency_profiles
    WHERE scope_key = ?
  `).get(scopeKey) as ConsistencyProfileRow | undefined;

  return row ? mapRow(row) : null;
}

export async function upsertConsistencyProfile(args: {
  scopeKey: string;
  sessionId: string;
  presetId: PresetId;
  memory: ConsistencyMemory;
  jobId?: string | null;
  requestId?: string | null;
}): Promise<ConsistencyProfile> {
  const db = getDatabase();
  const updatedAt = new Date().toISOString();
  const memoryJson = JSON.stringify(args.memory);

  db.prepare(`
    INSERT INTO consistency_profiles (
      scope_key,
      session_id,
      preset_id,
      memory_json,
      updated_at,
      last_job_id,
      last_request_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scope_key) DO UPDATE SET
      memory_json = excluded.memory_json,
      updated_at = excluded.updated_at,
      last_job_id = excluded.last_job_id,
      last_request_id = excluded.last_request_id
  `).run(
    args.scopeKey,
    args.sessionId,
    args.presetId,
    memoryJson,
    updatedAt,
    args.jobId ?? null,
    args.requestId ?? null,
  );

  return {
    scopeKey: args.scopeKey,
    sessionId: args.sessionId,
    presetId: args.presetId,
    memory: args.memory,
    updatedAt,
    lastJobId: args.jobId ?? null,
    lastRequestId: args.requestId ?? null,
  };
}
