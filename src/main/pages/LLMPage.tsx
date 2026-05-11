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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/main/components/ui/tooltip";
import { Brain, CheckCircle2, Info } from "lucide-react";
import { useCurrentModel } from "@/main/hooks/use-current-model";
import { useTranslation } from "react-i18next";
import { getModel } from "@/services/llm/registry/model-registry";
import { PageHeader } from "@/main/components/ui/page-header";

// No local quick-connect card; configuration handled in AdvancedSection

function formatTokenCount(value: number): string {
	return value.toLocaleString();
}

const PANEL_STORAGE_KEY = "memorall.llm.workspace-panels.v3";
const DEFAULT_PANEL_SIZES = [22, 78] as const;
const MIN_PANEL_SIZES = [16, 36] as const;
const DESKTOP_BREAKPOINT = 1180;
const DESKTOP_SEPARATOR_TRACK = 2;

const clampPair = (
	nextPrimary: number,
	total: number,
	minPrimary: number,
	minSecondary: number,
): [number, number] => {
	const clampedPrimary = Math.min(
		total - minSecondary,
		Math.max(minPrimary, nextPrimary),
	);
	return [clampedPrimary, total - clampedPrimary];
};

const readStoredPanelSizes = (): [number, number] => {
	if (typeof window === "undefined") return [...DEFAULT_PANEL_SIZES];
	try {
		const raw = window.localStorage.getItem(PANEL_STORAGE_KEY);
		if (!raw) return [...DEFAULT_PANEL_SIZES];
		const parsed = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.length === 2 &&
			parsed.every((value) => typeof value === "number")
		) {
			return [parsed[0], parsed[1]];
		}
	} catch {
		// Fall back to defaults when localStorage is unavailable or corrupt.
	}
	return [...DEFAULT_PANEL_SIZES];
};

export const LLMPage: React.FC = () => {
	const { t } = useTranslation("llm");
	const state = useLLMState();
	const actions = useLLMActions({
		...state,
	});
	const [panelSizes, setPanelSizes] =
		React.useState<[number, number]>(readStoredPanelSizes);
	const [isDesktop, setIsDesktop] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement | null>(null);

	const handleResizeStart = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!isDesktop || !containerRef.current) return;
			event.preventDefault();
			const startX = event.clientX;
			const startSizes = panelSizes;
			const containerWidth = containerRef.current.getBoundingClientRect().width;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			const handlePointerMove = (pointerEvent: MouseEvent) => {
				const deltaInFr =
					((pointerEvent.clientX - startX) / containerWidth) *
					(startSizes[0] + startSizes[1]);
				setPanelSizes(() => {
					const [left, right] = clampPair(
						startSizes[0] + deltaInFr,
						startSizes[0] + startSizes[1],
						MIN_PANEL_SIZES[0],
						MIN_PANEL_SIZES[1],
					);
					return [left, right];
				});
			};
			const handlePointerUp = () => {
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				window.removeEventListener("mousemove", handlePointerMove);
				window.removeEventListener("mouseup", handlePointerUp);
			};
			window.addEventListener("mousemove", handlePointerMove);
			window.addEventListener("mouseup", handlePointerUp);
		},
		[isDesktop, panelSizes],
	);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const handleViewportChange = () => {
			const isPopupSurface =
				document.documentElement.dataset.uiSurface === "popup";
			setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT && !isPopupSurface);
		};
		handleViewportChange();
		window.addEventListener("resize", handleViewportChange);
		return () => window.removeEventListener("resize", handleViewportChange);
	}, []);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panelSizes));
	}, [panelSizes]);

	// Hooks for current model display
	const { current } = useCurrentModel();
	const currentLocalModel = React.useMemo(() => {
		if (!current) {
			return null;
		}

		if (
			current.provider !== "transformer" &&
			current.provider !== "webllm" &&
			current.provider !== "wllama"
		) {
			return null;
		}

		return getModel(current.modelId, current.provider) ?? null;
	}, [current]);

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
		<div className="flex h-full flex-col overflow-auto bg-background sm:overflow-hidden">
			<div
				ref={containerRef}
				className={
					isDesktop
						? "grid min-h-0 flex-1 overflow-hidden bg-background"
						: "min-h-0 flex-1 overflow-auto bg-background"
				}
				style={
					isDesktop
						? {
								gridTemplateColumns: `${panelSizes[0]}fr ${DESKTOP_SEPARATOR_TRACK}px ${panelSizes[1]}fr`,
							}
						: undefined
				}
			>
				<aside
					className={
						isDesktop
							? "flex min-h-0 flex-col overflow-hidden bg-background"
							: "bg-background"
					}
				>
					<PageHeader
						icon={<Brain size={20} />}
						title={t("title")}
						description={t("yourModels.description")}
					/>

					<div
						className={
							isDesktop
								? "min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
								: "space-y-3 p-3"
						}
					>
						{/* Current Model Status */}
						<Card
							className="rounded-none md:rounded-lg"
							data-copilot="current-model"
						>
							<CardHeader className="p-3 pb-0">
								<CardTitle className="text-lg">
									{t("currentModel.title")}
								</CardTitle>
								<CardDescription>
									{t("currentModel.description")}
								</CardDescription>
							</CardHeader>
							<CardContent className="p-3">
								{current && current.modelId && current.modelId.trim() !== "" ? (
									<TooltipProvider>
										<div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/10 p-3">
											<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
											<div className="min-w-0 flex-1">
												<div className="flex min-w-0 items-center gap-2">
													<div className="truncate font-semibold text-foreground">
														{currentLocalModel?.displayName ?? current.modelId}
													</div>
													{currentLocalModel && (
														<Tooltip>
															<TooltipTrigger asChild>
																<button
																	type="button"
																	className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
																	aria-label={t(
																		"currentModel.details.tooltipLabel",
																	)}
																>
																	<Info className="h-4 w-4" />
																</button>
															</TooltipTrigger>
															<TooltipContent
																side="right"
																className="max-w-sm space-y-2 p-3"
															>
																<div className="font-medium">
																	{currentLocalModel.displayName}
																</div>
																<div className="break-all text-xs text-muted-foreground">
																	{currentLocalModel.id}
																</div>
																<div className="text-xs">
																	{currentLocalModel.description}
																</div>
																<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
																	<div>
																		<span className="text-muted-foreground">
																			{t("currentModel.details.provider")}
																		</span>{" "}
																		{current.provider}
																	</div>
																	<div>
																		<span className="text-muted-foreground">
																			{t("currentModel.details.size")}
																		</span>{" "}
																		{currentLocalModel.sizeLabel}
																	</div>
																	<div>
																		<span className="text-muted-foreground">
																			{t("currentModel.details.context")}
																		</span>{" "}
																		{formatTokenCount(
																			currentLocalModel.contextLength,
																		)}
																	</div>
																	<div>
																		<span className="text-muted-foreground">
																			{t("currentModel.details.output")}
																		</span>{" "}
																		{formatTokenCount(
																			currentLocalModel.defaultMaxNewTokens,
																		)}
																	</div>
																	<div>
																		<span className="text-muted-foreground">
																			{t("currentModel.details.memory")}
																		</span>{" "}
																		{currentLocalModel.minMemoryGB} GB
																	</div>
																	<div>
																		<span className="text-muted-foreground">
																			{t("currentModel.details.release")}
																		</span>{" "}
																		{currentLocalModel.releaseDate}
																	</div>
																	{currentLocalModel.provider ===
																		"transformer" &&
																		currentLocalModel.runnerConfig && (
																			<>
																				<div>
																					<span className="text-muted-foreground">
																						{t("currentModel.details.runtime")}
																					</span>{" "}
																					{
																						currentLocalModel.runnerConfig
																							.runtime
																					}
																				</div>
																				<div>
																					<span className="text-muted-foreground">
																						{t("currentModel.details.dtype")}
																					</span>{" "}
																					{currentLocalModel.runnerConfig.dtype}
																				</div>
																			</>
																		)}
																	{currentLocalModel.provider === "wllama" &&
																		currentLocalModel.wllamaConfig
																			?.filename && (
																			<div className="col-span-2 break-all">
																				<span className="text-muted-foreground">
																					{t("currentModel.details.file")}
																				</span>{" "}
																				{
																					currentLocalModel.wllamaConfig
																						.filename
																				}
																			</div>
																		)}
																</div>
															</TooltipContent>
														</Tooltip>
													)}
												</div>
												<div className="truncate text-sm text-muted-foreground">
													{currentLocalModel
														? currentLocalModel.id
														: t("currentModel.provider", {
																provider: current.provider,
															})}
												</div>
												{currentLocalModel && (
													<div className="mt-2 flex flex-wrap gap-2">
														<Badge variant="outline" className="text-xs">
															{t("currentModel.details.contextShort", {
																value: formatTokenCount(
																	currentLocalModel.contextLength,
																),
															})}
														</Badge>
														<Badge variant="outline" className="text-xs">
															{t("currentModel.details.outputShort", {
																value: formatTokenCount(
																	currentLocalModel.defaultMaxNewTokens,
																),
															})}
														</Badge>
														<Badge variant="outline" className="text-xs">
															{currentLocalModel.sizeLabel}
														</Badge>
													</div>
												)}
											</div>
											<Badge
												variant="secondary"
												className="bg-primary/10 text-primary border-primary/20"
											>
												{t("currentModel.status.active")}
											</Badge>
										</div>
									</TooltipProvider>
								) : current && current.provider ? (
									<div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950">
										<div className="h-5 w-5 rounded-full bg-orange-400 animate-pulse" />
										<div className="min-w-0 flex-1">
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
											className="border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400"
										>
											{t("currentModel.status.configured")}
										</Badge>
									</div>
								) : (
									<div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
										<div className="h-5 w-5 rounded-full bg-muted" />
										<div className="min-w-0 flex-1">
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

						<Card
							className="rounded-none md:rounded-lg"
							data-copilot="quick-setup"
						>
							<CardHeader className="p-3">
								<CardTitle className="text-lg">
									{t("yourModels.title")}
								</CardTitle>
								<CardDescription>{t("yourModels.description")}</CardDescription>
							</CardHeader>
							<CardContent className="p-3">
								<YourModels
									onModelLoaded={actions.handleModelLoaded}
									showQuickDownload={false}
								/>
							</CardContent>
						</Card>
					</div>
				</aside>

				<div
					role="separator"
					aria-orientation="vertical"
					className={
						isDesktop
							? "group relative z-10 -mx-[5px] flex w-3 cursor-col-resize items-center justify-center bg-transparent"
							: "hidden"
					}
					onMouseDown={handleResizeStart}
				>
					<div className="h-full w-px bg-border/80 transition-all group-hover:w-[2px] group-hover:bg-foreground/20" />
				</div>

				<main className={isDesktop ? "min-h-0 overflow-y-auto" : ""}>
					<div className="mx-auto w-full max-w-5xl space-y-3 px-3 pb-3 sm:p-4">
						<Card className="rounded-none md:rounded-lg">
							<CardHeader className="p-3">
								<CardTitle className="text-lg">
									{t("yourModels.quickDownload")}
								</CardTitle>
								<CardDescription>{t("yourModels.description")}</CardDescription>
							</CardHeader>
							<CardContent className="p-3">
								<YourModels
									onModelLoaded={actions.handleModelLoaded}
									showDownloadedModels={false}
								/>
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
				</main>
			</div>
		</div>
	);
};
