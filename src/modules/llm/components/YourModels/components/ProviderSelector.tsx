import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";
import React from "react";
import { useTranslation } from "react-i18next";

interface ProviderSelectorProps {
	quickProvider: ServiceProvider;
	setQuickProvider: (provider: ServiceProvider) => void;
	loading: boolean;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
	quickProvider,
	setQuickProvider,
	loading,
}) => {
	const { t } = useTranslation("llm");
	return (
		<div className="flex items-center gap-2">
			<select
				value={quickProvider}
				onChange={(e) => setQuickProvider(e.target.value as ServiceProvider)}
				className="text-xs border rounded px-2 py-1 bg-background"
				disabled={loading}
			>
				<option value="wllama">{t("providers.wllama")}</option>
				<option value="webllm">{t("providers.webllm")}</option>
				<option value="openai">{t("providers.openai")} (Cloud)</option>
				<option value="openrouter">{t("providers.openrouter")} (Cloud)</option>
				<option value="lmstudio">{t("providers.lmstudio")} (Local)</option>
				<option value="ollama">{t("providers.ollama")} (Local)</option>
			</select>
		</div>
	);
};
