import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Loader2,
	Cpu,
	MemoryStick,
	Zap,
	Sparkles,
	FileText,
	CheckCircle2,
	AlertCircle,
	Search,
	ArrowUpDown,
} from "lucide-react";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { generateAllRecommendations } from "../utils/model-recommendations";
import type {
	SystemSpecs,
	ModelPreference,
	RecommendationSet,
	ModelRecommendation,
} from "../types/system-specs";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";

interface MagicSetupProps {
	onModelSelected: (
		recommendation: ModelRecommendation,
		preference: ModelPreference,
	) => Promise<void>;
	onCancel: () => void;
}

type SetupStep = "detecting" | "specs" | "preference" | "recommendation";

export const MagicSetup: React.FC<MagicSetupProps> = ({
	onModelSelected,
	onCancel,
}) => {
	const { t } = useTranslation("llm");

	// State
	const [step, setStep] = useState<SetupStep>("detecting");
	const [specs, setSpecs] = useState<SystemSpecs | null>(null);
	const [recommendations, setRecommendations] =
		useState<RecommendationSet | null>(null);
	const [selectedPreference, setSelectedPreference] =
		useState<ModelPreference | null>(null);
	const [selectedModel, setSelectedModel] =
		useState<ModelRecommendation | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Filter & Sort state for alternatives
	const [filterText, setFilterText] = useState("");
	const [sortBy, setSortBy] = useState<"speed" | "size" | "quality">("speed");

	// Filtered and sorted alternatives
	const filteredAlternatives = useMemo(() => {
		if (!recommendations || !selectedPreference) return [];

		const alternatives = recommendations[selectedPreference].alternatives;

		// Filter by name
		const filtered = alternatives.filter((model) =>
			model.displayName.toLowerCase().includes(filterText.toLowerCase()),
		);

		// Sort
		const sorted = [...filtered].sort((a, b) => {
			switch (sortBy) {
				case "speed":
					return b.estimatedTokensPerSecond - a.estimatedTokensPerSecond;
				case "size":
					return a.sizeGB - b.sizeGB; // Smaller first
				case "quality":
					// Approximate quality by context length (better models tend to have larger context)
					return b.contextLength - a.contextLength;
				default:
					return 0;
			}
		});

		return sorted;
	}, [recommendations, selectedPreference, filterText, sortBy]);

	// Detect system specs on mount
	useEffect(() => {
		detectSystem();
	}, []);

	const detectSystem = async () => {
		try {
			setStep("detecting");
			setError(null);

			// Run system detection in offscreen thread to avoid WebGPU memory allocation in UI thread
			const { promise } = await backgroundJob.execute(
				"detect-system-specs",
				{},
				{ stream: false },
			);

			const result = await promise;

			if (result.status === "completed" && result.result) {
				const detectedSpecs = result.result.specs;
				setSpecs(detectedSpecs);

				const recs = generateAllRecommendations(detectedSpecs);
				if (!recs) {
					setError(
						"Unable to find compatible models for your device. Please try advanced setup.",
					);
					return;
				}

				setRecommendations(recs);
				setStep("specs");
			} else {
				throw new Error(
					result.error || "Failed to detect system specifications",
				);
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to detect system specifications",
			);
		}
	};

	const handlePreferenceSelect = (preference: ModelPreference) => {
		setSelectedPreference(preference);
		if (recommendations) {
			setSelectedModel(recommendations[preference].primary);
		}
		setStep("recommendation");
	};

	const handleDownload = async () => {
		if (!selectedModel || !selectedPreference) return;

		setLoading(true);
		try {
			await onModelSelected(selectedModel, selectedPreference);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to download model");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Step 1: Detecting System */}
			{step === "detecting" && (
				<Card>
					<CardContent className="pt-6">
						<div className="flex flex-col items-center justify-center py-8 space-y-4">
							<Loader2 className="w-12 h-12 animate-spin text-primary" />
							<div className="text-center space-y-2">
								<h3 className="text-lg font-semibold">
									{t("magicSetup.detecting.title")}
								</h3>
								<p className="text-sm text-muted-foreground">
									{t("magicSetup.detecting.description")}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Step 2: Show System Specs */}
			{step === "specs" && specs && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<CheckCircle2 className="w-5 h-5 text-green-600" />
							{t("magicSetup.systemDetected.title")}
						</CardTitle>
						<CardDescription>
							{t("magicSetup.systemDetected.description")}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* System Specs Grid */}
						<div className="grid grid-cols-2 gap-4">
							<div className="flex items-center gap-3 p-3 border rounded-lg">
								<Cpu className="w-5 h-5 text-primary" />
								<div>
									<div className="text-sm font-medium">
										{t("magicSetup.systemDetected.cpu")}
									</div>
									<div className="text-xs text-muted-foreground">
										{specs.cpuCores} {t("magicSetup.systemDetected.cores")}
									</div>
								</div>
							</div>

							<div className="flex items-center gap-3 p-3 border rounded-lg">
								<MemoryStick className="w-5 h-5 text-primary" />
								<div>
									<div className="text-sm font-medium">
										{t("magicSetup.systemDetected.memory")}
									</div>
									<div className="text-xs text-muted-foreground">
										~{specs.memoryGB} {t("magicSetup.systemDetected.ramGB")}
									</div>
								</div>
							</div>

							<div className="flex items-center gap-3 p-3 border rounded-lg">
								<Zap className="w-5 h-5 text-primary" />
								<div>
									<div className="text-sm font-medium">
										{t("magicSetup.systemDetected.webgpu")}
									</div>
									<div className="text-xs text-muted-foreground">
										{specs.hasWebGPU
											? t("magicSetup.systemDetected.available")
											: t("magicSetup.systemDetected.notAvailable")}
									</div>
								</div>
							</div>

							<div className="flex items-center gap-3 p-3 border rounded-lg">
								<Sparkles className="w-5 h-5 text-primary" />
								<div>
									<div className="text-sm font-medium">
										{t("magicSetup.systemDetected.deviceClass")}
									</div>
									<div className="text-xs text-muted-foreground capitalize">
										{specs.deviceCategory}
									</div>
								</div>
							</div>
						</div>

						{specs.gpu && (
							<div className="p-3 border rounded-lg bg-muted/30">
								<div className="text-sm font-medium mb-1">
									{t("magicSetup.systemDetected.gpuDetected")}
								</div>
								<div className="text-xs text-muted-foreground">
									{specs.gpu.renderer}
								</div>
								{specs.gpu.estimatedVRAM && (
									<div className="text-xs text-muted-foreground">
										~{specs.gpu.estimatedVRAM}{" "}
										{t("magicSetup.systemDetected.vramGB")}
									</div>
								)}
							</div>
						)}

						<Button onClick={() => setStep("preference")} className="w-full">
							{t("magicSetup.systemDetected.continue")}
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Step 3: Choose Preference */}
			{step === "preference" && recommendations && (
				<div className="space-y-4">
					<div className="text-center space-y-2">
						<h3 className="text-lg font-semibold">
							{t("magicSetup.choosePriority.title")}
						</h3>
						<p className="text-sm text-muted-foreground">
							{t("magicSetup.choosePriority.description")}
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{/* Performance */}
						<Card
							className="cursor-pointer transition-all hover:shadow-lg hover:border-primary border-2"
							onClick={() => handlePreferenceSelect("performance")}
						>
							<CardHeader className="text-center pb-3">
								<div className="mx-auto mb-3 p-3 rounded-full bg-green-500/10 w-fit">
									<Zap className="w-6 h-6 text-green-600 dark:text-green-500" />
								</div>
								<CardTitle className="text-lg">
									{t("magicSetup.choosePriority.performance.title")}
								</CardTitle>
								<CardDescription className="text-xs">
									{t("magicSetup.choosePriority.performance.description")}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 text-center">
								<div className="text-2xl font-bold text-green-600 dark:text-green-500">
									~
									{recommendations.performance.primary.estimatedTokensPerSecond}{" "}
									tok/s
								</div>
								<div className="text-sm font-medium">
									{recommendations.performance.primary.displayName}
								</div>
								<div className="text-xs text-primary font-medium">
									{recommendations.performance.primary.providerName}
								</div>
								<div className="text-xs text-muted-foreground">
									{recommendations.performance.primary.size} •{" "}
									{recommendations.performance.primary.usesWebGPU
										? "WebGPU"
										: "CPU"}
								</div>
							</CardContent>
						</Card>

						{/* Quality */}
						<Card
							className="cursor-pointer transition-all hover:shadow-lg hover:border-primary border-2"
							onClick={() => handlePreferenceSelect("quality")}
						>
							<CardHeader className="text-center pb-3">
								<div className="mx-auto mb-3 p-3 rounded-full bg-purple-500/10 w-fit">
									<Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-500" />
								</div>
								<CardTitle className="text-lg">
									{t("magicSetup.choosePriority.quality.title")}
								</CardTitle>
								<CardDescription className="text-xs">
									{t("magicSetup.choosePriority.quality.description")}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 text-center">
								<div className="text-2xl font-bold text-purple-600 dark:text-purple-500">
									~{recommendations.quality.primary.estimatedTokensPerSecond}{" "}
									tok/s
								</div>
								<div className="text-sm font-medium">
									{recommendations.quality.primary.displayName}
								</div>
								<div className="text-xs text-primary font-medium">
									{recommendations.quality.primary.providerName}
								</div>
								<div className="text-xs text-muted-foreground">
									{recommendations.quality.primary.size} •{" "}
									{recommendations.quality.primary.usesWebGPU
										? "WebGPU"
										: "CPU"}
								</div>
							</CardContent>
						</Card>

						{/* Context */}
						<Card
							className="cursor-pointer transition-all hover:shadow-lg hover:border-primary border-2"
							onClick={() => handlePreferenceSelect("context")}
						>
							<CardHeader className="text-center pb-3">
								<div className="mx-auto mb-3 p-3 rounded-full bg-blue-500/10 w-fit">
									<FileText className="w-6 h-6 text-blue-600 dark:text-blue-500" />
								</div>
								<CardTitle className="text-lg">
									{t("magicSetup.choosePriority.context.title")}
								</CardTitle>
								<CardDescription className="text-xs">
									{t("magicSetup.choosePriority.context.description")}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 text-center">
								<div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
									{(
										recommendations.context.primary.contextLength / 1000
									).toLocaleString()}
									K
								</div>
								<div className="text-sm font-medium">
									{recommendations.context.primary.displayName}
								</div>
								<div className="text-xs text-primary font-medium">
									{recommendations.context.primary.providerName}
								</div>
								<div className="text-xs text-muted-foreground">
									{recommendations.context.primary.size} •{" "}
									{recommendations.context.primary.usesWebGPU
										? "WebGPU"
										: "CPU"}
								</div>
							</CardContent>
						</Card>
					</div>

					<Button
						variant="outline"
						onClick={() => setStep("specs")}
						className="w-full"
					>
						{t("magicSetup.choosePriority.backToSpecs")}
					</Button>
				</div>
			)}

			{/* Step 4: Recommendation Summary */}
			{step === "recommendation" &&
				selectedPreference &&
				selectedModel &&
				recommendations && (
					<div className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>{t("magicSetup.recommendation.title")}</CardTitle>
								<CardDescription>
									{t("magicSetup.recommendation.description")}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="p-4 border rounded-lg bg-muted/30 space-y-3">
									<div className="flex items-center justify-between">
										<div>
											<div className="font-semibold text-lg">
												{selectedModel.displayName}
											</div>
											<div className="text-sm text-primary font-medium">
												{selectedModel.providerName}
											</div>
											<div className="text-xs text-muted-foreground capitalize">
												{selectedPreference}{" "}
												{t("magicSetup.recommendation.optimized")} •{" "}
												{t("magicSetup.recommendation.released")}{" "}
												{selectedModel.releaseDate}
											</div>
										</div>
										<div className="text-right">
											<div className="text-sm font-medium">
												{selectedModel.size}
											</div>
											<div className="text-xs text-muted-foreground">
												{selectedModel.usesWebGPU ? "WebGPU" : "CPU"}
											</div>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-3 text-sm">
										<div>
											<div className="text-muted-foreground">
												{t("magicSetup.recommendation.speed")}
											</div>
											<div className="font-medium">
												~{selectedModel.estimatedTokensPerSecond}{" "}
												{t("magicSetup.recommendation.tokensPerSec")}
											</div>
										</div>
										<div>
											<div className="text-muted-foreground">
												{t("magicSetup.recommendation.context")}
											</div>
											<div className="font-medium">
												{selectedModel.contextLength.toLocaleString()}{" "}
												{t("magicSetup.recommendation.tokens")}
											</div>
										</div>
									</div>

									<div className="pt-2 border-t">
										<div className="text-sm text-muted-foreground">
											{selectedModel.reason}
										</div>
									</div>
								</div>

								<div className="flex gap-2">
									<Button
										onClick={handleDownload}
										disabled={loading}
										className="flex-1"
									>
										{loading ? (
											<>
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />
												{t("magicSetup.recommendation.settingUp")}
											</>
										) : (
											t("magicSetup.recommendation.download")
										)}
									</Button>
									<Button
										variant="outline"
										onClick={() => setStep("preference")}
										disabled={loading}
									>
										{t("magicSetup.recommendation.change")}
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Alternative Models */}
						{recommendations[selectedPreference].alternatives.length > 0 && (
							<Card>
								<CardHeader>
									<CardTitle className="text-base">
										{t("magicSetup.recommendation.alternatives.title", {
											preference: selectedPreference,
										})}
									</CardTitle>
									<CardDescription>
										{t("magicSetup.recommendation.alternatives.description")}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{/* Filter and Sort Controls */}
									<div className="flex flex-col sm:flex-row gap-2">
										{/* Search Filter */}
										<div className="relative flex-1">
											<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
											<Input
												type="text"
												placeholder="Filter by name..."
												value={filterText}
												onChange={(e) => setFilterText(e.target.value)}
												className="pl-9"
											/>
										</div>

										{/* Sort Options */}
										<div className="flex gap-2">
											<Button
												variant={sortBy === "speed" ? "default" : "outline"}
												size="sm"
												onClick={() => setSortBy("speed")}
												className="flex-1 sm:flex-none"
											>
												<Zap className="w-4 h-4 mr-1" />
												Speed
											</Button>
											<Button
												variant={sortBy === "size" ? "default" : "outline"}
												size="sm"
												onClick={() => setSortBy("size")}
												className="flex-1 sm:flex-none"
											>
												<MemoryStick className="w-4 h-4 mr-1" />
												Size
											</Button>
											<Button
												variant={sortBy === "quality" ? "default" : "outline"}
												size="sm"
												onClick={() => setSortBy("quality")}
												className="flex-1 sm:flex-none"
											>
												<Sparkles className="w-4 h-4 mr-1" />
												Context
											</Button>
										</div>
									</div>

									{/* Results Count */}
									<div className="text-xs text-muted-foreground">
										Showing {filteredAlternatives.length} of{" "}
										{recommendations[selectedPreference].alternatives.length}{" "}
										models
									</div>

									{/* Alternatives List */}
									<div className="space-y-2">
										{filteredAlternatives.length === 0 ? (
											<div className="text-center py-8 text-muted-foreground text-sm">
												No models found matching "{filterText}"
											</div>
										) : (
											filteredAlternatives.map((altModel) => (
												<div
													key={altModel.modelId}
													onClick={() => setSelectedModel(altModel)}
													className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary ${
														selectedModel.modelId === altModel.modelId
															? "border-primary bg-primary/5"
															: ""
													}`}
												>
													<div className="flex items-center justify-between">
														<div className="flex-1">
															<div className="flex items-center gap-2">
																<div className="font-medium text-sm">
																	{altModel.displayName}
																</div>
																<div className="text-xs text-primary">
																	{altModel.providerName}
																</div>
															</div>
															<div className="text-xs text-muted-foreground mt-1">
																{altModel.size} •{" "}
																{altModel.usesWebGPU ? "WebGPU" : "CPU"} •{" "}
																{t("magicSetup.recommendation.released")}{" "}
																{altModel.releaseDate}
															</div>
														</div>
														<div className="text-right text-xs">
															<div className="font-medium">
																~{altModel.estimatedTokensPerSecond} tok/s
															</div>
															<div className="text-muted-foreground">
																{(altModel.contextLength / 1000).toFixed(0)}K
																ctx
															</div>
														</div>
													</div>
												</div>
											))
										)}
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				)}

			{/* Error Display */}
			{error && (
				<Card className="border-destructive">
					<CardContent className="pt-6">
						<div className="flex items-start gap-3">
							<AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
							<div className="space-y-2 flex-1">
								<div className="font-medium text-destructive">
									{t("magicSetup.error.title")}
								</div>
								<div className="text-sm text-muted-foreground">{error}</div>
								<div className="flex gap-2">
									<Button size="sm" variant="outline" onClick={detectSystem}>
										{t("magicSetup.error.tryAgain")}
									</Button>
									<Button size="sm" variant="outline" onClick={onCancel}>
										{t("magicSetup.error.advancedSetup")}
									</Button>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Cancel Button */}
			{step !== "detecting" && !error && (
				<Button
					variant="ghost"
					onClick={onCancel}
					className="w-full"
					disabled={loading}
				>
					{t("magicSetup.useAdvancedSetup")}
				</Button>
			)}
		</div>
	);
};
