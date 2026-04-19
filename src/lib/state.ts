import { getModelOption, modelOptions } from "./modelRegistry";
import type { PlaygroundAction, PlaygroundState, ProviderName } from "./types";

const LEGACY_API_KEY = "nano-banana-playground.api-key";
const providerStorageKey = (provider: ProviderName) =>
  `nano-banana-playground.api-key.${provider}`;

export function getStoredApiKey(provider: ProviderName): string {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(providerStorageKey(provider));
  if (stored !== null) return stored;
  // Backward compat: migrate legacy key to google slot on first read
  if (provider === "google") {
    return window.localStorage.getItem(LEGACY_API_KEY) ?? "";
  }
  return "";
}

export function persistApiKey(apiKey: string, provider: ProviderName): void {
  if (typeof window === "undefined") return;
  const key = providerStorageKey(provider);
  if (!apiKey.trim()) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, apiKey);
}

export function createInitialState(): PlaygroundState {
  const defaultModel = modelOptions[0];

  return {
    apiKey: getStoredApiKey(defaultModel.provider),
    aspectRatio: defaultModel.supportedAspectRatios[0],
    error: null,
    mode: "txt>img",
    prompt: "",
    quality: defaultModel.supportedQualities[0],
    references: [],
    resolution: defaultModel.supportedResolutions[0],
    result: null,
    selectedModel: defaultModel.id,
    status: "idle",
  };
}

const deriveStatus = (state: PlaygroundState) => {
  if (state.result) {
    return "success";
  }

  if (state.prompt.trim().length > 0 || state.references.length > 0) {
    return "ready";
  }

  return "idle";
};

export function playgroundReducer(
  state: PlaygroundState,
  action: PlaygroundAction,
): PlaygroundState {
  switch (action.type) {
    case "sync_state":
      return action.payload;
    case "add_references": {
      const nextState = {
        ...state,
        error: null,
        references: [...state.references, ...action.payload],
      };
      return { ...nextState, status: deriveStatus(nextState) };
    }
    case "remove_reference": {
      const nextState = {
        ...state,
        error: null,
        references: state.references.filter((reference) => reference.id !== action.payload),
      };
      return { ...nextState, status: deriveStatus(nextState) };
    }
    case "generate_start":
      return {
        ...state,
        error: null,
        status: "loading",
      };
    case "generate_success":
      return {
        ...state,
        error: null,
        result: action.payload,
        status: "success",
      };
    case "set_error":
      return {
        ...state,
        error: action.payload,
        status:
          action.payload.kind === "validation"
            ? "validation_error"
            : action.payload.kind === "empty"
              ? "empty_result"
              : "provider_error",
      };
    case "reset_model_defaults": {
      const model = getModelOption(action.payload);
      const nextState = {
        ...state,
        aspectRatio: model.supportedAspectRatios[0],
        quality: model.supportedQualities[0],
        resolution: model.supportedResolutions[0],
        selectedModel: model.id,
      };
      return {
        ...nextState,
        status: deriveStatus(nextState),
      };
    }
    default:
      return state;
  }
}
