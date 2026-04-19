import type { GenerateRequest, GenerateResponse } from "./contracts";

export interface ProviderAdapter {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}
