import { useState, useEffect } from "react";
import { type ModelInfo } from "@/services/llm";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { serviceManager } from "@/services";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";

export function useLocalModels(
	quickProvider: ServiceProvider,
	localConfigExists: boolean | null,
	authProviderReady?: boolean,
) {
	const [localModels, setLocalModels] = useState<ModelInfo[]>([]);
	const [localModelsLoading, setLocalModelsLoading] = useState(false);

	// Fetch models from providers when configuration exists
	useEffect(() => {
		const fetchLocalModels = async () => {
			// Handle local server providers (lmstudio, ollama)
			if (quickProvider === "lmstudio" || quickProvider === "ollama") {
				if (!localConfigExists) {
					setLocalModels([]);
					return;
				}

				setLocalModelsLoading(true);
				try {
					// For local providers, the service is created with their provider name
					// Check if the service exists
					if (serviceManager.llmService.has(quickProvider)) {
						const response =
							await serviceManager.llmService.modelsFor(quickProvider);
						setLocalModels(response.data);
					} else {
						// Try to create the service from saved configuration
						const configKey =
							quickProvider === "lmstudio"
								? "lmstudio_config"
								: "ollama_config";
						try {
							const row = (
								await serviceManager.databaseService.use(({ db, schema }) =>
									db
										.select()
										.from(schema.configurations)
										.where(eq(schema.configurations.key, configKey)),
								)
							)[0] as unknown as { data?: any } | undefined;

							if (row?.data) {
								// Create the service with the saved configuration
								await serviceManager.llmService.create(quickProvider, {
									type: quickProvider,
									baseURL: row.data.baseUrl,
								} as any);

								// Now fetch models
								const response =
									await serviceManager.llmService.modelsFor(quickProvider);
								setLocalModels(response.data);
							} else {
								setLocalModels([]);
							}
						} catch (createErr) {
							logError(`Failed to create ${quickProvider} service:`, createErr);
							setLocalModels([]);
						}
					}
				} catch (err) {
					logError(`Failed to fetch ${quickProvider} models:`, err);
					setLocalModels([]);
				} finally {
					setLocalModelsLoading(false);
				}
				return;
			}

			// Handle cloud API providers (openai, openrouter)
			if (quickProvider === "openai" || quickProvider === "openrouter") {
				// Check if service exists (means it's been configured and loaded)
				if (!serviceManager.llmService.has(quickProvider)) {
					setLocalModels([]);
					return;
				}

				setLocalModelsLoading(true);
				try {
					const response =
						await serviceManager.llmService.modelsFor(quickProvider);
					setLocalModels(response.data);
				} catch (err) {
					logError(`Failed to fetch ${quickProvider} models:`, err);
					setLocalModels([]);
				} finally {
					setLocalModelsLoading(false);
				}
				return;
			}

			// For other providers (wllama, webllm), don't fetch models
			setLocalModels([]);
		};

		fetchLocalModels();
	}, [quickProvider, localConfigExists, authProviderReady]);

	return { localModels, localModelsLoading };
}
