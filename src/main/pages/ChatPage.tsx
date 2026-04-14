"use client";
import React, { useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/main/components/ui/shadcn-io/ai/conversation";
import {
	LoadingScreen,
	NoModelsScreen,
	ChatInput,
	useCurrentModel,
	useChat,
} from "@/main/modules/chat/components";
import { MessageGroup } from "@/main/modules/chat/components/MessageGroup";
import { groupMessagesBySeparators } from "@/main/modules/chat/utils/message-grouping";
import { topicService } from "@/main/modules/topics/services/topic-service";
import { AgentSettingsPanel } from "@/main/modules/chat/components/AgentSettingsPanel";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import {
	useDownloadProgress,
	ModelDownloadingScreen,
} from "@/main/modules/llm/components";
import { cn } from "@/lib/utils";
import { serviceManager } from "@/services";
import type { AttachedDocumentRef } from "@/types/chat";
import { RuntimeSessionsPanel } from "@/main/components/molecules/RuntimeSessions";
import { useRuntimeSessionsStore } from "@/main/stores/runtime-sessions";
import { isPopupSurface } from "@/utils/dom";
import { useIsWideViewport } from "@/main/hooks/use-viewport";
import { getModel } from "@/services/llm/registry/model-registry";
import { PROVIDER_TO_SERVICE } from "@/services/llm/constants";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";
import { logError } from "@/utils/logger";
import { Button } from "@/main/components/ui/button";
import { Loader2, Play, TriangleAlert } from "lucide-react";
import { Badge } from "../components/ui/badge";

type LocalRunnerProvider = "transformer" | "webllm" | "wllama";

function isLocalRunnerProvider(
	provider: ServiceProvider,
): provider is LocalRunnerProvider {
	return (
		provider === "transformer" || provider === "webllm" || provider === "wllama"
	);
}

function normalizeModelId(modelId: string): string {
	return modelId.trim().toLowerCase();
}

export const ChatPage: React.FC = () => {
	const { t } = useTranslation("chat");
	const navigate = useNavigate();
	const { model, current, isInitialized, handleModelLoaded } =
		useCurrentModel();
	const {
		downloadProgress,
		setDownloadProgress,
		quickDownloadModel,
		setQuickDownloadModel,
	} = useDownloadProgress();
	const [topics, setTopics] = React.useState<
		Array<{ id: string; name: string }>
	>([]);
	const [isLoadingTopics, setIsLoadingTopics] = React.useState(false);
	const [agentFlows, setAgentFlows] = React.useState<
		Array<{ id: string; name: string }>
	>([]);
	const { isOpen, open, close } = useAgentConfigStore();
	const refreshRuntimeSessions = useRuntimeSessionsStore(
		(state) => state.refresh,
	);
	const isWideViewport = useIsWideViewport();
	const [attachedImages, setAttachedImages] = React.useState<File[]>([]);
	const [attachedDocumentRefs, setAttachedDocumentRefs] = React.useState<
		AttachedDocumentRef[]
	>([]);
	const [isCurrentModelLoaded, setIsCurrentModelLoaded] = React.useState(true);
	const [isCheckingCurrentModel, setIsCheckingCurrentModel] =
		React.useState(false);
	const [isLoadingCurrentModel, setIsLoadingCurrentModel] =
		React.useState(false);
	const [currentModelLoadError, setCurrentModelLoadError] = React.useState<
		string | null
	>(null);

	const {
		inputValue,
		setInputValue,
		status,
		chatMode,
		selectedTopic,
		setSelectedTopic,
		selectedAgentFlowId,
		setSelectedAgentFlowId,
		messages,
		isLoading,
		abortController,
		inProgressMessage,
		handleSubmit,
		handleStop,
		insertSeparator,
		deleteMessages,
	} = useChat(model);

	const currentLocalModel = useMemo(() => {
		if (!current || !isLocalRunnerProvider(current.provider)) {
			return null;
		}

		return getModel(current.modelId, current.provider) ?? null;
	}, [current]);

	const currentModelServeId = useMemo(() => {
		if (!current || !isLocalRunnerProvider(current.provider)) {
			return null;
		}

		if (
			current.provider === "wllama" &&
			currentLocalModel?.provider === "wllama" &&
			currentLocalModel.wllamaConfig?.filename
		) {
			return `${currentLocalModel.id}/${currentLocalModel.wllamaConfig.filename}`;
		}

		return currentLocalModel?.id ?? current.modelId;
	}, [current, currentLocalModel]);

	const currentModelDisplayName =
		currentLocalModel?.displayName ?? current?.modelId ?? model;

	const handleChatSubmit = (
		e: React.FormEvent,
		images: File[],
		docRefs: AttachedDocumentRef[],
	) => {
		handleSubmit(e, images, docRefs);
		setAttachedImages([]);
		setAttachedDocumentRefs([]);
	};

	// Refresh after each assistant response finishes
	const wasInProgressRef = useRef(false);
	useEffect(() => {
		const isNow = inProgressMessage != null;
		if (!isNow && wasInProgressRef.current) {
			void refreshRuntimeSessions();
		}
		wasInProgressRef.current = isNow;
	}, [inProgressMessage, refreshRuntimeSessions]);

	// Memoized message groups - split into completed and latest
	const { groups, inprogressGroup, completedGroupsIds } = useMemo(() => {
		const groupResponse = groupMessagesBySeparators(messages);
		return {
			groups: groupResponse.groups,
			inprogressGroup: groupResponse.inprogressGroup,
			completedGroupsIds: groupResponse.completedGroupsIds.join(","),
		};
	}, [messages]);

	// Memoized completed components - only re-render when completed groups actually change
	const completedMessageGroups = useMemo(() => {
		return groups.map((group) => (
			<MessageGroup
				key={group.id}
				group={group}
				isLoading={false}
				inProgressMessage={null}
				defaultCollapsed={true}
				selectedTopic={selectedTopic}
			/>
		));
	}, [completedGroupsIds, selectedTopic]); // Only re-render when completed groups change

	// Fetch topics when knowledge mode is selected
	useEffect(() => {
		if (chatMode === "knowledge") {
			const fetchTopics = async () => {
				try {
					setIsLoadingTopics(true);
					const result = await topicService.getTopics();
					setTopics(
						result.map((topic) => ({
							id: topic.id,
							name: topic.name,
						})),
					);
				} catch (error) {
					setTopics([]);
				} finally {
					setIsLoadingTopics(false);
				}
			};

			fetchTopics();
		}
	}, [chatMode]);

	useEffect(() => {
		const loadFlows = async () => {
			try {
				const flows =
					await serviceManager.flowBuilderService.listPredefinedFlows(
						"knowledge-rag",
					);
				const mapped = flows.map((flow) => ({ id: flow.id, name: flow.name }));
				setAgentFlows(mapped);
				if (!selectedAgentFlowId && mapped.length > 0) {
					setSelectedAgentFlowId(mapped[0].id);
				}
			} catch {
				setAgentFlows([]);
			}
		};
		loadFlows();
	}, [selectedAgentFlowId, setSelectedAgentFlowId]);

	useEffect(() => {
		if (!isOpen) return;
		void useAgentConfigStore.getState().initialize(selectedAgentFlowId);
	}, [isOpen, selectedAgentFlowId]);

	const handleCreateAgentFlow = async () => {
		const input = window.prompt("Flow name", "");
		const name = input?.trim();
		if (!name) return;
		try {
			const created =
				await serviceManager.flowBuilderService.createPredefinedFlow(
					"knowledge-rag",
					name,
				);
			const nextFlows = [{ id: created.id, name: created.name }, ...agentFlows];
			setAgentFlows(nextFlows);
			setSelectedAgentFlowId(created.id);
			if (isOpen) {
				await useAgentConfigStore.getState().initialize(created.id);
			}
		} catch {
			// no-op for now
		}
	};

	// Navigate to models tab
	const navigateToModels = () => {
		navigate("/llm");
	};

	const isWideChatRuntimeRailVisible = isWideViewport && !isPopupSurface();

	useEffect(() => {
		let cancelled = false;

		if (!current || !isLocalRunnerProvider(current.provider)) {
			setIsCurrentModelLoaded(true);
			setIsCheckingCurrentModel(false);
			setCurrentModelLoadError(null);
			return;
		}

		const serviceName = PROVIDER_TO_SERVICE[current.provider];
		const candidateIds = [
			current.modelId,
			currentLocalModel?.id,
			currentModelServeId,
		].filter((value): value is string => Boolean(value));

		setIsCheckingCurrentModel(true);

		void serviceManager.llmService
			.modelsFor(serviceName)
			.then((response) => {
				if (cancelled) {
					return;
				}

				const loaded = response.data.some(
					(entry) =>
						entry.loaded &&
						candidateIds.some(
							(candidateId) =>
								normalizeModelId(candidateId) === normalizeModelId(entry.id),
						),
				);
				setIsCurrentModelLoaded(loaded);
				if (loaded) {
					setCurrentModelLoadError(null);
				}
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				logError("Failed to check current chat model status:", error);
				setIsCurrentModelLoaded(false);
			})
			.finally(() => {
				if (!cancelled) {
					setIsCheckingCurrentModel(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [current, currentLocalModel, currentModelServeId]);

	const handleLoadCurrentModel = async () => {
		if (!current || !isLocalRunnerProvider(current.provider)) {
			return;
		}

		const serviceName = PROVIDER_TO_SERVICE[current.provider];
		const modelToServe = currentModelServeId ?? current.modelId;

		setCurrentModelLoadError(null);
		setIsLoadingCurrentModel(true);
		setQuickDownloadModel(currentModelDisplayName);
		setDownloadProgress({
			loaded: 0,
			total: 0,
			percent: 0,
			text: "Initializing...",
		});

		try {
			await serviceManager.llmService.serveFor(
				serviceName,
				modelToServe,
				(progress) => {
					setDownloadProgress({
						...progress,
						text: progress.text ?? "",
					});
				},
			);
			setIsCurrentModelLoaded(true);
			handleModelLoaded(modelToServe, current.provider);
		} catch (error) {
			logError("Failed to load current model from chat page:", error);
			setCurrentModelLoadError(
				error instanceof Error ? error.message : "Failed to load model",
			);
			setIsCurrentModelLoaded(false);
		} finally {
			setIsLoadingCurrentModel(false);
			setQuickDownloadModel(null);
			setDownloadProgress({ loaded: 0, total: 0, percent: 0, text: "" });
		}
	};

	if (!isInitialized) {
		return <LoadingScreen />;
	}

	// Check if model is currently downloading
	const isModelDownloading =
		downloadProgress.percent > 0 && downloadProgress.percent < 100;

	// Show download progress if model is being downloaded
	if (isModelDownloading) {
		return (
			<ModelDownloadingScreen
				downloadProgress={downloadProgress}
				modelName={quickDownloadModel}
			/>
		);
	}

	// Show YourModels component if no loaded models available
	if (!model) {
		return (
			<NoModelsScreen
				onModelLoaded={handleModelLoaded}
				onNavigateToModels={navigateToModels}
			/>
		);
	}

	const shouldShowModelLoadPrompt =
		Boolean(current && isLocalRunnerProvider(current.provider)) &&
		!isCurrentModelLoaded;
	const isChatInputModelReady =
		!current ||
		!isLocalRunnerProvider(current.provider) ||
		(isCurrentModelLoaded && !isCheckingCurrentModel && !isLoadingCurrentModel);

	return (
		<div className="flex h-full bg-background">
			{isWideChatRuntimeRailVisible ? <RuntimeSessionsPanel /> : null}
			<div className="flex flex-col flex-1 min-w-0">
				<Conversation className="flex-1 min-h-0">
					<ConversationContent className="max-w-3xl mx-auto space-y-6">
						{/* Completed groups - memoized components, never re-render during streaming */}
						{completedMessageGroups}

						{inprogressGroup ? (
							<MessageGroup
								key={inprogressGroup.id}
								group={inprogressGroup}
								isLoading={true}
								inProgressMessage={inProgressMessage}
								defaultCollapsed={false}
								selectedTopic={selectedTopic}
							/>
						) : undefined}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				{shouldShowModelLoadPrompt ? (
					<div className="px-4 pt-1.5 w-full flex-shrink-0">
						<div className="max-w-3xl mx-auto">
							<div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 -mb-2 rounded-bl-none rounded-br-none ml-12 mr-12">
								<div className="min-w-0">
									<div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-200">
										<TriangleAlert className="w-3.5 h-3.5" />
										{t("model.selectedNotLoadedTitle")}
										{current?.provider ? (
											<Badge>
												{t("model.selectedProvider", {
													provider: current.provider,
												})}
											</Badge>
										) : null}
									</div>
									<div className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-100/80 break-words">
										{t("model.selectedNotLoadedDescription", {
											model: currentModelDisplayName,
										})}
									</div>
								</div>
								<Button
									type="button"
									size="sm"
									onClick={handleLoadCurrentModel}
									disabled={isLoadingCurrentModel}
									className="h-8 shrink-0 border border-amber-300 bg-amber-50 px-3 text-amber-950 hover:bg-amber-100 dark:border-amber-300/40 dark:bg-amber-100 dark:text-amber-950 dark:hover:bg-amber-200"
								>
									{isLoadingCurrentModel ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<Play className="w-4 h-4" />
									)}
									{t("model.loadSelected")}
								</Button>
							</div>
						</div>
					</div>
				) : null}

				<ChatInput
					inputValue={inputValue}
					setInputValue={setInputValue}
					onSubmit={handleChatSubmit}
					isLoading={isLoading}
					model={model}
					status={status}
					selectedTopic={selectedTopic}
					setSelectedTopic={setSelectedTopic}
					onInsertSeparator={insertSeparator}
					onStop={handleStop}
					onDeleteChat={deleteMessages}
					abortController={abortController}
					isLoadingTopics={isLoadingTopics}
					topics={topics}
					agentFlows={agentFlows}
					selectedAgentFlowId={selectedAgentFlowId}
					setSelectedAgentFlowId={setSelectedAgentFlowId}
					onCreateAgentFlow={handleCreateAgentFlow}
					attachedImages={attachedImages}
					onAttachedImagesChange={setAttachedImages}
					attachedDocumentRefs={attachedDocumentRefs}
					onAttachedDocumentRefsChange={setAttachedDocumentRefs}
					isModelReady={isChatInputModelReady}
					onOpenAgentSettings={() => {
						if (isOpen) {
							close();
							return;
						}
						open(selectedAgentFlowId);
					}}
				/>
			</div>

			<AnimatePresence>
				{isOpen && (
					<>
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.18, ease: "easeOut" }}
							className="fixed inset-0 bg-black/50 z-40 md:hidden"
							onClick={close}
						/>
						<motion.div
							initial={{ opacity: 0, x: 24 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 24 }}
							transition={{ duration: 0.2, ease: "easeOut" }}
							className={cn(
								"z-10 flex-shrink-0 border-l bg-card",
								"fixed top-12 bottom-0 right-0 left-0 z-50",
								"md:relative md:top-auto md:bottom-auto md:left-auto md:w-[480px] md:max-w-full md:z-10",
							)}
						>
							<AgentSettingsPanel />
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</div>
	);
};
