import { useState, useEffect, useCallback } from "react";
import { type ModelInfo } from "@/services/llm";
import { serviceManager } from "@/services";
import { logError, logInfo } from "@/utils/logger";
import { DEFAULT_SERVICES } from "@/services/llm/constants";

export function useDownloadedModels() {
	const [downloadedModels, setDownloadedModels] = useState<ModelInfo[]>([]);
	const [modelsLoading, setModelsLoading] = useState(false);

	// Helper: determine if a model entry represents a downloaded model
	const isDownloadedModel = useCallback((m: ModelInfo) => {
		const anyModel = m as unknown as { downloaded?: boolean };
		return anyModel.downloaded === true || m.loaded === true;
	}, []);

	// Fetch downloaded models from both services
	const fetchDownloadedModels = useCallback(async () => {
		setModelsLoading(true);
		let allModels: ModelInfo[] = [];
		const seenKeys = new Set<string>();

		const appendModels = (models: ModelInfo[]) => {
			for (const model of models) {
				const key = `${model.provider || "unknown"}:${model.id}`;
				if (seenKeys.has(key)) {
					continue;
				}
				seenKeys.add(key);
				allModels.push(model);
			}
		};

		try {
			// Try to get models from Wllama service
			try {
				const response = await serviceManager.llmService.modelsFor(
					DEFAULT_SERVICES.WLLAMA,
				);
				appendModels(response.data);
			} catch (err) {
				logInfo("Failed to fetch wllama models:", err);
			}

			// Try to get models from WebLLM service
			try {
				const response = await serviceManager.llmService.modelsFor(
					DEFAULT_SERVICES.WEBLLM,
				);
				appendModels(response.data);
			} catch (err) {
				logInfo("Failed to fetch WebLLM models:", err);
			}

			// Try to get models from Transformer service
			try {
				const response = await serviceManager.llmService.modelsFor(
					DEFAULT_SERVICES.TRANSFORMER,
				);
				appendModels(response.data);
			} catch (err) {
				logInfo("Failed to fetch Transformer models:", err);
			}

			// Local providers do not contribute downloaded models list here

			setDownloadedModels(allModels);
		} catch (err) {
			logError("Error in fetchDownloadedModels:", err);
		} finally {
			setModelsLoading(false);
		}
	}, []);

	// Fetch downloaded models on component mount
	useEffect(() => {
		fetchDownloadedModels();
	}, [fetchDownloadedModels]);

	// Only show actually downloaded models in "Your Models"
	const downloadedOnly = downloadedModels.filter(isDownloadedModel);

	return {
		downloadedModels,
		downloadedOnly,
		modelsLoading,
		fetchDownloadedModels,
		isDownloadedModel,
	};
}
