import { describe, expect, it, vi } from "vitest";
import { createProviderAdapter } from "../createProviderAdapter";
import type { GenerateRequest } from "../contracts";
import type { ModelOption } from "../../types";

const baseModel = (provider: "google" | "fal", providerModelId = "test-model"): ModelOption => ({
  id: "nano-banana-2-fast",
  label: "Test",
  maxReferences: 4,
  preset: "test",
  provider,
  providerModelId,
  supportedAspectRatios: ["1:1"],
  supportedMimeTypes: ["image/png"],
  supportedQualities: ["default"],
  supportedResolutions: ["default"],
});

const baseRequest = (provider: "google" | "fal", modelOverrides?: Partial<ModelOption>): GenerateRequest => ({
  apiKey: "test-key",
  aspectRatio: "1:1",
  mode: "txt>img",
  model: { ...baseModel(provider), ...modelOverrides },
  prompt: "test prompt",
  quality: "default",
  references: [],
  resolution: "default",
});

describe("RoutingAdapter", () => {
  it("dispatches to google adapter for google models", async () => {
    const adapter = createProviderAdapter();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { mimeType: "image/png", data: "abc123" } },
                ],
              },
            },
          ],
        }),
    });

    const result = await adapter.generate(baseRequest("google", {
      providerModelId: "gemini-3.1-flash-image-preview",
    }));

    expect(result.imageUrl).toContain("data:image/png;base64,abc123");
    expect(result.mimeType).toBe("image/png");
  });

  it("dispatches to fal adapter for fal models", async () => {
    const adapter = createProviderAdapter();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          images: [{ url: "https://fal.media/test.jpg", content_type: "image/jpeg" }],
        }),
    });

    const result = await adapter.generate(baseRequest("fal", {
      providerModelId: "fal-ai/flux/schnell",
    }));

    expect(result.imageUrl).toBe("https://fal.media/test.jpg");
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("uses the correct auth header for fal", async () => {
    const adapter = createProviderAdapter();
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedHeaders = opts.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            images: [{ url: "https://fal.media/out.jpg", content_type: "image/jpeg" }],
          }),
      });
    });

    await adapter.generate({ ...baseRequest("fal"), apiKey: "my-fal-key" });

    expect(capturedHeaders["Authorization"]).toBe("Key my-fal-key");
  });

  it("uses the correct auth header for google", async () => {
    const adapter = createProviderAdapter();
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: RequestInit) => {
      capturedHeaders = opts.headers as Record<string, string>;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [{ inlineData: { mimeType: "image/png", data: "xyz" } }],
                },
              },
            ],
          }),
      });
    });

    await adapter.generate({
      ...baseRequest("google", { providerModelId: "gemini-model" }),
      apiKey: "my-google-key",
    });

    expect(capturedHeaders["x-goog-api-key"]).toBe("my-google-key");
  });
});
