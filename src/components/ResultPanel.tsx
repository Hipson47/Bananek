import type {
  AppError,
  GenerationMode,
  GenerationResult,
  GenerationStatus,
} from "../lib/types";

type ResultPanelProps = {
  error: AppError | null;
  mode: GenerationMode;
  onDownload: () => void;
  onUseAsReference: () => void;
  result: GenerationResult | null;
  status: GenerationStatus;
};

export function ResultPanel({
  error,
  mode,
  onDownload,
  onUseAsReference,
  result,
  status,
}: ResultPanelProps) {
  return (
    <section className="panel panel--result">
      <div className="result-panel__topline">
        <div>
          <p className="eyebrow">Result</p>
          <h2>Output</h2>
        </div>
        <div className="result-status">
          <span className="result-status__mode">
            {mode === "txt>img" ? "txt>img" : "img>img"}
          </span>
          <span className="result-status__state">{formatStatus(status, error)}</span>
        </div>
      </div>

      {error ? (
        <div className="result-inline-error" role="alert">
          {error.message}
        </div>
      ) : null}

      <div className="result-panel__stage">
        {status === "loading" ? (
          <div className="stage-card stage-card--loading">
            <div className="spinner" aria-hidden="true" />
            <p>Generating image...</p>
          </div>
        ) : null}

        {status !== "loading" && error ? (
          <div className="stage-card stage-card--error">
            <p className="stage-card__title">Generation failed</p>
            <p>{error.message}</p>
          </div>
        ) : null}

        {status !== "loading" && !error && result ? (
          <div className="stage-image">
            <img alt="Generated result" src={result.imageUrl} />
          </div>
        ) : null}

        {status !== "loading" && !error && !result ? (
          <div className="stage-card">
            <p className="stage-card__title">No result yet</p>
            <p>
              Generate an image from the left panel. The current output will appear
              here.
            </p>
          </div>
        ) : null}
      </div>

      <div className="result-actions">
        <button
          className="secondary-button"
          disabled={!result}
          onClick={onDownload}
          type="button"
        >
          Download
        </button>
        <button
          className="secondary-button"
          disabled={!result}
          onClick={onUseAsReference}
          type="button"
        >
          Use as reference
        </button>
      </div>
    </section>
  );
}

function formatStatus(status: GenerationStatus, error: AppError | null) {
  if (status === "loading") {
    return "Generating";
  }

  if (error) {
    return "Error";
  }

  if (status === "success") {
    return "Ready";
  }

  return "Idle";
}
