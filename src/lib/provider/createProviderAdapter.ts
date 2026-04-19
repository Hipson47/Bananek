import { FalAdapter } from "./falAdapter";
import { GeminiAdapter } from "./geminiAdapter";
import type { GenerateRequest, GenerateResponse } from "./contracts";
import type { ProviderAdapter } from "./providerAdapter";

const geminiAdapter = new GeminiAdapter();
const falAdapter = new FalAdapter();

class RoutingAdapter implements ProviderAdapter {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    switch (request.model.provider) {
      case "google":
        return geminiAdapter.generate(request);
      case "fal":
        return falAdapter.generate(request);
      default: {
        const exhaustive: never = request.model.provider;
        throw { kind: "provider", message: `Unknown provider: ${exhaustive}` };
      }
    }
  }
}

export function createProviderAdapter(): ProviderAdapter {
  return new RoutingAdapter();
}
