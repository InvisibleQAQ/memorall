import type { ServiceProvider } from "./interfaces/llm-service.interface";

// Shared constants for LLM services
export const DEFAULT_SERVICES = {
	WLLAMA: "wllama",
	WEBLLM: "webllm",
	TRANSFORMER: "transformer",
	OPENAI: "openai",
	OPENROUTER: "openrouter",
	LMSTUDIO: "lmstudio",
	OLLAMA: "ollama",
} as const;

// Provider to service name mapping
export const PROVIDER_TO_SERVICE: Record<ServiceProvider, string> = {
	wllama: DEFAULT_SERVICES.WLLAMA,
	webllm: DEFAULT_SERVICES.WEBLLM,
	transformer: DEFAULT_SERVICES.TRANSFORMER,
	openai: DEFAULT_SERVICES.OPENAI,
	openrouter: DEFAULT_SERVICES.OPENROUTER,
	lmstudio: DEFAULT_SERVICES.LMSTUDIO,
	ollama: DEFAULT_SERVICES.OLLAMA,
};

export const CURRENT_MODEL_KEY = "_CURRENT_MODEL_KEY_";

// Global progress event name for all LLM downloads
export const LLM_DOWNLOAD_PROGRESS_EVENT = "llm:download:progress";
