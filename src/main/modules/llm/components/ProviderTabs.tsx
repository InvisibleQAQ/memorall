import React from "react";
import { useTranslation } from "react-i18next";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";

export type ProviderStatus = "active" | "configured" | "idle";

const PROVIDER_ORDER: ServiceProvider[] = [
	"transformer",
	"wllama",
	"webllm",
	"openai",
	"openrouter",
	"lmstudio",
	"ollama",
];

interface ProviderTabsProps {
	advancedProvider: ServiceProvider;
	setAdvancedProvider: (provider: ServiceProvider) => void;
	loading: boolean;
	onProviderChange: () => void;
	onWebLLMTabSelect: (webllmAvailableModels: string[]) => void;
	webllmAvailableModels: string[];
	onOpenAITabSelect: () => void;
	providerStatuses?: Record<ServiceProvider, ProviderStatus>;
}

export const ProviderTabs: React.FC<ProviderTabsProps> = ({
	advancedProvider,
	setAdvancedProvider,
	loading,
	onProviderChange,
	onWebLLMTabSelect,
	webllmAvailableModels,
	onOpenAITabSelect,
	providerStatuses,
}) => {
	const { t } = useTranslation("llm");

	const handleSelect = (provider: ServiceProvider) => {
		setAdvancedProvider(provider);
		if (advancedProvider === provider) return;
		onProviderChange();
		if (provider === "webllm") {
			onWebLLMTabSelect(webllmAvailableModels);
		}
		if (provider === "openai") {
			onOpenAITabSelect();
		}
	};

	const labels: Record<ServiceProvider, string> = {
		transformer: t("providers.transformer", { defaultValue: "Transformer" }),
		wllama: t("providers.wllama"),
		webllm: t("providers.webllm"),
		openai: t("providers.openai"),
		openrouter: t("providers.openrouter"),
		lmstudio: t("providers.lmstudio"),
		ollama: t("providers.ollama"),
	};

	const compactLabels: Record<ServiceProvider, string> = {
		transformer: "Transformer",
		wllama: "Wllama",
		webllm: "WebLLM",
		openai: "OpenAI",
		openrouter: "Router",
		lmstudio: "Studio",
		ollama: "Ollama",
	};

	const renderStatus = (provider: ServiceProvider) => {
		const status = providerStatuses?.[provider] ?? "idle";
		if (status === "idle") return null;
		return (
			<span
				className={
					status === "active"
						? "h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-400"
						: "h-1.5 w-1.5 rotate-45 bg-blue-600 dark:bg-yellow-400"
				}
				aria-label={status}
				title={status}
			/>
		);
	};

	return (
		<div className="border-b bg-background/95 pb-2">
			<div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/20 p-1">
				{PROVIDER_ORDER.map((provider) => {
					const isActive = advancedProvider === provider;
					return (
						<button
							key={provider}
							type="button"
							onClick={() => handleSelect(provider)}
							className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
								isActive
									? "bg-background text-foreground shadow-sm ring-1 ring-border"
									: "text-muted-foreground hover:bg-background/60 hover:text-foreground"
							}`}
							disabled={loading}
						>
							<span className="sm:hidden">{compactLabels[provider]}</span>
							<span className="hidden sm:inline">{labels[provider]}</span>
							{renderStatus(provider)}
						</button>
					);
				})}
			</div>
		</div>
	);
};
