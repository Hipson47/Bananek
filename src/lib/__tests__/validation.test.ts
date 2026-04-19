import { describe, expect, it } from "vitest";
import { validatePlaygroundState } from "../validation";
import type { PlaygroundState } from "../types";

const baseState = (): PlaygroundState => ({
  apiKey: "test-key",
  aspectRatio: "auto",
  error: null,
  mode: "txt>img",
  prompt: "a cat",
  quality: "default",
  references: [],
  resolution: "default",
  result: null,
  selectedModel: "nano-banana-2-fast",
  status: "ready",
});

describe("validatePlaygroundState", () => {
  it("passes with valid state", () => {
    expect(validatePlaygroundState(baseState())).toBeNull();
  });

  it("fails when api key is empty", () => {
    const err = validatePlaygroundState({ ...baseState(), apiKey: "  " });
    expect(err?.kind).toBe("validation");
    expect(err?.message).toMatch(/api key/i);
  });

  it("fails when prompt is empty", () => {
    const err = validatePlaygroundState({ ...baseState(), prompt: "" });
    expect(err?.kind).toBe("validation");
    expect(err?.message).toMatch(/prompt/i);
  });

  it("fails img>img mode on fal-fast which has maxReferences=0", () => {
    const err = validatePlaygroundState({
      ...baseState(),
      selectedModel: "nano-banana-fal-fast",
      mode: "img>img",
    });
    expect(err?.kind).toBe("validation");
    expect(err?.message).toMatch(/does not support image-to-image/i);
  });

  it("fails img>img when no references provided", () => {
    const err = validatePlaygroundState({
      ...baseState(),
      selectedModel: "nano-banana-fal-quality",
      mode: "img>img",
      references: [],
    });
    expect(err?.kind).toBe("validation");
    expect(err?.message).toMatch(/reference image/i);
  });
});
