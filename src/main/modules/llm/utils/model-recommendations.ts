import type {
	SystemSpecs,
	ModelRecommendation,
	RecommendationSet,
	ModelPreference,
} from "../types/system-specs";
import { getAvailableModelMemoryGB, estimateModelMemory } from "./model-memory";
import {
	ALL_MODELS,
	getModelRunProfile,
} from "@/services/llm/registry/model-registry";
import {
	PROVIDER_NAMES,
	type LLMModelConfig,
	type LLMProvider,
} from "@/services/llm/interfaces/llm-model-config";

const PROVIDER_INFO: Record<
	LLMProvider,
	{ speedMultiplier: number; requiresWebGPU: boolean; note: string }
> = {
	transformer: {
		requiresWebGPU: true,
		speedMultiplier: 1.4,
		note: "ONNX models with WebGPU acceleration",
	},
	webllm: {
		requiresWebGPU: true,
		speedMultiplier: 1.5,
		note: "Highly optimized WebGPU models",
	},
	wllama: {
		requiresWebGPU: false,
		speedMultiplier: 1.0,
		note: "CPU-based, works everywhere",
	},
};

/**
 * Generates model recommendations based on system specs and user preference.
 * Returns top N models sorted by score.
 */
export function generateRecommendations(
	specs: SystemSpecs,
	preference: ModelPreference,
	limit: number = 4,
): ModelRecommendation[] {
	const compatibleModels = ALL_MODELS.filter((model) => {
		if (model.unsupported) {
			return false;
		}

		if (model.requiresWebGPU && !specs.hasWebGPU) {
			return false;
		}

		if (model.minMemoryGB > specs.memoryGB) {
			return false;
		}

		const availableGB = getAvailableModelMemoryGB(specs, model.requiresWebGPU);
		const minEstimate = estimateModelMemory(
			model.sizeGB,
			model.kvBytesPerToken,
			4096,
			availableGB,
		);
		return minEstimate.totalGB <= availableGB;
	});

	if (compatibleModels.length === 0) {
		return [];
	}

	const scoredModels = compatibleModels.map((model) => {
		let score = 0;

		switch (preference) {
			case "performance":
				score = model.performanceScore * 2;
				break;
			case "quality":
				score = model.qualityScore * 2;
				break;
			case "context":
				score = model.contextScore * 2;
				break;
		}

		const [year, month] = model.releaseDate.split("-").map(Number);
		const monthsSince2024 = (year - 2024) * 12 + month;
		score += monthsSince2024 * 0.8;

		if (specs.hasWebGPU && model.requiresWebGPU) {
			score += 10;
		}

		if (specs.hasWebGPU) {
			if (model.provider === "webllm") {
				score += 5;
			} else if (model.provider === "transformer") {
				score += 3;
			}
		}

		if (specs.deviceCategory === "ultra" || specs.deviceCategory === "high") {
			score += model.sizeGB > 1.0 ? 5 : 0;
		} else if (specs.deviceCategory === "low") {
			score += model.sizeGB < 0.5 ? 8 : 0;
		}

		if (model.displayName.includes("Ministral 3B")) {
			score += 6;
		}
		if (model.displayName.includes("SmolLM3")) {
			score += 5;
		}
		if (model.displayName.includes("LFM2")) {
			score += 4;
		}
		if (model.displayName.includes("Qwen 3")) {
			score += 5;
		}
		if (model.displayName.includes("Gemma 3")) {
			score += 4;
		}
		if (model.displayName.includes("DeepSeek-R1")) {
			score += 4;
		}
		if (
			model.displayName.includes("Phi-3.5") ||
			model.displayName.includes("Phi 4")
		) {
			score += 3;
		}

		return { model, score };
	});

	scoredModels.sort((a, b) => b.score - a.score);
	const topMatches = scoredModels.slice(
		0,
		Math.min(limit, scoredModels.length),
	);

	return topMatches.flatMap(({ model }) => {
		const config = getModelRunProfile(model.id, model.provider);
		if (!config) {
			return [];
		}

		const estimatedTokensPerSecond = estimateTokensPerSecond(specs, model);
		const reason = generateReason(preference, specs, model);

		return [
			{
				provider: model.provider,
				providerName: PROVIDER_NAMES[model.provider],
				modelId: model.id,
				displayName: model.displayName,
				size: model.sizeLabel,
				sizeGB: model.sizeGB,
				estimatedTokensPerSecond,
				contextLength: model.contextLength,
				reason,
				releaseDate: model.releaseDate,
				usesWebGPU: model.requiresWebGPU && specs.hasWebGPU,
				kvBytesPerToken: model.kvBytesPerToken,
				config,
			},
		];
	});
}

/**
 * Generates all three recommendations (performance, quality, context).
 * Each preference gets a primary recommendation and all compatible alternatives.
 */
export function generateAllRecommendations(
	specs: SystemSpecs,
): RecommendationSet | null {
	const performanceList = generateRecommendations(specs, "performance", 50);
	const qualityList = generateRecommendations(specs, "quality", 50);
	const contextList = generateRecommendations(specs, "context", 50);

	if (
		performanceList.length === 0 ||
		qualityList.length === 0 ||
		contextList.length === 0
	) {
		return null;
	}

	return {
		performance: {
			primary: performanceList[0],
			alternatives: performanceList.slice(1),
		},
		quality: {
			primary: qualityList[0],
			alternatives: qualityList.slice(1),
		},
		context: {
			primary: contextList[0],
			alternatives: contextList.slice(1),
		},
	};
}

function estimateTokensPerSecond(
	specs: SystemSpecs,
	model: LLMModelConfig,
): number {
	let baseSpeed = 0;

	switch (specs.deviceCategory) {
		case "ultra":
			baseSpeed = model.requiresWebGPU ? 20 : 4;
			break;
		case "high":
			baseSpeed = model.requiresWebGPU ? 12 : 3;
			break;
		case "medium":
			baseSpeed = model.requiresWebGPU ? 6 : 2;
			break;
		case "low":
			baseSpeed = model.requiresWebGPU ? 3 : 1;
			break;
	}

	const sizeMultiplier = Math.max(0.4, 1 - model.sizeGB * 0.1);
	const providerMultiplier = PROVIDER_INFO[model.provider].speedMultiplier;
	return Math.max(
		1,
		Math.round(baseSpeed * sizeMultiplier * providerMultiplier),
	);
}

function generateReason(
	preference: ModelPreference,
	specs: SystemSpecs,
	model: LLMModelConfig,
): string {
	const deviceDesc =
		specs.deviceCategory === "ultra"
			? "high-end"
			: specs.deviceCategory === "high"
				? "powerful"
				: specs.deviceCategory === "medium"
					? "capable"
					: "modest";

	const gpuNote =
		model.requiresWebGPU && specs.hasWebGPU ? " with WebGPU acceleration" : "";

	const [year, month] = model.releaseDate.split("-");
	const monthName = new Date(`${year}-${month}-01`).toLocaleString("en", {
		month: "short",
		year: "numeric",
	});
	const releaseNote = ` Released ${monthName}.`;

	switch (preference) {
		case "performance":
			return `Fastest model for your ${deviceDesc} device${gpuNote}. Optimized for quick responses.${releaseNote}`;
		case "quality":
			return `Best quality model for your ${deviceDesc} device${gpuNote}. Excellent reasoning and accuracy.${releaseNote}`;
		case "context":
			return `Maximum context window (${model.contextLength.toLocaleString()} tokens) for handling long documents and conversations${gpuNote}.${releaseNote}`;
	}
}
