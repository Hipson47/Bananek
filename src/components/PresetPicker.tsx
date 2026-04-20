import type { EnhancementPreset } from "../features/enhancer/types";

type PresetPickerProps = {
  presets: EnhancementPreset[];
  selectedPresetId: string;
  processing: boolean;
  onSelect: (preset: EnhancementPreset) => void;
};

export function PresetPicker({
  presets,
  selectedPresetId,
  processing,
  onSelect,
}: PresetPickerProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="panel-label">Step 2</p>
          <h2>Choose enhancement task</h2>
        </div>
      </div>

      <div className="preset-grid">
        {presets.map((preset) => {
          const selected = preset.id === selectedPresetId;

          return (
            <button
              key={preset.id}
              type="button"
              className={`preset-card${selected ? " is-selected" : ""}`}
              onClick={() => onSelect(preset)}
              disabled={processing}
            >
              <span className="preset-name">{preset.name}</span>
              <span className="preset-description">{preset.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
