import type { EnhancementPreset } from "../features/enhancer/types";

type EmptyStateProps = {
  preset: EnhancementPreset;
  status: "idle" | "ready" | "processing" | "success" | "error";
};

export function EmptyState({ preset, status }: EmptyStateProps) {
  return (
    <section className="panel empty-panel">
      <p className="panel-label">Preview</p>
      <h2>Output workspace</h2>
      <p className="empty-copy">
        {status === "processing"
          ? "The preset is running. Your processed image will appear here."
          : "Upload an image and run a preset to compare the original with the generated result."}
      </p>

      <div className="empty-card">
        <strong>Selected preset</strong>
        <span>{preset.name}</span>
        <p>{preset.description}</p>
      </div>
    </section>
  );
}
