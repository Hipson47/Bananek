import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(MODULE_DIR, "..");
const REPO_ROOT = path.resolve(BACKEND_ROOT, "..");

export function resolveBackendRuntimePath(targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return targetPath.startsWith("backend/")
    ? path.resolve(REPO_ROOT, targetPath)
    : path.resolve(BACKEND_ROOT, targetPath);
}

export function ensureLocalDevSecret(secretPath: string): string {
  const resolvedPath = resolveBackendRuntimePath(secretPath);

  try {
    const existing = readFileSync(resolvedPath, "utf8").trim();
    if (existing) {
      return existing;
    }
  } catch {
    // generate below
  }

  mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const generated = randomBytes(32).toString("hex");
  writeFileSync(resolvedPath, `${generated}\n`, { mode: 0o600 });
  return generated;
}
