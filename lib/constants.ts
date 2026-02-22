export const DEFAULT_MODEL = "openrouter/free";
export const SUPPORTED_MODELS = ["openrouter/free"] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

export const MODEL_DISPLAY_NAMES: Record<SupportedModel, string> = {
  "openrouter/free": "OpenRouter Free",
};

export const MODEL_LOGOS: Record<SupportedModel, string> = {
  "openrouter/free": "/openrouter.png",
};
