import { useEffect, useMemo, useRef, useState } from "react";

import { ComparisonPanel } from "./components/ComparisonPanel";
import { EmptyState } from "./components/EmptyState";
import { PresetPicker } from "./components/PresetPicker";
import { UploadPanel } from "./components/UploadPanel";
import { PRESETS } from "./features/enhancer/presets";
import { BackendProcessor } from "./features/enhancer/processors/backendProcessor";
import type {
  EnhancementPreset,
  ProcessedImageResult,
} from "./features/enhancer/types";

const processor = new BackendProcessor();

type ProcessingStatus = "idle" | "ready" | "processing" | "success" | "error";

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(
    null,
  );
  const [selectedPreset, setSelectedPreset] = useState<EnhancementPreset>(
    PRESETS[0],
  );
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessedImageResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setOriginalPreviewUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        return null;
      });
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setOriginalPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return nextPreviewUrl;
    });

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [selectedFile]);

  const helperCopy = useMemo(() => {
    if (status === "processing") {
      return "Applying the selected enhancement and rendering a commerce-ready preview.";
    }

    if (status === "success") {
      return "Processing complete. Compare the source image with the enhanced output below.";
    }

    if (status === "error") {
      return "The enhancement did not complete. Adjust the image or preset and try again.";
    }

    return "Upload a product photo, choose a preset, and generate a polished preview in one pass.";
  }, [status]);

  async function handleProcess() {
    if (!selectedFile) {
      setStatus("error");
      setErrorMessage("Upload a product image before starting enhancement.");
      return;
    }

    // Cancel any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus("processing");
    setErrorMessage(null);
    setResult(null);

    try {
      const processedResult = await processor.processImage({
        file: selectedFile,
        preset: selectedPreset,
        signal: controller.signal,
      });

      setResult(processedResult);
      setStatus("success");
    } catch (error) {
      // Ignore aborts caused by a user-triggered reset
      if (error instanceof DOMException && error.name === "AbortError") return;

      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Processing failed. Try another image and run the preset again.",
      );
    }
  }

  function handleReset() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSelectedFile(null);
    setSelectedPreset(PRESETS[0]);
    setStatus("idle");
    setErrorMessage(null);
    setResult(null);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">AI product photo enhancement</p>
          <h1>Turn rough product shots into storefront-ready images.</h1>
          <p className="hero-description">{helperCopy}</p>
        </div>
        <div className="hero-card">
          <div className="hero-stat">
            <span className="hero-stat-value">3</span>
            <span className="hero-stat-label">commerce presets</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-value">3</span>
            <span className="hero-stat-label">real enhancement paths</span>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="workspace-main">
          <UploadPanel
            file={selectedFile}
            previewUrl={originalPreviewUrl}
            processing={status === "processing"}
            onValidationError={(message) => {
              setStatus("error");
              setErrorMessage(message);
              setResult(null);
            }}
            onFileSelect={(file) => {
              setSelectedFile(file);
              setStatus(file ? "ready" : "idle");
              setErrorMessage(null);
              setResult(null);
            }}
          />

          <PresetPicker
            presets={PRESETS}
            selectedPresetId={selectedPreset.id}
            processing={status === "processing"}
            onSelect={(preset) => {
              setSelectedPreset(preset);
              if (selectedFile && status !== "processing") {
                setStatus("ready");
              }
            }}
          />

          <div className="action-bar">
            <div className="status-copy">
              <strong>Status</strong>
              <span>
                {status === "idle" && "Waiting for an image"}
                {status === "ready" && "Ready to process"}
                {status === "processing" && "Processing"}
                {status === "success" && "Result generated"}
                {status === "error" && "Needs attention"}
              </span>
            </div>

            <div className="action-group">
              <button
                className="secondary-button"
                type="button"
                onClick={handleReset}
                disabled={status === "processing"}
              >
                Reset
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={handleProcess}
                disabled={!selectedFile || status === "processing"}
              >
                {status === "processing" ? "Processing..." : "Enhance photo"}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="feedback error" role="alert">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <aside className="workspace-sidebar">
          {result && originalPreviewUrl ? (
            <ComparisonPanel
              originalUrl={originalPreviewUrl}
              result={result}
              preset={selectedPreset}
            />
          ) : (
            <EmptyState preset={selectedPreset} status={status} />
          )}
        </aside>
      </section>
    </main>
  );
}
