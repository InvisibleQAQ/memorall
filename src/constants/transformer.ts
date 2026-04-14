import {
	getQuickDownloadModels,
	getSupportedModels,
} from "@/services/llm/registry/model-registry";

export const RECOMMENDATION_TRANSFORMER_MODELS = getSupportedModels(
	"transformer",
).map((model) => model.id);

export const QUICK_TRANSFORMER_MODELS = getQuickDownloadModels(
	"transformer",
).map((model) => ({
	model: model.id,
	size: model.sizeLabel,
	description: model.description,
}));
