import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Field } from "./components/Field";
import { ReferenceList } from "./components/ReferenceList";
import { ReferenceUploader } from "./components/ReferenceUploader";
import { ResultPanel } from "./components/ResultPanel";
import { SegmentedControl } from "./components/SegmentedControl";
import { downloadImage } from "./lib/download";
import {
  ALL_ASPECT_RATIOS,
  ALL_QUALITIES,
  ALL_RESOLUTIONS,
  getModelOption,
  modelOptions,
} from "./lib/modelRegistry";
import { createProviderAdapter } from "./lib/provider/createProviderAdapter";
import {
  createGeneratedReferenceImage,
  releaseReferenceImage,
} from "./lib/referenceImages";
import { createInitialState, getStoredApiKey, persistApiKey, playgroundReducer } from "./lib/state";
import type {
  AppError,
  AspectRatioId,
  GenerationResult,
  GenerationStatus,
  PlaygroundState,
  QualityId,
  ResolutionId,
  VisibleModelId,
} from "./lib/types";
import { validatePlaygroundState } from "./lib/validation";

const providerAdapter = createProviderAdapter();

const getDerivedStatus = (
  state: PlaygroundState,
  nextError: AppError | null,
): GenerationStatus => {
  if (nextError) {
    return nextError.kind === "validation"
      ? "validation_error"
      : nextError.kind === "empty"
        ? "empty_result"
        : "provider_error";
  }

  if (state.result) {
    return "success";
  }

  if (state.prompt.trim().length > 0 || state.references.length > 0) {
    return "ready";
  }

  return "idle";
};

const syncStateForModel = (
  state: PlaygroundState,
  modelId: VisibleModelId,
): PlaygroundState => {
  const model = getModelOption(modelId);

  const nextState = {
    ...state,
    selectedModel: modelId,
    aspectRatio: model.supportedAspectRatios.includes(state.aspectRatio)
      ? state.aspectRatio
      : model.supportedAspectRatios[0],
    resolution: model.supportedResolutions.includes(state.resolution)
      ? state.resolution
      : model.supportedResolutions[0],
    quality: model.supportedQualities.includes(state.quality)
      ? state.quality
      : model.supportedQualities[0],
    error: null,
  };

  return {
    ...nextState,
    status: getDerivedStatus(nextState, null),
  };
};

function App() {
  const [state, dispatch] = useReducer(playgroundReducer, undefined, createInitialState);
  const [showApiKey, setShowApiKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const referencesRef = useRef(state.references);

  const selectedModel = useMemo(
    () => getModelOption(state.selectedModel),
    [state.selectedModel],
  );

  useEffect(() => {
    referencesRef.current = state.references;
  }, [state.references]);

  useEffect(() => {
    persistApiKey(state.apiKey, selectedModel.provider);
  }, [state.apiKey, selectedModel.provider]);

  useEffect(() => {
    return () => {
      referencesRef.current.forEach((reference) => {
        releaseReferenceImage(reference);
      });
    };
  }, []);

  const applyStatusAfterInput = (nextState: PlaygroundState) => {
    dispatch({
      type: "sync_state",
      payload: {
        ...nextState,
        status: getDerivedStatus(nextState, null),
      },
    });
  };

  const handleApiKeyChange = (apiKey: string) => {
    applyStatusAfterInput({ ...state, apiKey, error: null });
  };

  const handleModeChange = (mode: PlaygroundState["mode"]) => {
    applyStatusAfterInput({ ...state, mode, error: null });
  };

  const handleModelChange = (modelId: VisibleModelId) => {
    const newModel = getModelOption(modelId);
    const newApiKey = newModel.provider !== selectedModel.provider
      ? getStoredApiKey(newModel.provider)
      : state.apiKey;
    const nextState = syncStateForModel(state, modelId);
    applyStatusAfterInput({ ...nextState, apiKey: newApiKey });
  };

  const handlePromptChange = (prompt: string) => {
    applyStatusAfterInput({ ...state, prompt, error: null });
  };

  const handleAspectRatioChange = (aspectRatio: AspectRatioId) => {
    applyStatusAfterInput({ ...state, aspectRatio, error: null });
  };

  const handleResolutionChange = (resolution: ResolutionId) => {
    applyStatusAfterInput({ ...state, resolution, error: null });
  };

  const handleQualityChange = (quality: QualityId) => {
    applyStatusAfterInput({ ...state, quality, error: null });
  };

  const handleReferencesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const createdReferences = Array.from(files).map((file) =>
      createGeneratedReferenceImage(
        {
          imageUrl: URL.createObjectURL(file),
          mimeType: file.type || "image/png",
          filename: file.name,
          sourceModelLabel: "Uploaded reference",
          createdAt: Date.now(),
        },
        "upload",
      ),
    );

    const invalidFile = createdReferences.find(
      (reference) => !selectedModel.supportedMimeTypes.includes(reference.mimeType),
    );

    if (invalidFile) {
      createdReferences.forEach((reference) => {
        releaseReferenceImage(reference);
      });
      dispatch({
        type: "set_error",
        payload: {
          kind: "validation",
          message: `Unsupported file type. Allowed: ${selectedModel.supportedMimeTypes.join(", ")}`,
        },
      });
      return;
    }

    if (state.references.length + createdReferences.length > selectedModel.maxReferences) {
      createdReferences.forEach((reference) => {
        releaseReferenceImage(reference);
      });
      dispatch({
        type: "set_error",
        payload: {
          kind: "validation",
          message: `This model allows up to ${selectedModel.maxReferences} reference image${
            selectedModel.maxReferences === 1 ? "" : "s"
          }.`,
        },
      });
      return;
    }

    dispatch({ type: "add_references", payload: createdReferences });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleReferenceRemove = (referenceId: string) => {
    const reference = state.references.find((item) => item.id === referenceId);
    if (reference) {
      releaseReferenceImage(reference);
    }
    dispatch({ type: "remove_reference", payload: referenceId });
  };

  const handleDownload = (result: GenerationResult | null) => {
    if (!result) {
      return;
    }

    downloadImage(result.imageUrl, result.filename);
  };

  const handleUseAsReference = (result: GenerationResult | null) => {
    if (!result) {
      return;
    }

    const reference = createGeneratedReferenceImage(result, "generated");
    dispatch({ type: "add_references", payload: [reference] });
  };

  const handleGenerate = async () => {
    const validationError = validatePlaygroundState(state);

    if (validationError) {
      dispatch({ type: "set_error", payload: validationError });
      return;
    }

    dispatch({ type: "generate_start" });

    try {
      const result = await providerAdapter.generate({
        apiKey: state.apiKey.trim(),
        aspectRatio: state.aspectRatio,
        mode: state.mode,
        model: selectedModel,
        prompt: state.prompt.trim(),
        quality: state.quality,
        references: state.references,
        resolution: state.resolution,
      });

      if (!result.imageUrl) {
        dispatch({
          type: "set_error",
          payload: {
            kind: "empty",
            message: "The provider returned no output image.",
          },
        });
        return;
      }

      dispatch({ type: "generate_success", payload: result });
    } catch (error) {
      dispatch({
        type: "set_error",
        payload: isAppError(error)
          ? error
          : {
              kind: "provider",
              message: "The generation request failed.",
            },
      });
    }
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="workspace__header">
          <div>
            <p className="eyebrow">Private playground</p>
            <h1>Nano Banana Playground</h1>
          </div>
          <p className="workspace__subtitle">
            Direct request input on the left, current output on the right.
          </p>
        </header>

        <div className="playground">
          <section className="panel panel--controls">
            <div className="panel__section-heading">
              <span>Inputs</span>
            </div>
            <Field label="API key">
              <div className="api-key-row">
                <input
                  className="text-input"
                  onChange={(event) => handleApiKeyChange(event.target.value)}
                  placeholder={
                    selectedModel.provider === "fal"
                      ? "Paste FAL.AI API key"
                      : "Paste Google Gemini API key"
                  }
                  spellCheck={false}
                  type={showApiKey ? "text" : "password"}
                  value={state.apiKey}
                />
                <button
                  className="toggle-button"
                  onClick={() => setShowApiKey((current) => !current)}
                  type="button"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="field__hint">
                {selectedModel.provider === "fal" ? "FAL.AI" : "Google Gemini"} key — stored
                locally per provider. Generation is blocked until a key is present.
              </p>
            </Field>

            <Field label="Mode">
              <SegmentedControl
                name="mode"
                onChange={(value) => handleModeChange(value as PlaygroundState["mode"])}
                options={[
                  { label: "txt>img", value: "txt>img" },
                  { label: "img>img", value: "img>img" },
                ]}
                value={state.mode}
              />
            </Field>

            <Field label="Model">
              <select
                onChange={(event) =>
                  handleModelChange(event.target.value as VisibleModelId)
                }
                value={state.selectedModel}
              >
                {modelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prompt">
              <textarea
                className="prompt-textarea"
                onChange={(event) => handlePromptChange(event.target.value)}
                placeholder="Paste your raw prompt exactly as you want to test it."
                rows={8}
                value={state.prompt}
              />
            </Field>

            <Field label="Aspect ratio">
              <select
                onChange={(event) =>
                  handleAspectRatioChange(event.target.value as AspectRatioId)
                }
                value={state.aspectRatio}
              >
                {ALL_ASPECT_RATIOS.map((option) => (
                  <option
                    disabled={!selectedModel.supportedAspectRatios.includes(option.id)}
                    key={option.id}
                    value={option.id}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Resolution">
              <select
                onChange={(event) =>
                  handleResolutionChange(event.target.value as ResolutionId)
                }
                value={state.resolution}
              >
                {ALL_RESOLUTIONS.map((option) => (
                  <option
                    disabled={!selectedModel.supportedResolutions.includes(option.id)}
                    key={option.id}
                    value={option.id}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Quality">
              <select
                onChange={(event) =>
                  handleQualityChange(event.target.value as QualityId)
                }
                value={state.quality}
              >
                {ALL_QUALITIES.map((option) => (
                  <option
                    disabled={!selectedModel.supportedQualities.includes(option.id)}
                    key={option.id}
                    value={option.id}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="field__hint">
                Provider-backed only. Current adapter exposes the provider default setting.
              </p>
            </Field>

            <Field
              label={`Reference images (${state.references.length}/${selectedModel.maxReferences})`}
            >
              <ReferenceUploader
                inputRef={fileInputRef}
                onFilesSelected={handleReferencesSelected}
              />
              <ReferenceList
                onRemove={handleReferenceRemove}
                references={state.references}
              />
            </Field>

            <button
              className="generate-button"
              disabled={state.status === "loading"}
              onClick={handleGenerate}
              type="button"
            >
              {state.status === "loading" ? "Generating..." : "Generate"}
            </button>
          </section>

          <ResultPanel
            error={state.error}
            mode={state.mode}
            onDownload={() => handleDownload(state.result)}
            onUseAsReference={() => handleUseAsReference(state.result)}
            result={state.result}
            status={state.status}
          />
        </div>
      </section>
    </main>
  );
}

const isAppError = (value: unknown): value is AppError => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "kind" in value && "message" in value;
};

export default App;
