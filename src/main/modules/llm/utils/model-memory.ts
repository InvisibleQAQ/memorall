import type { SystemSpecs } from "../types/system-specs";

export interface ModelMemoryEstimate {
	weightsGB: number;
	kvCacheGB: number;
	bufferGB: number;
	totalGB: number;
	/** Max total context tokens that fit in available memory */
	feasibleContext: number;
	fit: "comfortable" | "tight" | "overflow";
}

export interface TokenBudgetEstimate {
	maxTotalContextTokens?: number;
	maxNewTokens?: number;
	maxNewTokensByMemory?: number;
	maxNewTokensByContext?: number;
}

const WEBGPU_MEMORY_BY_CATEGORY: Record<SystemSpecs["deviceCategory"], number> =
	{
		ultra: 12,
		high: 8,
		medium: 4,
		low: 2,
	};

const CPU_AI_MEMORY_FRACTION = 0.4;
const RUNTIME_BUFFER_MULTIPLIER = 1.2;
const CONTEXT_GRANULARITY = 1024;

/**
 * Returns the effective memory budget in GB available for model weights + KV cache.
 * WebGPU models consume VRAM; CPU models use a conservative fraction of system RAM.
 */
export function getAvailableModelMemoryGB(
	specs: SystemSpecs,
	usesWebGPU: boolean,
): number {
	if (usesWebGPU) {
		if (specs.gpu?.estimatedVRAM) {
			return specs.gpu.estimatedVRAM;
		}
		return WEBGPU_MEMORY_BY_CATEGORY[specs.deviceCategory] ?? 4;
	}

	return specs.memoryGB * CPU_AI_MEMORY_FRACTION;
}

/**
 * Estimates total runtime memory for a model at a given total context length.
 */
export function estimateModelMemory(
	sizeGB: number,
	kvBytesPerToken: number,
	contextTokens: number,
	availableGB: number,
): ModelMemoryEstimate {
	const kvCacheGB = (kvBytesPerToken * contextTokens) / 1024 ** 3;
	const bufferGB = (sizeGB + kvCacheGB) * (RUNTIME_BUFFER_MULTIPLIER - 1);
	const totalGB = sizeGB + kvCacheGB + bufferGB;

	let feasibleContext = contextTokens;
	if (totalGB > availableGB) {
		const availableForKV = availableGB / RUNTIME_BUFFER_MULTIPLIER - sizeGB;
		if (availableForKV > 0) {
			const maxTokens = Math.floor(
				(availableForKV * 1024 ** 3) / kvBytesPerToken,
			);
			feasibleContext = Math.max(
				0,
				Math.floor(maxTokens / CONTEXT_GRANULARITY) * CONTEXT_GRANULARITY,
			);
		} else {
			feasibleContext = 0;
		}
	}

	const ratio =
		availableGB > 0 ? totalGB / availableGB : Number.POSITIVE_INFINITY;
	const fit =
		ratio <= 0.75 ? "comfortable" : ratio <= 0.95 ? "tight" : "overflow";

	return {
		weightsGB: sizeGB,
		kvCacheGB,
		bufferGB,
		totalGB,
		feasibleContext,
		fit,
	};
}

/**
 * Estimates a safe token budget after accounting for model context and device memory.
 * Context is rounded down to 1K-token steps to stay conservative.
 */
export function estimateSafeTokenBudget({
	promptTokens,
	sizeGB,
	kvBytesPerToken,
	availableGB,
	maxContextTokens,
}: {
	promptTokens: number;
	sizeGB: number;
	kvBytesPerToken: number;
	availableGB: number;
	maxContextTokens?: number;
}): TokenBudgetEstimate {
	const memoryEstimate = estimateModelMemory(
		sizeGB,
		kvBytesPerToken,
		typeof maxContextTokens === "number" ? maxContextTokens : promptTokens,
		availableGB,
	);

	const memoryContextTokens =
		typeof maxContextTokens === "number" &&
		memoryEstimate.feasibleContext > maxContextTokens
			? maxContextTokens
			: memoryEstimate.feasibleContext;

	const contextCandidates = [maxContextTokens, memoryContextTokens].filter(
		(value): value is number =>
			typeof value === "number" && Number.isFinite(value) && value >= 0,
	);

	const maxTotalContextTokens =
		contextCandidates.length > 0 ? Math.min(...contextCandidates) : undefined;
	const maxNewTokensByContext =
		typeof maxContextTokens === "number"
			? Math.max(0, maxContextTokens - promptTokens)
			: undefined;
	const maxNewTokensByMemory = Math.max(0, memoryContextTokens - promptTokens);
	const maxNewTokens =
		typeof maxTotalContextTokens === "number"
			? Math.max(0, maxTotalContextTokens - promptTokens)
			: undefined;

	return {
		maxTotalContextTokens,
		maxNewTokens,
		maxNewTokensByMemory,
		maxNewTokensByContext,
	};
}
