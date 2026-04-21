import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { readConfig } from "../config.js";

type Migration = {
  version: number;
  name: string;
  up(database: Database.Database): void;
};

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
];

let database: Database.Database | null = null;
let databasePath: string | null = null;

function getConfiguredDatabasePath(): string {
  return path.resolve(process.cwd(), readConfig().databasePath);
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
}
