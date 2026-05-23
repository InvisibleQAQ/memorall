import { useState, useEffect } from "react";
import { serviceManager } from "@/services";
import { eq } from "drizzle-orm";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";
import {
	hasProviderConfig,
	isProviderReadyInSession,
	type AuthProvider,
} from "@/utils/provider-config";

interface ProviderConfig {
	requiresAuth: boolean;
	configKey?: string;
	isLocal: boolean;
}

const PROVIDER_CONFIGS: Record<ServiceProvider, ProviderConfig> = {
	openai: {
		requiresAuth: true,
		isLocal: false,
	},
	openrouter: {
		requiresAuth: true,
		isLocal: false,
	},
	lmstudio: {
		requiresAuth: false,
		configKey: "lmstudio_config",
		isLocal: true,
	},
	ollama: {
		requiresAuth: false,
		configKey: "ollama_config",
		isLocal: true,
	},
	wllama: {
		requiresAuth: false,
		isLocal: true,
	},
	webllm: {
		requiresAuth: false,
		isLocal: true,
	},
	transformer: {
		requiresAuth: false,
		isLocal: true,
	},
};

const AUTH_PROVIDERS = new Set<ServiceProvider>(["openai", "openrouter"]);

const isAuthProvider = (provider: ServiceProvider): provider is AuthProvider =>
	AUTH_PROVIDERS.has(provider);

export interface ProviderState {
	ready: boolean;
	configExists: boolean | null;
}

export function useProviderConfig() {
	const [providerStates, setProviderStates] = useState<
		Record<string, ProviderState>
	>({});
	const [localConfigExists, setLocalConfigExists] = useState<boolean | null>(
		null,
	);
	const [quickProvider, setQuickProvider] =
		useState<ServiceProvider>("openrouter");
	const [ready, setReady] = useState(false);

	const checkProviderConfig = async (
		provider: ServiceProvider,
	): Promise<ProviderState> => {
		if (!isAuthProvider(provider)) {
			return { ready: true, configExists: null };
		}

		return {
			ready: await isProviderReadyInSession(provider),
			configExists: await hasProviderConfig(provider),
		};
	};

	const updateProviderState = async (provider: ServiceProvider) => {
		const state = await checkProviderConfig(provider);
		setProviderStates((prev) => ({ ...prev, [provider]: state }));
	};

	useEffect(() => {
		const initializeProviders = async () => {
			const allProviders = Object.keys(PROVIDER_CONFIGS) as ServiceProvider[];

			for (const provider of allProviders) {
				await updateProviderState(provider);
			}

			setReady(true);
		};

		initializeProviders();
	}, []);

	useEffect(() => {
		const run = async () => {
			const config = PROVIDER_CONFIGS[quickProvider];

			if (!config.isLocal || !config.configKey) {
				setLocalConfigExists(null);
				return;
			}

			try {
				const row = (
					await serviceManager.databaseService.use(({ db, schema }) =>
						db
							.select()
							.from(schema.configurations)
							.where(eq(schema.configurations.key, config.configKey!)),
					)
				)[0];
				setLocalConfigExists(!!row);
			} catch {
				setLocalConfigExists(false);
			}
		};
		run();
	}, [quickProvider]);

	const getState = (provider: ServiceProvider): ProviderState => {
		return (
			providerStates[provider] || {
				ready: false,
				configExists: null,
			}
		);
	};

	const setStateReady = (provider: ServiceProvider, isReady: boolean) => {
		setProviderStates((prev) => ({
			...prev,
			[provider]: {
				...(prev[provider] || {
					ready: false,
					configExists: null,
				}),
				ready: isReady,
			},
		}));
	};

	const setConfigExists = (
		provider: ServiceProvider,
		exists: boolean | null,
	) => {
		setProviderStates((prev) => ({
			...prev,
			[provider]: {
				...(prev[provider] || {
					ready: false,
					configExists: null,
				}),
				configExists: exists,
			},
		}));
	};

	return {
		ready,
		providerStates,
		getState,
		setStateReady,
		setConfigExists,
		updateProviderState,
		localConfigExists,
		setLocalConfigExists,
		quickProvider,
		setQuickProvider,
		providerConfig: PROVIDER_CONFIGS,
	};
}
