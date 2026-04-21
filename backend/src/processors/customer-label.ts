import type { PresetId } from "../types.js";

const CUSTOMER_PROCESSOR_LABELS: Record<PresetId, string> = {
  "clean-background": "Clean Background enhancement",
  "marketplace-ready": "Marketplace Ready enhancement",
  "studio-polish": "Studio Polish enhancement",
};

export function getCustomerProcessorLabel(presetId: PresetId): string {
  return CUSTOMER_PROCESSOR_LABELS[presetId];
}
