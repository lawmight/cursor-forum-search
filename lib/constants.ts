export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";
export const SUPPORTED_MODELS = [
  "anthropic/claude-sonnet-4.5",
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

export const MODEL_DISPLAY_NAMES: Record<SupportedModel, string> = {
  "anthropic/claude-sonnet-4.5": "Claude Sonnet 4.5",
};

export const MODEL_LOGOS: Record<SupportedModel, string> = {
  "anthropic/claude-sonnet-4.5": "/claude.png",
};
