import { describe, expect, it, beforeEach, vi } from "vitest";
import { getStoredApiKey, persistApiKey } from "../state";

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
    },
  });
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
});

describe("getStoredApiKey", () => {
  it("returns empty string when nothing stored", () => {
    expect(getStoredApiKey("google")).toBe("");
    expect(getStoredApiKey("fal")).toBe("");
  });

  it("falls back to legacy key for google provider", () => {
    mockStorage["nano-banana-playground.api-key"] = "legacy-key";
    expect(getStoredApiKey("google")).toBe("legacy-key");
  });

  it("returns per-provider key over legacy", () => {
    mockStorage["nano-banana-playground.api-key"] = "legacy-key";
    mockStorage["nano-banana-playground.api-key.google"] = "new-key";
    expect(getStoredApiKey("google")).toBe("new-key");
  });

  it("does not fall back for fal provider", () => {
    mockStorage["nano-banana-playground.api-key"] = "legacy-key";
    expect(getStoredApiKey("fal")).toBe("");
  });
});

describe("persistApiKey", () => {
  it("stores key under provider-namespaced key", () => {
    persistApiKey("my-fal-key", "fal");
    expect(mockStorage["nano-banana-playground.api-key.fal"]).toBe("my-fal-key");
  });

  it("removes key when value is blank", () => {
    persistApiKey("key", "google");
    persistApiKey("  ", "google");
    expect(mockStorage["nano-banana-playground.api-key.google"]).toBeUndefined();
  });
});
