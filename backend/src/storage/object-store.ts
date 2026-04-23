import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { getConfig } from "../config.js";
import { resolveBackendRuntimePath } from "../runtime-paths.js";

function getObjectStoreRoot(): string {
  return resolveBackendRuntimePath(getConfig().objectStoragePath);
}

function resolveObjectPath(storageKey: string): string {
  const root = getObjectStoreRoot();
  const absolutePath = path.resolve(root, storageKey);

  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Object storage key resolved outside the configured storage root.");
  }

  return absolutePath;
}

export async function writeStoredObject(args: {
  storageKey: string;
  bytes: Buffer;
}): Promise<void> {
  const absolutePath = resolveObjectPath(args.storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, args.bytes);
}

export async function readStoredObject(storageKey: string): Promise<Buffer> {
  return readFile(resolveObjectPath(storageKey));
}

export async function deleteStoredObject(storageKey: string): Promise<void> {
  await unlink(resolveObjectPath(storageKey)).catch(() => {});
}

export async function deleteStoredObjects(storageKeys: string[]): Promise<void> {
  await Promise.all(storageKeys.map((storageKey) => deleteStoredObject(storageKey)));
}

export async function hasStoredObject(storageKey: string): Promise<boolean> {
  try {
    await stat(resolveObjectPath(storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function resetObjectStoreForTests(): Promise<void> {
  await rm(getObjectStoreRoot(), { recursive: true, force: true });
}
