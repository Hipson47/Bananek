import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { getConfig } from "../config.js";
import { resolveBackendRuntimePath } from "../runtime-paths.js";

type Migration = {
  version: number;
  name: string;
  up(database: Database.Database): void;
};

type LegacyOutputRow = {
  id: string;
  session_id: string;
  filename: string;
  mime_type: string;
  created_at: string;
  request_id: string;
  expires_at: number;
  payload: Buffer;
};

let database: Database.Database | null = null;
let databasePath: string | null = null;

function configuredObjectStoragePath(): string {
  return resolveBackendRuntimePath(getConfig().objectStoragePath);
}

function ensureObjectStorageRoot(): string {
  const storagePath = configuredObjectStoragePath();
  mkdirSync(storagePath, { recursive: true });
  return storagePath;
}

function writeMigratedOutputObject(outputId: string, payload: Buffer): string {
  const storageRoot = ensureObjectStorageRoot();
  const relativeKey = path.posix.join("outputs", `${outputId}.bin`);
  const absolutePath = path.join(storageRoot, relativeKey);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, payload);
  return relativeKey;
}

function migrateOutputsToObjectStorage(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(outputs)").all() as Array<{ name: string }>;
  const hasPayload = columns.some((column) => column.name === "payload");

  if (!hasPayload) {
    return;
  }

  const legacyOutputs = db.prepare(`
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
  `).all() as LegacyOutputRow[];

  db.exec(`
    CREATE TABLE IF NOT EXISTS outputs_next (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      request_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      storage_backend TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  const insertNext = db.prepare(`
    INSERT INTO outputs_next (
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
  `);

  for (const output of legacyOutputs) {
    const storageKey = writeMigratedOutputObject(output.id, output.payload);
    insertNext.run(
      output.id,
      output.session_id,
      output.filename,
      output.mime_type,
      output.created_at,
      output.request_id,
      output.expires_at,
      "fs",
      storageKey,
    );
  }

  db.exec(`
    DROP TABLE outputs;
    ALTER TABLE outputs_next RENAME TO outputs;

    CREATE INDEX IF NOT EXISTS idx_outputs_session_id
      ON outputs(session_id);

    CREATE INDEX IF NOT EXISTS idx_outputs_expires_at
      ON outputs(expires_at);
  `);
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial-runtime-core",
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0),
          credits_used INTEGER NOT NULL CHECK (credits_used >= 0)
        );

        CREATE TABLE IF NOT EXISTS usage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event TEXT NOT NULL,
          session_id TEXT NOT NULL,
          request_id TEXT,
          detail TEXT,
          timestamp TEXT NOT NULL,
          credits_remaining INTEGER NOT NULL,
          credits_used INTEGER NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_usage_events_session_id
          ON usage_events(session_id);

        CREATE TABLE IF NOT EXISTS outputs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          created_at TEXT NOT NULL,
          request_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          payload BLOB NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_outputs_session_id
          ON outputs(session_id);

        CREATE INDEX IF NOT EXISTS idx_outputs_expires_at
          ON outputs(expires_at);

        CREATE TABLE IF NOT EXISTS rate_limits (
          bucket TEXT PRIMARY KEY,
          count INTEGER NOT NULL CHECK (count >= 0),
          reset_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
          ON rate_limits(reset_at);

        CREATE TABLE IF NOT EXISTS session_processing_locks (
          session_id TEXT PRIMARY KEY,
          request_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_session_processing_locks_expires_at
          ON session_processing_locks(expires_at);
      `);
    },
  },
  {
    version: 2,
    name: "async-jobs-and-object-storage",
    up(database) {
      migrateOutputsToObjectStorage(database);

      database.exec(`
        CREATE TABLE IF NOT EXISTS enhancement_jobs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          preset_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
          input_object_key TEXT NOT NULL,
          input_mime_type TEXT NOT NULL,
          input_filename TEXT NOT NULL,
          user_goal TEXT,
          consistency_scope_key TEXT NOT NULL,
          output_id TEXT,
          error_kind TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          replan_count INTEGER NOT NULL DEFAULT 0,
          fallback_count INTEGER NOT NULL DEFAULT 0,
          final_outcome_class TEXT,
          verification_status TEXT,
          verification_score REAL,
          processor_path TEXT,
          telemetry_summary TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (output_id) REFERENCES outputs(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_enhancement_jobs_session_id
          ON enhancement_jobs(session_id);

        CREATE INDEX IF NOT EXISTS idx_enhancement_jobs_status_created_at
          ON enhancement_jobs(status, created_at);

        CREATE UNIQUE INDEX IF NOT EXISTS idx_enhancement_jobs_active_session
          ON enhancement_jobs(session_id)
          WHERE status IN ('queued', 'running');

        CREATE TABLE IF NOT EXISTS consistency_profiles (
          scope_key TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          preset_id TEXT NOT NULL,
          memory_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_job_id TEXT,
          last_request_id TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (last_job_id) REFERENCES enhancement_jobs(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_consistency_profiles_session_id
          ON consistency_profiles(session_id);

        CREATE TABLE IF NOT EXISTS job_node_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id TEXT NOT NULL,
          request_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          preset_id TEXT NOT NULL,
          node_name TEXT NOT NULL,
          outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed', 'skipped')),
          latency_ms INTEGER NOT NULL,
          attempts INTEGER,
          source TEXT,
          model TEXT,
          detail TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (job_id) REFERENCES enhancement_jobs(id) ON DELETE CASCADE,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_job_node_metrics_job_id
          ON job_node_metrics(job_id);

        CREATE INDEX IF NOT EXISTS idx_job_node_metrics_node_name_outcome
          ON job_node_metrics(node_name, outcome);
      `);
    },
  },
];

export function configureDatabase(targetPath: string): string {
  const resolvedPath = resolveBackendRuntimePath(targetPath);

  if (databasePath && databasePath !== resolvedPath) {
    closeDatabase();
  }

  databasePath = resolvedPath;
  return resolvedPath;
}

function getConfiguredDatabasePath(): string {
  if (databasePath) {
    return databasePath;
  }

  return configureDatabase(getConfig().databasePath);
}

function openDatabase(targetPath: string): Database.Database {
  mkdirSync(path.dirname(targetPath), { recursive: true });

  const db = new Database(targetPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedVersions = new Set<number>(
    db.prepare("SELECT version FROM schema_migrations").all().map((row: unknown) => {
      const migration = row as { version: number };
      return migration.version;
    }),
  );

  const applyMigration = db.transaction((migration: Migration) => {
    migration.up(db);
    db.prepare(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
    ).run(migration.version, migration.name, new Date().toISOString());
  });

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      applyMigration(migration);
    }
  }
}

export function getDatabase(): Database.Database {
  const configuredPath = getConfiguredDatabasePath();

  if (!database || databasePath !== configuredPath) {
    database?.close();
    database = openDatabase(configuredPath);
    databasePath = configuredPath;
  }

  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = null;
  databasePath = null;
}

export function resetDatabaseForTests(): void {
  const configuredPath = getConfiguredDatabasePath();
  closeDatabase();
  rmSync(configuredPath, { force: true });
  rmSync(`${configuredPath}-shm`, { force: true });
  rmSync(`${configuredPath}-wal`, { force: true });
  rmSync(configuredObjectStoragePath(), { recursive: true, force: true });
}
