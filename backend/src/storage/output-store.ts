import { randomUUID } from "node:crypto";

import { getDatabase } from "./database.js";
import { signValue, unsignValue } from "../utils/signing.js";

type OutputRecord = {
  id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  requestId: string;
  expiresAt: number;
  payload: Buffer;
};

type OutputRow = {
  id: string;
  session_id: string;
  filename: string;
  mime_type: string;
  created_at: string;
  request_id: string;
  expires_at: number;
  payload: Buffer;
};

type StoredOutput = {
  outputId: string;
  processedUrl: string;
};

function mapOutputRow(row: OutputRow): OutputRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    filename: row.filename,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    requestId: row.request_id,
    expiresAt: row.expires_at,
    payload: row.payload,
  };
}

export async function storeOutput(args: {
  bytes: Buffer;
  sessionId: string;
  filename: string;
  mimeType: string;
  requestId: string;
  signingSecret: string;
  urlTtlSeconds: number;
}): Promise<StoredOutput> {
  const db = getDatabase();
  const outputId = randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = Math.floor(Date.now() / 1000) + args.urlTtlSeconds;

  db.prepare(`
    INSERT INTO outputs (
      id,
      session_id,
      filename,
      mime_type,
      created_at,
      request_id,
      expires_at,
      payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    outputId,
    args.sessionId,
    args.filename,
    args.mimeType,
    createdAt,
    args.requestId,
    expiresAt,
    args.bytes,
  );

  const signature = signValue(
    `${outputId}.${args.sessionId}.${expiresAt}`,
    args.signingSecret,
  );

  return {
    outputId,
    processedUrl: `/api/outputs/${outputId}?expires=${expiresAt}&sig=${encodeURIComponent(signature)}`,
  };
}

export async function resolveStoredOutput(args: {
  outputId: string;
  sessionId: string;
  expiresAt: number;
  signature: string;
  signingSecret: string;
}): Promise<OutputRecord | null> {
  const db = getDatabase();
  const rawValue = unsignValue(args.signature, args.signingSecret);

  if (!rawValue) {
    return null;
  }

  if (rawValue !== `${args.outputId}.${args.sessionId}.${args.expiresAt}`) {
    return null;
  }

  if (args.expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const row = db.prepare(`
    SELECT
      id,
      session_id,
      filename,
      mime_type,
      created_at,
      request_id,
      expires_at,
      payload
    FROM outputs
    WHERE id = ? AND session_id = ? AND expires_at >= ?
  `).get(
    args.outputId,
    args.sessionId,
    Math.floor(Date.now() / 1000),
  ) as OutputRow | undefined;

  return row ? mapOutputRow(row) : null;
}

export async function readStoredOutput(record: OutputRecord): Promise<Buffer> {
  return record.payload;
}

export async function cleanupExpiredOutputs(nowEpochSeconds = Math.floor(Date.now() / 1000)): Promise<number> {
  const db = getDatabase();
  const result = db.prepare(
    "DELETE FROM outputs WHERE expires_at < ?",
  ).run(nowEpochSeconds);

  return result.changes;
}
