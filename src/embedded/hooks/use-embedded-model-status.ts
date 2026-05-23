import { useCallback, useEffect, useState } from "react";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { logError, logInfo } from "@/utils/logger";

export const useEmbeddedModelStatus = () => {
	const [selectedModel, setSelectedModel] = useState<string>("");
	const [selectedProvider, setSelectedProvider] = useState<string>("");
	const [modelAvailable, setModelAvailable] = useState(false);
	const [noModelConfig, setNoModelConfig] = useState(false);

	const refreshModelStatus = useCallback(async () => {
		try {
			const result = await backgroundJob.createJob(
				"get-current-model",
				{},
				{ stream: false },
			);

			if (!("promise" in result)) {
				return;
			}

			const jobResult = await result.promise;
			logInfo("[EmbeddedChat] Initialize model", jobResult);

			if (jobResult.status !== "completed" || !jobResult.result) {
				return;
			}

			const modelInfo = jobResult.result.modelInfo;
			if (
				modelInfo &&
				typeof modelInfo === "object" &&
				"modelId" in modelInfo &&
				"provider" in modelInfo
			) {
				setSelectedModel(`${modelInfo.modelId}`);
				setSelectedProvider(`${modelInfo.provider}`);
				setNoModelConfig(false);
				setModelAvailable(true);
				return;
			}

			setSelectedModel("");
			setSelectedProvider("");
			setNoModelConfig(true);
			setModelAvailable(false);
		} catch (error) {
			logError("[EmbeddedChat] Initialize model failed", error);
			setModelAvailable(false);
		}
	}, []);

	useEffect(() => {
		void refreshModelStatus();
	}, [refreshModelStatus]);

	return {
		selectedModel,
		selectedProvider,
		modelAvailable,
		noModelConfig,
		refreshModelStatus,
	};
};
