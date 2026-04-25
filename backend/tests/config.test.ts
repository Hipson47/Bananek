import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { readConfig } from "../src/config.js";
import { resolveBackendRuntimePath } from "../src/runtime-paths.js";

const ORIGINAL_ENV = { ...process.env };
const generatedSecretPaths: string[] = [];

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, ORIGINAL_ENV);
}

function uniqueSecretPath(): string {
  const relative = `backend/data/test-dev-secret-${randomUUID()}.txt`;
  generatedSecretPaths.push(relative);
  return relative;
}

afterEach(() => {
  while (generatedSecretPaths.length > 0) {
    const relative = generatedSecretPaths.pop();
    if (!relative) continue;
    try {
      rmSync(resolveBackendRuntimePath(relative), { force: true });
    } catch {
      // Ignore cleanup failures - we generate unique paths per test.
    }
  }
  resetEnv();
});

describe("config secret policy", () => {
  it("rejects missing secrets in development unless explicit local generation is enabled", () => {
    process.env.NODE_ENV = "development";
    delete process.env.APP_SESSION_SECRET;
    delete process.env.ALLOW_GENERATED_DEV_SESSION_SECRET;

    expect(() => readConfig()).toThrow(/Missing APP_SESSION_SECRET/);
  });

  it("rejects missing secrets in production-like environments", () => {
    process.env.NODE_ENV = "production";
    delete process.env.APP_SESSION_SECRET;
    process.env.ALLOW_GENERATED_DEV_SESSION_SECRET = "true";

    expect(() => readConfig()).toThrow(/APP_SESSION_SECRET/);
  });

  it("rejects missing secrets when APP_ENV is staging even if NODE_ENV is development", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_ENV = "staging";
    delete process.env.APP_SESSION_SECRET;
    process.env.ALLOW_GENERATED_DEV_SESSION_SECRET = "true";

    expect(() => readConfig()).toThrow(/APP_SESSION_SECRET/);
  });

  it("rejects weak placeholder secrets", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_SESSION_SECRET = "change-me-before-production";

    expect(() => readConfig()).toThrow(/placeholder/i);
  });

  it("rejects short secrets", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_SESSION_SECRET = "abcdefghij";

    expect(() => readConfig()).toThrow(/32 characters/);
  });

  it("rejects low-entropy secrets", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_SESSION_SECRET = "aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb";

    expect(() => readConfig()).toThrow(/too weak/i);
  });

  it("accepts generated local secrets only when explicitly enabled outside tests", () => {
    process.env.NODE_ENV = "development";
    delete process.env.APP_SESSION_SECRET;
    process.env.ALLOW_GENERATED_DEV_SESSION_SECRET = "true";
    process.env.LOCAL_DEV_SESSION_SECRET_PATH = uniqueSecretPath();

    const config = readConfig();

    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });

  it("accepts valid strong secrets", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_SESSION_SECRET = "a9f3c2d81b4e7569abcdef0123456789f0a1b2c3";

    const config = readConfig();

    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });
});
