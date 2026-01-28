import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";
import React from "react";
import { useTranslation } from "react-i18next";

interface ProviderSelectorProps {
	quickProvider: ServiceProvider;
	setQuickProvider: (provider: ServiceProvider) => void;
	loading: boolean;
	allowedProviders?: ServiceProvider[];
}

const ALL_PROVIDERS: ServiceProvider[] = [
	"transformer",
	"wllama",
	"webllm",
	"openai",
	"openrouter",
	"lmstudio",
	"ollama",
];

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
	quickProvider,
	setQuickProvider,
	loading,
	allowedProviders = ALL_PROVIDERS,
}) => {
	const { t } = useTranslation("llm");

	const providerLabels: Record<ServiceProvider, string> = {
		transformer: t("providers.transformer"),
		wllama: t("providers.wllama"),
		webllm: t("providers.webllm"),
		openai: `${t("providers.openai")} (Cloud)`,
		openrouter: `${t("providers.openrouter")} (Cloud)`,
		lmstudio: `${t("providers.lmstudio")} (Local)`,
		ollama: `${t("providers.ollama")} (Local)`,
	};

	return (
		<div className="flex items-center gap-2">
			<select
				value={quickProvider}
				onChange={(e) => setQuickProvider(e.target.value as ServiceProvider)}
				className="text-xs border rounded px-2 py-1 bg-background"
				disabled={loading}
			>
				{ALL_PROVIDERS.filter((provider) =>
					allowedProviders.includes(provider),
				).map((provider) => (
					<option key={provider} value={provider}>
						{providerLabels[provider]}
					</option>
				))}
			</select>
		</div>
	);
};
