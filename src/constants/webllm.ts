import {
	getQuickDownloadModels,
	getSupportedModels,
} from "@/services/llm/registry/model-registry";

export const RECOMMENDATION_WEBLLM_LLMS = getSupportedModels("webllm").map(
	(model) => model.id,
);

export const QUICK_WEBLLM_LLMS = getQuickDownloadModels("webllm").map(
	(model) => ({
		model: model.id,
		size: model.sizeLabel,
		description: model.description,
	}),
);
