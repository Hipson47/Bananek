import { rmSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { readConfig } from "../src/config.js";
import { resolveBackendRuntimePath } from "../src/runtime-paths.js";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, ORIGINAL_ENV);
}

afterEach(() => {
  rmSync(resolveBackendRuntimePath("backend/data/test-dev-secret.txt"), { force: true });
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

  it("rejects weak placeholder secrets", () => {
    process.env.NODE_ENV = "development";
    process.env.APP_SESSION_SECRET = "change-me-before-production";

    expect(() => readConfig()).toThrow(/placeholder/i);
  });

  it("accepts generated local secrets only when explicitly enabled outside tests", () => {
    process.env.NODE_ENV = "development";
    delete process.env.APP_SESSION_SECRET;
    process.env.ALLOW_GENERATED_DEV_SESSION_SECRET = "true";
    process.env.LOCAL_DEV_SESSION_SECRET_PATH = "backend/data/test-dev-secret.txt";

    const config = readConfig();

    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });
});
