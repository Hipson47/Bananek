import type { EnhancementPreset, PresetId } from "./types.js";

export const PRESETS: EnhancementPreset[] = [
  {
    id: "clean-background",
    name: "Clean Background",
    description:
      "Lift the product onto a crisp white backdrop with softer edges and a clean catalog look.",
  },
  {
    id: "marketplace-ready",
    name: "Marketplace Ready",
    description:
      "Square up the frame, boost contrast, and add a neutral shelf-ready presentation.",
  },
  {
    id: "studio-polish",
    name: "Studio Polish",
    description:
      "Add subtle depth, balanced tone, and a premium editorial finish for flagship listings.",
  },
];

const PRESET_MAP = new Map(PRESETS.map((p) => [p.id, p]));

export function getPreset(id: PresetId): EnhancementPreset | undefined {
  return PRESET_MAP.get(id);
}

export function isValidPresetId(value: unknown): value is PresetId {
  return typeof value === "string" && PRESET_MAP.has(value as PresetId);
}
