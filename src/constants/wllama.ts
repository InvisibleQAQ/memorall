import {
	getQuickDownloadModels,
	getSupportedModels,
} from "@/services/llm/registry/model-registry";

export const RECOMMENDATION_WALLAMA_LLMS = getSupportedModels("wllama").map(
	(model) => model.id,
);

export const QUICK_WALLAMA_LLMS = getQuickDownloadModels("wllama")
	.filter((model) => !!model.wllamaConfig?.filename)
	.map((model) => ({
		repo: model.id,
		filename: model.wllamaConfig!.filename,
		size: model.sizeLabel,
		description: model.description,
	}));
