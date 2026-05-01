import React from "react";
import { useBeforeUnload } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CreateFlowDialog } from "@/main/modules/flow-builder/components";
import {
	AgentWizardChatPanel,
	AgentWizardTemplatePanel,
	useAgentWizard,
} from "@/main/modules/agent-wizard";
import type { AgentWizardDraft } from "@/main/modules/agent-wizard";
import { AgentPresetList } from "./AgentPresetList";
import { AgentConfigForm } from "./AgentConfigForm";
import type { AgentConfigFormActions } from "./AgentConfigForm";
import { useAgentPresets } from "../hooks/use-agent-presets";
import {
	useAgentConfigStore,
	GRAPH_REGISTRY,
	getDefaultSystemPromptForGraph,
} from "@/main/stores/agent-config";
import { DEFAULT_CONTEXT_SYSTEM_PROMPT } from "@/services/flows/steps/common/context-to-system";
import { MULTI_AGENT_FEATURE_NAME } from "@/services/flows/steps/features/multi-agent-feature";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/main/components/ui/tabs";
import { Label } from "@/main/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import { cn } from "@/lib/utils";
import { serviceManager } from "@/services";
import { coerceDate, type AgentConfigSummary } from "../types";
import { getAgentFeatureDisplayName } from "../utils/feature-display";
import { topicService } from "@/main/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/types";
import {
	DEFAULT_GROW_TYPE,
	DEFAULT_RECALL_TYPE,
	GROW_TYPES,
	getValidRecallTypes,
	type GrowType,
	type RecallType,
} from "@/services/database/entities/topic-types";

const PANEL_STORAGE_KEY = "memorall.agents.workspace-panels.v3";
const DEFAULT_PANEL_SIZES = [22, 78] as const;
const MIN_PANEL_SIZES = [16, 36] as const;
const DESKTOP_BREAKPOINT = 1180;
const DESKTOP_SEPARATOR_TRACK = 2;

const GROW_LABELS: Record<GrowType, string> = {
	"knowledge-graph": "Knowledge Graph",
	structmem: "StructMem",
};

const RECALL_LABELS: Record<RecallType, string> = {
	smart: "Smart",
	quick: "Quick",
	llm: "LLM",
	structmem: "StructMem",
};

type CreateAgentTopicOptions = {
	growType: GrowType;
	recallType: RecallType;
};

type CreateAgentOptions = CreateAgentTopicOptions & {
	status?: AgentWizardDraft["status"];
};

const AgentMemoryTypeFields: React.FC<{
	resetToken: number;
	setExtra: (extra: CreateAgentTopicOptions) => void;
}> = ({ resetToken, setExtra }) => {
	const { t } = useTranslation("topics");
	const [growType, setGrowType] = React.useState<GrowType>(DEFAULT_GROW_TYPE);
	const [recallType, setRecallType] =
		React.useState<RecallType>(DEFAULT_RECALL_TYPE);

	React.useEffect(() => {
		setGrowType(DEFAULT_GROW_TYPE);
		setRecallType(DEFAULT_RECALL_TYPE);
	}, [resetToken]);

	React.useEffect(() => {
		setExtra({ growType, recallType });
	}, [growType, recallType, setExtra]);

	const validRecallTypes = getValidRecallTypes(growType);

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<div className="space-y-2">
				<Label>{t("types.growType")}</Label>
				<Select
					value={growType}
					onValueChange={(value) => {
						const nextGrowType = value as GrowType;
						const nextRecallTypes = getValidRecallTypes(nextGrowType);
						setGrowType(nextGrowType);
						setRecallType((current) =>
							nextRecallTypes.includes(current) ? current : nextRecallTypes[0],
						);
					}}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{GROW_TYPES.map((type) => (
							<SelectItem key={type} value={type}>
								{GROW_LABELS[type]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<Label>{t("types.recallType")}</Label>
				<Select
					value={recallType}
					onValueChange={(value) => setRecallType(value as RecallType)}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{validRecallTypes.map((type) => (
							<SelectItem key={type} value={type}>
								{RECALL_LABELS[type]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
};

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
			parsed.every((v) => typeof v === "number")
		) {
			return [parsed[0], parsed[1]];
		}
	} catch {
		// ignore
	}
	return [...DEFAULT_PANEL_SIZES];
};

export const AgentsWorkspace: React.FC = () => {
	const { t } = useTranslation(["agents", "chat", "common"]);
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
		draftMultiAgentAccessibleAgentIds,
		draftMCPServers,
		draftEnabledSkillNames,
		featureDefinitions,
		availableTools,
		currentGraphType,
		initialize,
		isLegacyConfig,
		isDirty: hasConfigChanges,
		isLoading: isConfigLoading,
		isSaving: isConfigSaving,
		setGraphType,
		updateField,
		setKnowledgeRetrievalMode,
		setEnabledSkills,
		setMCPServers,
		setAccessibleAgents,
		toggleFeature,
		save,
		revert,
		resetToDefaults,
		close,
	} = useAgentConfigStore();

	const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
	const [isAgentWizardMode, setIsAgentWizardMode] = React.useState(false);
	const [isWizardTemplateChooserOpen, setIsWizardTemplateChooserOpen] =
		React.useState(false);
	const [isSavingPage, setIsSavingPage] = React.useState(false);
	const [activeCompactTab, setActiveCompactTab] = React.useState("list");
	const [panelSizes, setPanelSizes] =
		React.useState<[number, number]>(readStoredPanelSizes);
	const [isDesktop, setIsDesktop] = React.useState(false);
	const [memoryTopic, setMemoryTopic] = React.useState<Topic | null>(null);
	const [draftMemoryOptions, setDraftMemoryOptions] =
		React.useState<CreateAgentTopicOptions>({
			growType: DEFAULT_GROW_TYPE,
			recallType: DEFAULT_RECALL_TYPE,
		});
	const [wizardInitialDraft, setWizardInitialDraft] =
		React.useState<AgentWizardDraft | null>(null);
	const [wizardInitialMessage, setWizardInitialMessage] = React.useState<
		string | undefined
	>(undefined);
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const hasUnsavedChanges = hasMetadataChanges || hasConfigChanges;

	React.useEffect(() => {
		close();
	}, [close]);

	React.useEffect(() => {
		if (!selectedPresetId) return;
		void initialize(selectedPresetId);
	}, [initialize, selectedPresetId]);

	React.useEffect(() => {
		let cancelled = false;

		const loadMemoryTopic = async () => {
			if (!selectedPresetId) {
				setMemoryTopic(null);
				return;
			}

			try {
				const topic = await topicService.getTopicByAgentId(selectedPresetId);
				if (!cancelled) setMemoryTopic(topic);
			} catch {
				if (!cancelled) setMemoryTopic(null);
			}
		};

		void loadMemoryTopic();
		return () => {
			cancelled = true;
		};
	}, [selectedPresetId]);

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

	useBeforeUnload(
		React.useCallback(
			(event) => {
				if (!hasUnsavedChanges) return;
				event.preventDefault();
				event.returnValue = "";
			},
			[hasUnsavedChanges],
		),
	);

	React.useEffect(() => {
		if (!hasUnsavedChanges) return;
		const handleAnchorNavigation = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.altKey ||
				event.ctrlKey ||
				event.shiftKey
			)
				return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest("a[href]");
			if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank")
				return;
			const nextUrl = new URL(anchor.href, window.location.href);
			const currentUrl = new URL(window.location.href);
			const isSameLocation =
				nextUrl.pathname === currentUrl.pathname &&
				nextUrl.search === currentUrl.search &&
				nextUrl.hash === currentUrl.hash;
			if (nextUrl.origin !== currentUrl.origin || isSameLocation) return;
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

	const configSummary = React.useMemo<AgentConfigSummary | null>(() => {
		if (!selectedPreset) return null;
		const graphMeta = GRAPH_REGISTRY.find((g) => g.id === currentGraphType);
		const enabledFeatureLabels = featureDefinitions.flatMap((feature) => {
			if (feature.type === "config") {
				if (feature.configKey === "tools") return [];
				return draftConfig[feature.configKey]
					? [t(feature.nameKey, { ns: "chat" })]
					: [];
			}
			if (!draftFeatures[feature.name]) return [];
			return [getAgentFeatureDisplayName(feature, t)];
		});
		const enabledToolSet = new Set(draftConfig.tools);
		for (const feature of featureDefinitions) {
			if (feature.type === "config") {
				if (feature.configKey === "tools" || !draftConfig[feature.configKey])
					continue;
			} else if (!draftFeatures[feature.name]) {
				continue;
			} else if (
				feature.name === MULTI_AGENT_FEATURE_NAME &&
				draftMultiAgentAccessibleAgentIds.length === 0
			) {
				continue;
			}
			for (const tool of feature.tools) enabledToolSet.add(tool);
		}
		const availableToolSet = new Set(availableTools);
		const enabledToolNames = [
			...availableTools.filter((t) => enabledToolSet.has(t)),
			...Array.from(enabledToolSet).filter((t) => !availableToolSet.has(t)),
		];
		const systemPromptPreview =
			draftConfig.systemPrompt ||
			getDefaultSystemPromptForGraph(currentGraphType);
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
		draftMultiAgentAccessibleAgentIds,
		featureDefinitions,
		selectedPreset,
		t,
	]);

	const isBusy =
		isPresetListLoading ||
		isConfigLoading ||
		isCreating ||
		isDeleting ||
		isSavingMetadata ||
		isConfigSaving ||
		isSavingPage;

	const canSave =
		Boolean(selectedPresetId) &&
		Boolean(metadataDraft.name.trim()) &&
		(hasMetadataChanges ||
			hasConfigChanges ||
			metadataDraft.status === "draft") &&
		!isLegacyConfig &&
		!isBusy;

	const handlePresetSelection = React.useCallback(
		(presetId: string) => {
			if (presetId === selectedPresetId) return;
			if (
				hasUnsavedChanges &&
				!window.confirm(t("agents:confirm.discardSelection"))
			)
				return;
			selectPreset(presetId);
			if (!isDesktop) setActiveCompactTab("config");
		},
		[hasUnsavedChanges, isDesktop, selectPreset, selectedPresetId, t],
	);

	const handleCreatePreset = React.useCallback(
		async (name: string, options?: CreateAgentOptions) => {
			if (
				hasUnsavedChanges &&
				!window.confirm(t("agents:confirm.discardSelection"))
			)
				return null;
			const created = await createPreset(
				name,
				options ?? {
					growType: DEFAULT_GROW_TYPE,
					recallType: DEFAULT_RECALL_TYPE,
					status: "active",
				},
			);
			if (!isDesktop) setActiveCompactTab("config");
			return created;
		},
		[createPreset, hasUnsavedChanges, isDesktop, t],
	);

	const applyWizardDraftToEditor = React.useCallback(
		(draft: AgentWizardDraft) => {
			setIsWizardTemplateChooserOpen(false);
			updateMetadataField("name", draft.name || "Draft agent");
			updateMetadataField("description", draft.description);
			updateMetadataField("status", draft.status);

			const state = useAgentConfigStore.getState();
			if (state.currentGraphType !== draft.graphType) {
				setGraphType(draft.graphType);
			}

			const nextState = useAgentConfigStore.getState();
			nextState.updateField("systemPrompt", draft.systemPrompt);
			nextState.updateField("contextPrompt", draft.contextPrompt);
			nextState.updateField("tools", draft.enabledToolNames);
			nextState.updateField(
				"enableContextRetrieval",
				draft.enabledFeatureNames.includes("knowledge-retrieval") ||
					Boolean(draft.contextPrompt.trim()),
			);
			nextState.updateField(
				"enableCitations",
				draft.enabledFeatureNames.includes("citations"),
			);
			setKnowledgeRetrievalMode(draft.recallType);
			setDraftMemoryOptions({
				growType: draft.growType,
				recallType: draft.recallType,
			});
			setEnabledSkills(draft.enabledSkillNames);
			setMCPServers(draft.mcpServers);
			setAccessibleAgents(draft.multiAgentAccessibleAgentIds);

			const enabledFeatures = new Set(draft.enabledFeatureNames);
			for (const feature of useAgentConfigStore.getState().featureDefinitions) {
				if (feature.type !== "catalog") continue;
				const shouldEnable = enabledFeatures.has(feature.name);
				if (
					Boolean(
						useAgentConfigStore.getState().draftFeatures[feature.name],
					) !== shouldEnable
				) {
					toggleFeature(feature.name);
				}
			}
		},
		[
			setAccessibleAgents,
			setEnabledSkills,
			setGraphType,
			setKnowledgeRetrievalMode,
			setMCPServers,
			toggleFeature,
			updateMetadataField,
		],
	);

	const buildCurrentAgentWizardDraft =
		React.useCallback((): AgentWizardDraft => {
			const enabledFeatureNames = new Set<string>();
			if (
				draftConfig.enableContextRetrieval ||
				draftConfig.contextPrompt.trim()
			) {
				enabledFeatureNames.add("knowledge-retrieval");
			}
			if (draftConfig.enableCitations) {
				enabledFeatureNames.add("citations");
			}
			if (
				draftConfig.tools.length > 0 ||
				draftMultiAgentAccessibleAgentIds.length > 0
			) {
				enabledFeatureNames.add("agent-node");
			}
			for (const [featureName, enabled] of Object.entries(draftFeatures)) {
				if (enabled) enabledFeatureNames.add(featureName);
			}

			return {
				name: metadataDraft.name,
				description: metadataDraft.description,
				status: metadataDraft.status,
				graphType: currentGraphType,
				systemPrompt: draftConfig.systemPrompt,
				contextPrompt: draftConfig.contextPrompt,
				enabledFeatureNames: [...enabledFeatureNames],
				enabledToolNames: [...draftConfig.tools],
				enabledSkillNames: [...draftEnabledSkillNames],
				mcpServers: [...draftMCPServers],
				multiAgentAccessibleAgentIds: [...draftMultiAgentAccessibleAgentIds],
				growType: draftMemoryOptions.growType,
				recallType: draftMemoryOptions.recallType,
				templateId: null,
			};
		}, [
			currentGraphType,
			draftConfig.contextPrompt,
			draftConfig.enableCitations,
			draftConfig.enableContextRetrieval,
			draftConfig.systemPrompt,
			draftConfig.tools,
			draftEnabledSkillNames,
			draftFeatures,
			draftMCPServers,
			draftMemoryOptions.growType,
			draftMemoryOptions.recallType,
			draftMultiAgentAccessibleAgentIds,
			metadataDraft.description,
			metadataDraft.name,
			metadataDraft.status,
		]);

	const handleOpenAgentWizard = React.useCallback(async () => {
		setWizardInitialDraft(null);
		setWizardInitialMessage(undefined);
		const created = await handleCreatePreset("Draft agent", {
			growType: DEFAULT_GROW_TYPE,
			recallType: DEFAULT_RECALL_TYPE,
			status: "draft",
		});
		if (!created) return;
		await refreshPresets(created.id);
		setIsAgentWizardMode(true);
		setIsWizardTemplateChooserOpen(true);
		updateMetadataField("status", "draft");
		if (!isDesktop) setActiveCompactTab("config");
	}, [handleCreatePreset, isDesktop, refreshPresets, updateMetadataField]);

	const handleOptimizeCurrentAgent = React.useCallback(() => {
		if (!selectedPresetId || isLegacyConfig || isBusy) return;
		setWizardInitialDraft(buildCurrentAgentWizardDraft());
		setWizardInitialMessage(
			"Tell me how you want to improve this agent. I already loaded the current agent configuration, so I can update its name, description, instructions, skills, features, tools, and memory settings directly.",
		);
		setIsAgentWizardMode(true);
		setIsWizardTemplateChooserOpen(false);
		if (!isDesktop) setActiveCompactTab("list");
	}, [
		buildCurrentAgentWizardDraft,
		isBusy,
		isDesktop,
		isLegacyConfig,
		selectedPresetId,
	]);

	const handleWizardCreated = React.useCallback(
		async (flowId: string) => {
			await refreshPresets(flowId);
			setIsAgentWizardMode(false);
			if (!isDesktop) setActiveCompactTab("config");
		},
		[isDesktop, refreshPresets],
	);

	const agentWizard = useAgentWizard({
		open: isAgentWizardMode,
		createPreset: handleCreatePreset,
		onCreated: handleWizardCreated,
		onClose: () => {
			setIsAgentWizardMode(false);
			setIsWizardTemplateChooserOpen(false);
			setWizardInitialDraft(null);
			setWizardInitialMessage(undefined);
		},
		onDraftChange: applyWizardDraftToEditor,
		initialDraft: wizardInitialDraft,
		initialAssistantMessage: wizardInitialMessage,
	});

	const handleSelectWizardTemplate = React.useCallback(
		(template: Parameters<typeof agentWizard.applyTemplate>[0]) => {
			agentWizard.applyTemplate(template);
			setIsWizardTemplateChooserOpen(false);
		},
		[agentWizard],
	);

	const handleSavePage = React.useCallback(async () => {
		if (!canSave || !selectedPresetId) return;
		setIsSavingPage(true);
		try {
			const isPublishingDraft = metadataDraft.status === "draft";
			if (hasMetadataChanges || isPublishingDraft) {
				await serviceManager.flowBuilderService.updateFlowMetadata(
					selectedPresetId,
					{
						name: metadataDraft.name,
						description: metadataDraft.description,
						status: isPublishingDraft ? "active" : metadataDraft.status,
					},
				);
			}
			if (hasConfigChanges) await save();
			if (isPublishingDraft) {
				const existingTopic =
					await topicService.getTopicByAgentId(selectedPresetId);
				if (!existingTopic) {
					const createdTopic = await topicService.createTopic({
						name: metadataDraft.name,
						description: metadataDraft.description,
						agentId: selectedPresetId,
						growType: draftMemoryOptions.growType,
						recallType: draftMemoryOptions.recallType,
					});
					setMemoryTopic(createdTopic);
				} else {
					setMemoryTopic(existingTopic);
				}
				updateMetadataField("status", "active");
			}
			await refreshPresets(selectedPresetId);
		} finally {
			setIsSavingPage(false);
		}
	}, [
		canSave,
		draftMemoryOptions.growType,
		draftMemoryOptions.recallType,
		hasConfigChanges,
		hasMetadataChanges,
		metadataDraft.description,
		metadataDraft.name,
		metadataDraft.status,
		refreshPresets,
		save,
		selectedPresetId,
		updateMetadataField,
	]);

	const handleRevertPage = React.useCallback(() => {
		revertMetadata();
		revert();
	}, [revert, revertMetadata]);

	const handleDeletePreset = React.useCallback(async () => {
		await deleteSelectedPreset();
	}, [deleteSelectedPreset]);

	const formActions: AgentConfigFormActions | undefined = selectedPreset
		? {
				canSave,
				isBusy,
				hasUnsavedChanges,
				saveLabel: metadataDraft.status === "draft" ? "Submit" : undefined,
				canOptimize: Boolean(selectedPresetId) && !isLegacyConfig && !isBusy,
				onOptimize: handleOptimizeCurrentAgent,
				canDelete: canDeleteSelectedPreset,
				isDeleting,
				onSave: () => void handleSavePage(),
				onRevert: handleRevertPage,
				onDelete: () => void handleDeletePreset(),
				onResetConfig: resetToDefaults,
			}
		: undefined;

	// ── Panel sections ────────────────────────────────────────────────────────
	const listSection = (
		<section
			className={cn(
				"min-h-0",
				isDesktop ? "overflow-hidden bg-background" : "",
			)}
		>
			{isAgentWizardMode ? (
				<AgentWizardChatPanel
					messages={agentWizard.messages}
					inputValue={agentWizard.inputValue}
					onInputChange={agentWizard.setInputValue}
					onSubmit={agentWizard.submitMessage}
					onStop={agentWizard.stop}
					onBack={agentWizard.requestClose}
					isStreaming={agentWizard.isStreaming}
					isModelReady={agentWizard.isModelReady}
				/>
			) : (
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
					onOpenAgentWizard={() => void handleOpenAgentWizard()}
				/>
			)}
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
				{isAgentWizardMode ? (
					<div
						className={cn("min-h-0", isDesktop ? "flex-1 overflow-y-auto" : "")}
					>
						{isWizardTemplateChooserOpen ? (
							<AgentWizardTemplatePanel
								templates={agentWizard.templates}
								selectedTemplateId={agentWizard.draft.templateId}
								onSelectTemplate={handleSelectWizardTemplate}
								error={agentWizard.error}
							/>
						) : selectedPreset ? (
							<AgentConfigForm
								className="p-4 sm:p-5"
								metadataDraft={metadataDraft}
								configSummary={configSummary}
								memoryTopic={memoryTopic}
								onMetadataChange={updateMetadataField}
								formActions={formActions}
							/>
						) : (
							<div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
								Creating draft agent...
							</div>
						)}
					</div>
				) : (
					<>
						{selectedPreset ? (
							<div
								className={cn(
									isDesktop ? "flex-1 min-h-0 overflow-y-auto" : "",
								)}
							>
								{error ? (
									<div className="px-4 pt-4 max-w-3xl mx-auto">
										<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
											{error}
										</div>
									</div>
								) : null}
								<AgentConfigForm
									className="p-4 sm:p-5"
									metadataDraft={metadataDraft}
									configSummary={configSummary}
									memoryTopic={memoryTopic}
									onMetadataChange={updateMetadataField}
									formActions={formActions}
								/>
							</div>
						) : (
							<div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
								{t("overview.emptyDescription")}
							</div>
						)}
					</>
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
			<div
				className={cn(isDesktop ? "flex-1 min-h-0 overflow-hidden" : "pb-4")}
			>
				{isDesktop ? (
					<div
						ref={containerRef}
						className="grid h-full min-h-0 bg-background"
						style={{
							gridTemplateColumns: `${panelSizes[0]}fr ${DESKTOP_SEPARATOR_TRACK}px ${panelSizes[1]}fr`,
						}}
					>
						{listSection}
						<div
							role="separator"
							aria-orientation="vertical"
							className="group relative z-10 -mx-[5px] flex w-3 cursor-col-resize items-center justify-center bg-transparent"
							onMouseDown={handleResizeStart}
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
							<TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
								<TabsTrigger value="list" className="text-xs sm:text-sm">
									{t("list.title")}
								</TabsTrigger>
								<TabsTrigger value="config" className="text-xs sm:text-sm">
									{t("config.title")}
								</TabsTrigger>
							</TabsList>
						</div>
						<TabsContent value="list" className="mt-0">
							{listSection}
						</TabsContent>
						<TabsContent value="config" className="mt-0">
							{configSection}
						</TabsContent>
					</Tabs>
				)}
			</div>

			<CreateFlowDialog<CreateAgentTopicOptions>
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onCreateFlow={(name, options) => void handleCreatePreset(name, options)}
				title={t("createDialog.title")}
				description={t("createDialog.description")}
				namePlaceholder={t("createDialog.namePlaceholder")}
				submitLabel={t("actions.create")}
			>
				{({ resetToken, setExtra }) => (
					<AgentMemoryTypeFields resetToken={resetToken} setExtra={setExtra} />
				)}
			</CreateFlowDialog>
		</div>
	);
};
