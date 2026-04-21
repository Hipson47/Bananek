import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { signValue, unsignValue } from "../utils/signing.js";

type OutputRecord = {
  id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  requestId: string;
  storagePath: string;
};

type StoredOutput = {
  outputId: string;
  processedUrl: string;
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getOutputsDir(): string {
  return path.resolve(process.cwd(), "backend/data/outputs");
}

function getOutputPath(outputId: string, mimeType: string): string {
  const extension = MIME_TO_EXTENSION[mimeType] ?? "bin";
  return path.join(getOutputsDir(), `${outputId}.${extension}`);
}

function getMetadataPath(outputId: string): string {
  return path.join(getOutputsDir(), `${outputId}.json`);
}

async function ensureStorage(): Promise<void> {
  await mkdir(getOutputsDir(), { recursive: true });
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
  const outputId = randomUUID();
  const storagePath = getOutputPath(outputId, args.mimeType);
  const record: OutputRecord = {
    id: outputId,
    sessionId: args.sessionId,
    filename: args.filename,
    mimeType: args.mimeType,
    createdAt: new Date().toISOString(),
    requestId: args.requestId,
    storagePath,
  };

  await ensureStorage();
  await writeFile(storagePath, args.bytes);
  await writeFile(getMetadataPath(outputId), JSON.stringify(record, null, 2), "utf-8");

  const expiresAt = Math.floor(Date.now() / 1000) + args.urlTtlSeconds;
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

  try {
    const raw = await readFile(getMetadataPath(args.outputId), "utf-8");
    const record = JSON.parse(raw) as OutputRecord;
    if (record.sessionId !== args.sessionId) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export async function readStoredOutput(record: OutputRecord): Promise<Buffer> {
  return readFile(record.storagePath);
}
