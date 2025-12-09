import React from "react";
import {
	LogIn,
	Cpu,
	KeyRound,
	Sparkles,
	Download,
	Settings,
	Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { YourModels } from "@/modules/llm/components/YourModels";
import { ExternalProvidersConfig } from "@/modules/llm/components/ExternalProvidersConfig";
import { MagicSetup } from "@/modules/llm/components/MagicSetup";
import { useAuth } from "@/modules/supabase";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";
import type {
	ModelRecommendation,
	ModelPreference,
} from "@/modules/llm/types/system-specs";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { QUICK_TRANSFORMER_MODELS } from "@/constants/transformer";
import { QUICK_WALLAMA_LLMS } from "@/constants/wllama";
import { QUICK_WEBLLM_LLMS } from "@/constants/webllm";
import { useModelOperations } from "@/modules/llm/hooks/use-model-operations";
import { useDownloadedModels } from "@/modules/llm/hooks/use-downloaded-models";
import { useDownloadProgress } from "@/modules/llm/hooks/use-download-progress";
import { useCurrentModel } from "@/hooks/use-current-model";

interface NoModelsScreenProps {
	onModelLoaded: (modelId: string, provider: ServiceProvider) => void;
	onNavigateToModels: () => void;
}

export const NoModelsScreen: React.FC<NoModelsScreenProps> = ({
	onModelLoaded,
	onNavigateToModels,
}) => {
	const { t } = useTranslation("chat");
	const { t: tLlm } = useTranslation("llm");
	const navigate = useNavigate();
	const { isLoading, isInitialized } = useAuth();
	const [selectedOption, setSelectedOption] = React.useState<
		"login" | "local" | "keys" | null
	>(null);
	const [localSetupMode, setLocalSetupMode] = React.useState<
		"magic" | "advanced" | null
	>(null);
	const [loading, setLoading] = React.useState(false);

	// Setup hooks for model operations
	const { setCurrent } = useCurrentModel();
	const { downloadedModels, fetchDownloadedModels } = useDownloadedModels();
	const {
		downloadProgress,
		setDownloadProgress,
		quickDownloadModel,
		setQuickDownloadModel,
	} = useDownloadProgress();

	const { handleQuickDownload } = useModelOperations({
		setCurrent,
		setLoading,
		setQuickDownloadModel,
		setDownloadProgress,
		fetchDownloadedModels,
		downloadedModels,
		onModelLoaded,
	});

	// Handler for magic setup model selection
	const handleMagicModelSelected = async (
		recommendation: ModelRecommendation,
		preference: ModelPreference,
	) => {
		const { config } = recommendation;

		// Find the model config from the quick download lists and trigger download
		if (config.provider === "transformer") {
			const modelConfig = QUICK_TRANSFORMER_MODELS.find(
				(m) => m.model === config.model,
			);
			if (modelConfig) {
				await handleQuickDownload(modelConfig, config.provider);
			}
		} else if (config.provider === "wllama") {
			const modelConfig = QUICK_WALLAMA_LLMS.find(
				(m) => m.repo === config.repo && m.filename === config.filename,
			);
			if (modelConfig) {
				await handleQuickDownload(modelConfig, config.provider);
			}
		} else if (config.provider === "webllm") {
			const modelConfig = QUICK_WEBLLM_LLMS.find(
				(m) => m.model === config.model,
			);
			if (modelConfig) {
				await handleQuickDownload(modelConfig, config.provider);
			}
		}
	};

	// Reset local setup mode when changing options
	React.useEffect(() => {
		if (selectedOption !== "local") {
			setLocalSetupMode(null);
		}
	}, [selectedOption]);

	// Wait for auth to initialize
	if (!isInitialized || isLoading) {
		return (
			<div className="flex flex-col h-full bg-background">
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<img
							src="/logo.png"
							alt="Memorall Logo"
							className="w-12 h-12 mx-auto mb-4 object-contain animate-pulse"
						/>
						<p className="text-muted-foreground">{t("noModels.loading")}</p>
					</div>
				</div>
			</div>
		);
	}

	// Show no-models screen with 3 setup options
	return (
		<div className="flex flex-col h-full bg-background">
			<div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
				<div className="w-full max-w-6xl mx-auto space-y-8 py-8 max-h-full">
					{/* App Branding */}
					<div className="text-center space-y-4">
						<img
							src="/logo.png"
							alt="Memorall Logo"
							className="w-16 h-16 mx-auto object-contain"
						/>
						<div className="space-y-2">
							<h1 className="text-3xl font-bold">{t("noModels.appName")}</h1>
							<p className="text-lg text-muted-foreground">
								{tLlm("noModelsScreen.chooseSetup")}
							</p>
						</div>
					</div>

					{/* 3 Setup Cards - Responsive Grid */}
					{!selectedOption && (
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
							{/* Card 1: Login/Signup */}
							<Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary cursor-pointer border-2">
								<CardHeader className="text-center pb-4">
									<div className="mx-auto mb-4 p-4 rounded-full bg-primary/10 w-fit group-hover:bg-primary/20 transition-colors">
										<Sparkles className="w-8 h-8 text-primary" />
									</div>
									<CardTitle className="text-xl">
										{tLlm("noModelsScreen.managedService.title")}
									</CardTitle>
									<CardDescription className="text-sm">
										{tLlm("noModelsScreen.managedService.description")}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-3 text-sm">
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.managedService.feature1")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.managedService.feature2")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.managedService.feature3")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.managedService.feature4")}</p>
										</div>
									</div>
									<Button
										onClick={() => navigate("/auth")}
										className="w-full"
										size="lg"
									>
										<LogIn className="w-4 h-4 mr-2" />
										{tLlm("noModelsScreen.managedService.action")}
									</Button>
								</CardContent>
							</Card>

							{/* Card 2: Local LLM */}
							<Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary cursor-pointer border-2">
								<CardHeader className="text-center pb-4">
									<div className="mx-auto mb-4 p-4 rounded-full bg-emerald-500/10 w-fit group-hover:bg-emerald-500/20 transition-colors">
										<Cpu className="w-8 h-8 text-emerald-600 dark:text-emerald-500" />
									</div>
									<CardTitle className="text-xl">
										{tLlm("noModelsScreen.localModels.title")}
									</CardTitle>
									<CardDescription className="text-sm">
										{tLlm("noModelsScreen.localModels.description")}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-3 text-sm">
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.localModels.feature1")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.localModels.feature2")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.localModels.feature3")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.localModels.feature4")}</p>
										</div>
									</div>
									<TooltipProvider>
										<div className="flex gap-2">
											{/* Magic Setup Button - Primary */}
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														onClick={() => {
															setSelectedOption("local");
															setLocalSetupMode("magic");
														}}
														className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
														size="lg"
													>
														<Wand2 className="w-4 h-4 mr-2" />
														{tLlm("noModelsScreen.localModels.magicAction")}
													</Button>
												</TooltipTrigger>
												<TooltipContent>
													<p className="max-w-xs">
														{tLlm("noModelsScreen.localModels.magicTooltip")}
													</p>
												</TooltipContent>
											</Tooltip>

											{/* Advanced Setup Button - Secondary */}
											<Tooltip>
												<TooltipTrigger asChild>
													<Button
														onClick={() => {
															setSelectedOption("local");
															setLocalSetupMode("advanced");
														}}
														variant="outline"
														size="lg"
														className="px-3"
													>
														<Settings className="w-4 h-4" />
													</Button>
												</TooltipTrigger>
												<TooltipContent>
													<p className="max-w-xs">
														{tLlm("noModelsScreen.localModels.advancedTooltip")}
													</p>
												</TooltipContent>
											</Tooltip>
										</div>
									</TooltipProvider>
								</CardContent>
							</Card>

							{/* Card 3: Own Keys */}
							<Card className="group hover:shadow-lg transition-all duration-300 hover:border-primary cursor-pointer border-2">
								<CardHeader className="text-center pb-4">
									<div className="mx-auto mb-4 p-4 rounded-full bg-amber-500/10 w-fit group-hover:bg-amber-500/20 transition-colors">
										<KeyRound className="w-8 h-8 text-amber-600 dark:text-amber-500" />
									</div>
									<CardTitle className="text-xl">
										{tLlm("noModelsScreen.ownKeys.title")}
									</CardTitle>
									<CardDescription className="text-sm">
										{tLlm("noModelsScreen.ownKeys.description")}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-3 text-sm">
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-500 mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.ownKeys.feature1")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-500 mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.ownKeys.feature2")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-500 mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.ownKeys.feature3")}</p>
										</div>
										<div className="flex items-start gap-2">
											<div className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-500 mt-1.5 flex-shrink-0" />
											<p>{tLlm("noModelsScreen.ownKeys.feature4")}</p>
										</div>
									</div>
									<Button
										onClick={() => setSelectedOption("keys")}
										className="w-full bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700"
										size="lg"
									>
										<Settings className="w-4 h-4 mr-2" />
										{tLlm("noModelsScreen.ownKeys.action")}
									</Button>
								</CardContent>
							</Card>
						</div>
					)}

					{/* Local Models Setup */}
					{selectedOption === "local" && (
						<div className="max-w-4xl mx-auto space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<h2 className="text-2xl font-semibold">
										{localSetupMode === "magic"
											? tLlm("noModelsScreen.localModels.magicSetupTitle")
											: tLlm("noModelsScreen.localModels.advancedSetupTitle")}
									</h2>
									<p className="text-sm text-muted-foreground">
										{localSetupMode === "magic"
											? tLlm("noModelsScreen.localModels.magicSetupDescription")
											: tLlm("noModelsScreen.localModels.advancedSetupDescription")}
									</p>
								</div>
								<Button
									variant="outline"
									onClick={() => setSelectedOption(null)}
								>
									{tLlm("noModelsScreen.back")}
								</Button>
							</div>

							{/* Magic Setup Flow */}
							{localSetupMode === "magic" && (
								<MagicSetup
									onModelSelected={handleMagicModelSelected}
									onCancel={() => setLocalSetupMode("advanced")}
								/>
							)}

							{/* Advanced Setup Flow */}
							{localSetupMode === "advanced" && (
								<YourModels
									onModelLoaded={onModelLoaded}
									showQuickDownload={true}
									allowedProviders={[
										"transformer",
										"wllama",
										"webllm",
										"lmstudio",
										"ollama",
									]}
								/>
							)}
						</div>
					)}

					{/* API Keys Setup */}
					{selectedOption === "keys" && (
						<div className="max-w-4xl mx-auto space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<h2 className="text-2xl font-semibold">
										{tLlm("noModelsScreen.ownKeys.setupTitle")}
									</h2>
									<p className="text-sm text-muted-foreground">
										{tLlm("noModelsScreen.ownKeys.setupDescription")}
									</p>
								</div>
								<Button
									variant="outline"
									onClick={() => setSelectedOption(null)}
								>
									{tLlm("noModelsScreen.back")}
								</Button>
							</div>
							<ExternalProvidersConfig onModelLoaded={onModelLoaded} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
