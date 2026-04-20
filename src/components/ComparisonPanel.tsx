import type { EnhancementPreset, ProcessedImageResult } from "../features/enhancer/types";

type ComparisonPanelProps = {
  originalUrl: string;
  result: ProcessedImageResult;
  preset: EnhancementPreset;
};

export function ComparisonPanel({
  originalUrl,
  result,
  preset,
}: ComparisonPanelProps) {
  return (
    <section className="panel result-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-label">Result</p>
          <h2>Enhanced output</h2>
        </div>
        <div className="pill">{preset.name}</div>
      </div>

      <div className="comparison-grid">
        <article className="image-card">
          <p className="image-card-label">Original</p>
          <img src={originalUrl} alt="Original uploaded product" />
        </article>

        <article className="image-card">
          <p className="image-card-label">Processed</p>
          <img src={result.processedUrl} alt="Processed product enhancement result" />
        </article>
      </div>

      <dl className="result-meta">
        <div>
          <dt>Preset</dt>
          <dd>{preset.name}</dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>{result.filename}</dd>
        </div>
        <div>
          <dt>Pipeline</dt>
          <dd>{result.processorLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
