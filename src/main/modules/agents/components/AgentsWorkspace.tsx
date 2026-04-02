import React from "react";
import { useBeforeUnload } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RotateCcw, Save, Undo2 } from "lucide-react";
import { CreateFlowDialog } from "@/main/modules/flow-builder/components";
import { Button } from "@/main/components/ui/button";
import { TruncatedHoverText } from "./AgentHoverInfo";
import { AgentPresetList } from "./AgentPresetList";
import { AgentPresetOverview } from "./AgentPresetOverview";
import { AgentConfigForm } from "./AgentConfigForm";
import { useAgentPresets } from "../hooks/useAgentPresets";
import {
	useAgentConfigStore,
	GRAPH_REGISTRY,
} from "@/main/stores/agent-config";
import { DEFAULT_CONTEXT_SYSTEM_PROMPT } from "@/services/flows/steps/knowledge-retrieval/context-to-system";
import { DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT } from "@/services/flows/graph/knowledge-rag/state";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/main/components/ui/alert-dialog";
import { Badge } from "@/main/components/ui/badge";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/main/components/ui/tabs";
import { cn } from "@/lib/utils";
import { coerceDate, type AgentConfigSummary } from "../types";

const PANEL_STORAGE_KEY = "memorall.agents.workspace-panels.v2";
const DEFAULT_PANEL_SIZES = [18, 24, 58] as const;
const MIN_PANEL_SIZES = [16, 20, 36] as const;
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

const readStoredPanelSizes = (): [number, number, number] => {
	if (typeof window === "undefined") {
		return [...DEFAULT_PANEL_SIZES];
	}

	try {
		const raw = window.localStorage.getItem(PANEL_STORAGE_KEY);
		if (!raw) {
			return [...DEFAULT_PANEL_SIZES];
		}

		const parsed = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.length === 3 &&
			parsed.every((value) => typeof value === "number")
		) {
			return [parsed[0], parsed[1], parsed[2]];
		}
	} catch {
		// Ignore invalid persisted layouts and fall back to defaults.
	}

	return [...DEFAULT_PANEL_SIZES];
};

export const AgentsWorkspace: React.FC = () => {
	const { t } = useTranslation(["agents", "chat"]);
	const {
		filteredPresets,
		selectedPreset,
		selectedPresetId,
		searchQuery,
		metadataDraft,
		hasMetadataChanges,
		isLoading: isPresetListLoading,
		isCreating,
		isDeleting,
		isSavingMetadata,
		error,
		canDeleteSelectedPreset,
		setSearchQuery,
		selectPreset,
		updateMetadataField,
		refreshPresets,
		createPreset,
		saveMetadata,
		revertMetadata,
		deleteSelectedPreset,
	} = useAgentPresets();
	const {
		draftConfig,
		draftFeatures,
		featureDefinitions,
		availableTools,
		currentGraphType,
		initialize,
		isDirty: hasConfigChanges,
		isLoading: isConfigLoading,
		isSaving: isConfigSaving,
		save,
		revert,
		resetToDefaults,
		close,
	} = useAgentConfigStore();

	const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
	const [isSavingPage, setIsSavingPage] = React.useState(false);
	const [activeCompactTab, setActiveCompactTab] = React.useState("list");
	const [panelSizes, setPanelSizes] =
		React.useState<[number, number, number]>(readStoredPanelSizes);
	const [isDesktop, setIsDesktop] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const hasUnsavedChanges = hasMetadataChanges || hasConfigChanges;

	React.useEffect(() => {
		close();
	}, [close]);

	React.useEffect(() => {
		if (!selectedPresetId) {
			return;
		}

		void initialize(selectedPresetId);
	}, [initialize, selectedPresetId]);

	React.useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

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
		if (typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panelSizes));
	}, [panelSizes]);

	useBeforeUnload(
		React.useCallback(
			(event) => {
				if (!hasUnsavedChanges) {
					return;
				}

				event.preventDefault();
				event.returnValue = "";
			},
			[hasUnsavedChanges],
		),
	);

	React.useEffect(() => {
		if (!hasUnsavedChanges) {
			return;
		}

		const handleAnchorNavigation = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.altKey ||
				event.ctrlKey ||
				event.shiftKey
			) {
				return;
			}

			const target = event.target;
			if (!(target instanceof Element)) {
				return;
			}

			const anchor = target.closest("a[href]");
			if (
				!(anchor instanceof HTMLAnchorElement) ||
				anchor.target === "_blank"
			) {
				return;
			}

			const nextUrl = new URL(anchor.href, window.location.href);
			const currentUrl = new URL(window.location.href);
			const isSameLocation =
				nextUrl.pathname === currentUrl.pathname &&
				nextUrl.search === currentUrl.search &&
				nextUrl.hash === currentUrl.hash;

			if (nextUrl.origin !== currentUrl.origin || isSameLocation) {
				return;
			}

			if (!window.confirm(t("agents:confirm.leavePage"))) {
				event.preventDefault();
				event.stopPropagation();
			}
		};

		document.addEventListener("click", handleAnchorNavigation, true);
		return () =>
			document.removeEventListener("click", handleAnchorNavigation, true);
	}, [hasUnsavedChanges, t]);

	const handleResizeStart = React.useCallback(
		(handleIndex: 0 | 1) => (event: React.MouseEvent<HTMLDivElement>) => {
			if (!isDesktop || !containerRef.current) {
				return;
			}

			event.preventDefault();
			const startX = event.clientX;
			const startSizes = panelSizes;
			const containerWidth = containerRef.current.getBoundingClientRect().width;

			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";

			const handlePointerMove = (pointerEvent: MouseEvent) => {
				const deltaInFr =
					((pointerEvent.clientX - startX) / containerWidth) *
					(startSizes[0] + startSizes[1] + startSizes[2]);

				setPanelSizes(() => {
					if (handleIndex === 0) {
						const total = startSizes[0] + startSizes[1];
						const [left, center] = clampPair(
							startSizes[0] + deltaInFr,
							total,
							MIN_PANEL_SIZES[0],
							MIN_PANEL_SIZES[1],
						);
						return [left, center, startSizes[2]];
					}

					const total = startSizes[1] + startSizes[2];
					const [center, right] = clampPair(
						startSizes[1] + deltaInFr,
						total,
						MIN_PANEL_SIZES[1],
						MIN_PANEL_SIZES[2],
					);
					return [startSizes[0], center, right];
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

	const configSummary = React.useMemo<AgentConfigSummary | null>(() => {
		if (!selectedPreset) {
			return null;
		}

		const graphMeta = GRAPH_REGISTRY.find(
			(graph) => graph.id === currentGraphType,
		);
		const enabledFeatureLabels = featureDefinitions.flatMap((feature) => {
			if (feature.type === "config") {
				if (feature.configKey === "tools") {
					return [];
				}
				return draftConfig[feature.configKey]
					? [t(feature.nameKey, { ns: "chat" })]
					: [];
			}

			return draftFeatures[feature.name] ? [feature.name] : [];
		});
		const enabledToolSet = new Set(draftConfig.tools);

		for (const feature of featureDefinitions) {
			if (feature.type === "config") {
				if (feature.configKey === "tools" || !draftConfig[feature.configKey]) {
					continue;
				}
			} else if (!draftFeatures[feature.name]) {
				continue;
			}

			for (const tool of feature.tools) {
				enabledToolSet.add(tool);
			}
		}

		const availableToolSet = new Set(availableTools);
		const enabledToolNames = [
			...availableTools.filter((tool) => enabledToolSet.has(tool)),
			...Array.from(enabledToolSet).filter(
				(tool) => !availableToolSet.has(tool),
			),
		];
		const systemPromptPreview =
			draftConfig.systemPrompt || DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT;
		const contextPromptPreview =
			draftConfig.contextPrompt || DEFAULT_CONTEXT_SYSTEM_PROMPT;

		return {
			graphLabel: graphMeta
				? t(graphMeta.nameKey, { ns: "chat" })
				: t("agents:summary.unknownGraph"),
			enabledFeatureCount: enabledFeatureLabels.length,
			enabledFeatureLabels,
			enabledToolCount: enabledToolNames.length,
			enabledToolNames,
			systemPromptPreview,
			contextPromptPreview,
			systemPromptLength: systemPromptPreview.length,
			contextPromptLength: contextPromptPreview.length,
			hasCustomSystemPrompt: draftConfig.systemPrompt.trim().length > 0,
			hasCustomContextPrompt: draftConfig.contextPrompt.trim().length > 0,
			lastUpdatedAt: coerceDate(selectedPreset.updatedAt),
		};
	}, [
		availableTools,
		currentGraphType,
		draftConfig.contextPrompt,
		draftConfig.enableCitations,
		draftConfig.enableContextRetrieval,
		draftConfig.systemPrompt,
		draftConfig.tools,
		draftFeatures,
		featureDefinitions,
		selectedPreset,
		t,
	]);

	const canSave =
		Boolean(selectedPresetId) &&
		Boolean(metadataDraft.name.trim()) &&
		(hasMetadataChanges || hasConfigChanges) &&
		!isSavingPage &&
		!isSavingMetadata &&
		!isConfigSaving;

	const handlePresetSelection = React.useCallback(
		(presetId: string) => {
			if (presetId === selectedPresetId) {
				return;
			}

			if (
				hasUnsavedChanges &&
				!window.confirm(t("agents:confirm.discardSelection"))
			) {
				return;
			}

			selectPreset(presetId);
			if (!isDesktop) {
				setActiveCompactTab("overview");
			}
		},
		[hasUnsavedChanges, isDesktop, selectPreset, selectedPresetId, t],
	);

	const handleCreatePreset = React.useCallback(
		async (name: string) => {
			if (
				hasUnsavedChanges &&
				!window.confirm(t("agents:confirm.discardSelection"))
			) {
				return;
			}

			await createPreset(name);
			if (!isDesktop) {
				setActiveCompactTab("config");
			}
		},
		[createPreset, hasUnsavedChanges, isDesktop, t],
	);

	const handleSavePage = React.useCallback(async () => {
		if (!canSave || !selectedPresetId) {
			return;
		}

		setIsSavingPage(true);
		try {
			if (hasMetadataChanges) {
				await saveMetadata();
			}

			if (hasConfigChanges) {
				await save();
			}

			await refreshPresets(selectedPresetId);
		} finally {
			setIsSavingPage(false);
		}
	}, [
		canSave,
		hasConfigChanges,
		hasMetadataChanges,
		refreshPresets,
		save,
		saveMetadata,
		selectedPresetId,
	]);

	const handleRevertPage = React.useCallback(() => {
		revertMetadata();
		revert();
	}, [revert, revertMetadata]);

	const handleDeletePreset = React.useCallback(async () => {
		await deleteSelectedPreset();
	}, [deleteSelectedPreset]);

	const isBusy =
		isPresetListLoading ||
		isConfigLoading ||
		isCreating ||
		isDeleting ||
		isSavingMetadata ||
		isConfigSaving ||
		isSavingPage;

	const listSection = (
		<section
			className={cn(
				"min-h-0",
				isDesktop ? "overflow-hidden bg-background" : "",
			)}
		>
			<AgentPresetList
				presets={filteredPresets}
				selectedPresetId={selectedPresetId}
				searchQuery={searchQuery}
				isLoading={isPresetListLoading}
				isCreating={isCreating}
				scrollMode={isDesktop ? "contained" : "page"}
				onSearchChange={setSearchQuery}
				onSelectPreset={handlePresetSelection}
				onCreatePreset={() => setIsCreateDialogOpen(true)}
			/>
		</section>
	);

	const overviewSection = (
		<section
			className={cn(
				"min-h-0",
				isDesktop ? "overflow-hidden bg-background" : "",
			)}
		>
			<AgentPresetOverview
				selectedPreset={selectedPreset}
				metadataDraft={metadataDraft}
				configSummary={configSummary}
				hasMetadataChanges={hasMetadataChanges}
				hasConfigChanges={hasConfigChanges}
				canDeletePreset={canDeleteSelectedPreset}
				isDeleting={isDeleting}
				scrollMode={isDesktop ? "contained" : "page"}
				onMetadataChange={updateMetadataField}
				onDeletePreset={handleDeletePreset}
			/>
		</section>
	);

	const configSection = (
		<section
			className={cn(
				"min-h-0",
				isDesktop ? "overflow-hidden bg-background" : "",
			)}
		>
			<div className={cn("flex flex-col", isDesktop ? "h-full min-h-0" : "")}>
				<div className="border-b bg-gradient-to-r from-background via-background to-muted/30 px-4 py-4 sm:px-5">
					<div className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
						<div className="min-w-0 space-y-1.5">
							<p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
								{t("config.eyebrow")}
							</p>
							<TruncatedHoverText
								as="h2"
								text={t("config.title")}
								className="text-lg font-semibold"
							/>
							<TruncatedHoverText
								as="p"
								text={t("config.subtitle")}
								className="text-sm text-muted-foreground"
							/>
						</div>
						<Badge variant="outline" className="shrink-0">
							{hasConfigChanges
								? t("workspace.configUnsaved")
								: t("workspace.configSaved")}
						</Badge>
					</div>
				</div>
				{selectedPreset ? (
					<div
						className={cn(isDesktop ? "flex-1 min-h-0 overflow-y-auto" : "")}
					>
						<AgentConfigForm className="p-4 sm:p-5" summary={configSummary} />
					</div>
				) : (
					<div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
						{t("overview.emptyDescription")}
					</div>
				)}
			</div>
		</section>
	);

	return (
		<div
			className={cn(
				"flex flex-col bg-background",
				isDesktop ? "h-full min-h-0" : "min-h-full",
			)}
		>
			<div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
				<div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
					<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
						<div className="space-y-1">
							<div className="flex items-center gap-2">
								<h1 className="text-2xl font-semibold">{t("title")}</h1>
								{hasUnsavedChanges ? (
									<Badge variant="secondary">{t("workspace.unsaved")}</Badge>
								) : (
									<Badge variant="outline">{t("workspace.saved")}</Badge>
								)}
							</div>
							<p className="max-w-3xl text-sm text-muted-foreground">
								{t("subtitle")}
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={!selectedPresetId}
									>
										<RotateCcw size={14} className="mr-1.5" />
										{t("actions.resetConfig")}
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>{t("reset.title")}</AlertDialogTitle>
										<AlertDialogDescription>
											{t("reset.description")}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
										<AlertDialogAction onClick={resetToDefaults}>
											{t("actions.resetConfig")}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>

							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleRevertPage}
								disabled={!hasUnsavedChanges || !selectedPresetId || isBusy}
							>
								<Undo2 size={14} className="mr-1.5" />
								{t("actions.revert")}
							</Button>

							<Button
								type="button"
								size="sm"
								onClick={handleSavePage}
								disabled={!canSave}
							>
								<Save size={14} className="mr-1.5" />
								{isBusy ? t("actions.saving") : t("actions.save")}
							</Button>
						</div>
					</div>

					{error ? (
						<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
							{error}
						</div>
					) : null}
				</div>
			</div>

			<div
				className={cn(isDesktop ? "flex-1 min-h-0 overflow-hidden" : "pb-4")}
			>
				{isDesktop ? (
					<div
						ref={containerRef}
						className="grid h-full min-h-0 bg-background"
						style={{
							gridTemplateColumns: `${panelSizes[0]}fr ${DESKTOP_SEPARATOR_TRACK}px ${panelSizes[1]}fr ${DESKTOP_SEPARATOR_TRACK}px ${panelSizes[2]}fr`,
						}}
					>
						{listSection}
						<div
							role="separator"
							aria-orientation="vertical"
							className="group relative z-10 -mx-[5px] flex w-3 cursor-col-resize items-center justify-center bg-transparent"
							onMouseDown={handleResizeStart(0)}
						>
							<div className="h-full w-px bg-border/80 transition-all group-hover:w-[2px] group-hover:bg-foreground/20" />
						</div>
						{overviewSection}
						<div
							role="separator"
							aria-orientation="vertical"
							className="group relative z-10 -mx-[5px] flex w-3 cursor-col-resize items-center justify-center bg-transparent"
							onMouseDown={handleResizeStart(1)}
						>
							<div className="h-full w-px bg-border/80 transition-all group-hover:w-[2px] group-hover:bg-foreground/20" />
						</div>
						{configSection}
					</div>
				) : (
					<Tabs
						value={activeCompactTab}
						onValueChange={setActiveCompactTab}
						className="flex flex-col"
					>
						<div className="border-b bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
							<TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
								<TabsTrigger value="list" className="text-xs sm:text-sm">
									{t("list.title")}
								</TabsTrigger>
								<TabsTrigger value="overview" className="text-xs sm:text-sm">
									{t("overview.eyebrow")}
								</TabsTrigger>
								<TabsTrigger value="config" className="text-xs sm:text-sm">
									{t("config.title")}
								</TabsTrigger>
							</TabsList>
						</div>
						<TabsContent value="list" className="mt-0">
							{listSection}
						</TabsContent>
						<TabsContent value="overview" className="mt-0">
							{overviewSection}
						</TabsContent>
						<TabsContent value="config" className="mt-0">
							{configSection}
						</TabsContent>
					</Tabs>
				)}
			</div>

			<CreateFlowDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onCreateFlow={(name) => void handleCreatePreset(name)}
				title={t("createDialog.title")}
				description={t("createDialog.description")}
				namePlaceholder={t("createDialog.namePlaceholder")}
				submitLabel={t("actions.create")}
			/>
		</div>
	);
};
