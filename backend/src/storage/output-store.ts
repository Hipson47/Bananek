import path from "node:path";
import { randomUUID } from "node:crypto";

import { getConfig } from "../config.js";
import { getDatabase } from "./database.js";
import { deleteStoredObjects, readStoredObject, writeStoredObject } from "./object-store.js";
import { signValue, unsignValue } from "../utils/signing.js";

export type OutputRecord = {
  id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  requestId: string;
  expiresAt: number;
  storageBackend: "fs";
  storageKey: string;
};

type OutputRow = {
  id: string;
  session_id: string;
  filename: string;
  mime_type: string;
  created_at: string;
  request_id: string;
  expires_at: number;
  storage_backend: "fs";
  storage_key: string;
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
    storageBackend: row.storage_backend,
    storageKey: row.storage_key,
  };
}

function buildOutputStorageKey(outputId: string, filename: string): string {
  const extension = path.extname(filename) || ".bin";
  return path.posix.join("outputs", `${outputId}${extension}`);
}

export function buildStoredOutputUrl(args: {
  outputId: string;
  sessionId: string;
  signingSecret: string;
  urlTtlSeconds?: number;
  expiresAt?: number;
}): string {
  const expiresAt = args.expiresAt
    ?? (Math.floor(Date.now() / 1000) + (args.urlTtlSeconds ?? getConfig().outputUrlTtlSeconds));
  const signature = signValue(
    `${args.outputId}.${args.sessionId}.${expiresAt}`,
    args.signingSecret,
  );

  return `/api/outputs/${args.outputId}?expires=${expiresAt}&sig=${encodeURIComponent(signature)}`;
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
  const storageKey = buildOutputStorageKey(outputId, args.filename);

  await writeStoredObject({
    storageKey,
    bytes: args.bytes,
  });

  db.prepare(`
    INSERT INTO outputs (
      id,
      session_id,
      filename,
      mime_type,
      created_at,
      request_id,
      expires_at,
      storage_backend,
      storage_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    outputId,
    args.sessionId,
    args.filename,
    args.mimeType,
    createdAt,
    args.requestId,
    expiresAt,
    "fs",
    storageKey,
  );

  return {
    outputId,
    processedUrl: buildStoredOutputUrl({
      outputId,
      sessionId: args.sessionId,
      signingSecret: args.signingSecret,
      expiresAt,
    }),
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
      storage_backend,
      storage_key
    FROM outputs
    WHERE id = ? AND session_id = ? AND expires_at >= ?
  `).get(
    args.outputId,
    args.sessionId,
    Math.floor(Date.now() / 1000),
  ) as OutputRow | undefined;

  return row ? mapOutputRow(row) : null;
}

export async function getStoredOutputById(args: {
  outputId: string;
  sessionId: string;
}): Promise<OutputRecord | null> {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      id,
      session_id,
      filename,
      mime_type,
      created_at,
      request_id,
      expires_at,
      storage_backend,
      storage_key
    FROM outputs
    WHERE id = ? AND session_id = ?
  `).get(args.outputId, args.sessionId) as OutputRow | undefined;

  return row ? mapOutputRow(row) : null;
}

export async function readStoredOutput(record: OutputRecord): Promise<Buffer> {
  return readStoredObject(record.storageKey);
}

export async function cleanupExpiredOutputs(nowEpochSeconds = Math.floor(Date.now() / 1000)): Promise<number> {
  const db = getDatabase();
  const expiredRows = db.prepare(`
    SELECT storage_key
    FROM outputs
    WHERE expires_at < ?
  `).all(nowEpochSeconds) as Array<{ storage_key: string }>;

  if (expiredRows.length > 0) {
    await deleteStoredObjects(expiredRows.map((row) => row.storage_key));
  }

  const result = db.prepare(
    "DELETE FROM outputs WHERE expires_at < ?",
  ).run(nowEpochSeconds);

  return result.changes;
}
