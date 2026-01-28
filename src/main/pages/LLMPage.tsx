import React from "react";
import {
	AdvancedSection,
	useLLMState,
	useLLMActions,
	useProgressListener,
	useRepoEffect,
} from "@/main/modules/llm/components";
import { YourModels } from "@/main/modules/llm/components/YourModels";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/main/components/ui/card";
import { Badge } from "@/main/components/ui/badge";
import { Home, Brain, CheckCircle2 } from "lucide-react";
import { useCurrentModel } from "@/main/hooks/use-current-model";
import { useTranslation } from "react-i18next";

// No local quick-connect card; configuration handled in AdvancedSection

export const LLMPage: React.FC = () => {
	const { t } = useTranslation("llm");
	const state = useLLMState();
	const actions = useLLMActions({
		...state,
	});

	// Hooks for current model display
	const { current } = useCurrentModel();

	// Setup event listeners and effects
	useProgressListener({
		setDownloadProgress: state.setDownloadProgress,
		setStatus: state.setStatus,
		setLogs: state.setLogs,
	});

	useRepoEffect({
		repo: state.repo,
		fetchRepoFiles: actions.fetchRepoFiles,
		setAvailableFiles: state.setAvailableFiles,
		setFilePath: state.setFilePath,
		setStatus: state.setStatus,
	});

	return (
		<div className="max-w-3xl mx-auto space-y-3 sm:py-3">
			{/* Current Model Status */}
			<Card className="rounded-none md:rounded-lg" data-copilot="current-model">
				<CardHeader className="p-3 pb-0">
					<CardTitle className="flex items-center gap-2">
						<Brain size={20} />
						{t("currentModel.title")}
					</CardTitle>
					<CardDescription>{t("currentModel.description")}</CardDescription>
				</CardHeader>
				<CardContent className="p-3">
					{current && current.modelId && current.modelId.trim() !== "" ? (
						<div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
							<CheckCircle2 className="w-5 h-5 text-primary" />
							<div className="flex-1">
								<div className="font-semibold text-foreground">
									{current.modelId}
								</div>
								<div className="text-sm text-muted-foreground">
									{t("currentModel.provider", { provider: current.provider })}
								</div>
							</div>
							<Badge
								variant="secondary"
								className="bg-primary/10 text-primary border-primary/20"
							>
								{t("currentModel.status.active")}
							</Badge>
						</div>
					) : current && current.provider ? (
						<div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-950 dark:border-orange-800">
							<div className="w-5 h-5 rounded-full bg-orange-400 animate-pulse" />
							<div className="flex-1">
								<div className="font-semibold text-foreground">
									{t("currentModel.providerConfigured", {
										provider: current.provider,
									})}
								</div>
								<div className="text-sm text-muted-foreground">
									{t("currentModel.noModelLoaded")}
								</div>
							</div>
							<Badge
								variant="outline"
								className="text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700"
							>
								{t("currentModel.status.configured")}
							</Badge>
						</div>
					) : (
						<div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
							<div className="w-5 h-5 rounded-full bg-muted" />
							<div className="flex-1">
								<div className="font-semibold text-muted-foreground">
									{t("currentModel.noModelSelected")}
								</div>
								<div className="text-sm text-muted-foreground">
									{t("currentModel.selectModel")}
								</div>
							</div>
							<Badge variant="outline" className="text-muted-foreground">
								{t("currentModel.status.inactive")}
							</Badge>
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="rounded-none md:rounded-lg" data-copilot="quick-setup">
				<CardHeader className="p-3">
					<CardTitle className="flex items-center gap-2">
						<Home size={20} />
						{t("yourModels.title")}
					</CardTitle>
					<CardDescription>{t("yourModels.description")}</CardDescription>
				</CardHeader>
				<CardContent className="p-3">
					<YourModels onModelLoaded={actions.handleModelLoaded} />
				</CardContent>
			</Card>

			<AdvancedSection
				{...state}
				onLoadModel={actions.loadModel}
				onLoadAdvancedModel={actions.loadAdvancedModel}
				onUnloadModel={actions.unloadModel}
				onGenerate={actions.generate}
				onFetchRepoFiles={actions.fetchRepoFiles}
				onProviderChange={actions.handleProviderChange}
				onWebLLMTabSelect={actions.handleWebLLMTabSelect}
				onOpenAITabSelect={actions.handleOpenAITabSelect}
				onModelLoaded={actions.handleModelLoaded}
			/>
		</div>
	);
};
