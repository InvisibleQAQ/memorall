"use client";
import React, { useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
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
	ModelLoadPrompt,
	SmartSelectContextBanner,
	useSmartSelectContext,
} from "@/main/modules/chat/components";
import { MessageGroup } from "@/main/modules/chat/components/MessageGroup";
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

export const ChatPage: React.FC = () => {
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
	const { smartSelectContext, setSmartSelectContext } = useSmartSelectContext();
	const [isChatInputModelReady, setIsChatInputModelReady] =
		React.useState(true);

	const {
		inputValue,
		setInputValue,
		status,
		chatMode,
		selectedTopic,
		setSelectedTopic,
		selectedAgentFlowId,
		setSelectedAgentFlowId,
		messageGroups,
		isLoading,
		abortController,
		inProgressMessage,
		handleSubmit,
		handleStop,
		insertSeparator,
		loadMessageGroup,
		deleteMessages,
	} = useChat(model);

	const handleChatSubmit = (
		e: React.FormEvent,
		images: File[],
		docRefs: AttachedDocumentRef[],
	) => {
		const contextPrefix = smartSelectContext
			? `[Smart Select: ${smartSelectContext.label}]\n${smartSelectContext.content}`
			: undefined;
		handleSubmit(e, images, docRefs, contextPrefix);
		setSmartSelectContext(null);
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

	const completedGroups = useMemo(
		() => messageGroups.filter((group) => !group.isLatest),
		[messageGroups],
	);
	const latestGroup = useMemo(
		() => messageGroups.find((group) => group.isLatest) ?? null,
		[messageGroups],
	);
	const completedGroupsIds = useMemo(
		() =>
			completedGroups
				.map((group) => `${group.id}:${group.isLoaded ? "loaded" : "empty"}`)
				.join(","),
		[completedGroups],
	);

	// Memoized completed components - only re-render when completed groups actually change
	const completedMessageGroups = useMemo(() => {
		return completedGroups.map((group) => (
			<MessageGroup
				key={group.id}
				group={group}
				inProgressMessage={null}
				defaultCollapsed={true}
				selectedTopic={selectedTopic}
				onLoadMessages={loadMessageGroup}
			/>
		));
	}, [completedGroupsIds, completedGroups, loadMessageGroup, selectedTopic]);

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

	return (
		<div className="flex h-full bg-background">
			{isWideChatRuntimeRailVisible ? <RuntimeSessionsPanel /> : null}
			<div className="flex flex-col flex-1 min-w-0">
				<Conversation className="flex-1 min-h-0">
					<ConversationContent className="max-w-3xl mx-auto space-y-6">
						{/* Completed groups - memoized components, never re-render during streaming */}
						{completedMessageGroups}

						{latestGroup ? (
							<MessageGroup
								key={latestGroup.id}
								group={latestGroup}
								inProgressMessage={inProgressMessage}
								defaultCollapsed={false}
								selectedTopic={selectedTopic}
								onLoadMessages={loadMessageGroup}
							/>
						) : undefined}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>

				<ModelLoadPrompt
					current={current}
					onModelLoaded={handleModelLoaded}
					onDownloadProgress={setDownloadProgress}
					onDownloadModelName={setQuickDownloadModel}
					onReadyChange={setIsChatInputModelReady}
				/>

				<SmartSelectContextBanner
					context={smartSelectContext}
					onClear={() => setSmartSelectContext(null)}
				/>

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
