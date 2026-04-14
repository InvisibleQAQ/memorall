import { detectSystemSpecs } from "@/main/modules/llm/utils/system-detection";
import { getAvailableModelMemoryGB } from "@/main/modules/llm/utils/model-memory";
import { getModelRuntimeProfile } from "../registry/model-registry";

export interface RunnerMemoryHint {
	availableGB: number;
	sizeGB: number;
	kvBytesPerToken: number;
	contextLength: number;
	usesWebGPU: boolean;
}

export type RunnerMemoryHintProvider = "transformer" | "webllm" | "wllama";

export async function buildRunnerMemoryHint(
	modelId: string | undefined,
	provider: RunnerMemoryHintProvider,
	specs: Awaited<ReturnType<typeof detectSystemSpecs>> | null,
): Promise<RunnerMemoryHint | undefined> {
	if (!modelId || !specs) {
		return undefined;
	}

	const modelProfile = getModelRuntimeProfile(modelId, provider);
	if (!modelProfile) {
		return undefined;
	}

	return {
		availableGB: getAvailableModelMemoryGB(specs, modelProfile.requiresWebGPU),
		sizeGB: modelProfile.sizeGB,
		kvBytesPerToken: modelProfile.kvBytesPerToken,
		contextLength: modelProfile.contextLength,
		usesWebGPU: modelProfile.requiresWebGPU,
	};
}
