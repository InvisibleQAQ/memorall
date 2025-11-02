import React from "react";
import { useTranslation } from "react-i18next";

interface ProviderTabsProps {
	advancedProvider:
		| "wllama"
		| "webllm"
		| "openai"
		| "openrouter"
		| "lmstudio"
		| "ollama";
	setAdvancedProvider: (
		provider:
			| "wllama"
			| "webllm"
			| "openai"
			| "openrouter"
			| "lmstudio"
			| "ollama",
	) => void;
	loading: boolean;
	onProviderChange: () => void;
	onWebLLMTabSelect: (webllmAvailableModels: string[]) => void;
	webllmAvailableModels: string[];
	onOpenAITabSelect: () => void;
}

export const ProviderTabs: React.FC<ProviderTabsProps> = ({
	advancedProvider,
	setAdvancedProvider,
	loading,
	onProviderChange,
	onWebLLMTabSelect,
	webllmAvailableModels,
	onOpenAITabSelect,
}) => {
	const { t } = useTranslation("llm");
	return (
		<div className="flex border-b overflow-x-auto">
			<button
				onClick={() => {
					setAdvancedProvider("wllama");
					if (advancedProvider !== "wllama") {
						onProviderChange();
					}
				}}
				className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
					advancedProvider === "wllama"
						? "border-primary text-primary"
						: "border-transparent text-muted-foreground hover:text-foreground"
				}`}
				disabled={loading}
			>
				{t("providers.wllama")}
			</button>
			<button
				onClick={() => {
					setAdvancedProvider("webllm");
					if (advancedProvider !== "webllm") {
						onProviderChange();
						onWebLLMTabSelect(webllmAvailableModels);
					}
				}}
				className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
					advancedProvider === "webllm"
						? "border-primary text-primary"
						: "border-transparent text-muted-foreground hover:text-foreground"
				}`}
				disabled={loading}
			>
				{t("providers.webllm")}
			</button>
			<button
				onClick={() => {
					setAdvancedProvider("openai");
					if (advancedProvider !== "openai") {
						onProviderChange();
						onOpenAITabSelect();
					}
				}}
				className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
					advancedProvider === "openai"
						? "border-primary text-primary"
						: "border-transparent text-muted-foreground hover:text-foreground"
				}`}
				disabled={loading}
			>
				{t("providers.openai")}
			</button>
			<button
				onClick={() => {
					setAdvancedProvider("openrouter");
					if (advancedProvider !== "openrouter") {
						onProviderChange();
					}
				}}
				className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
					advancedProvider === "openrouter"
						? "border-primary text-primary"
						: "border-transparent text-muted-foreground hover:text-foreground"
				}`}
				disabled={loading}
			>
				{t("providers.openrouter")}
			</button>
			<button
				onClick={() => {
					setAdvancedProvider("lmstudio");
					if (advancedProvider !== "lmstudio") {
						onProviderChange();
					}
				}}
				className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
					advancedProvider === "lmstudio"
						? "border-primary text-primary"
						: "border-transparent text-muted-foreground hover:text-foreground"
				}`}
				disabled={loading}
			>
				{t("providers.lmstudio")}
			</button>
			<button
				onClick={() => {
					setAdvancedProvider("ollama");
					if (advancedProvider !== "ollama") {
						onProviderChange();
					}
				}}
				className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
					advancedProvider === "ollama"
						? "border-primary text-primary"
						: "border-transparent text-muted-foreground hover:text-foreground"
				}`}
				disabled={loading}
			>
				{t("providers.ollama")}
			</button>
		</div>
	);
};
