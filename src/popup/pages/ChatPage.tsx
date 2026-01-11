"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/popup/components/ui/shadcn-io/ai/conversation";
import {
	LoadingScreen,
	NoModelsScreen,
	ChatInput,
	useCurrentModel,
	useChat,
} from "@/modules/chat/components";
import { MessageGroup } from "@/modules/chat/components/MessageGroup";
import { groupMessagesBySeparators } from "@/modules/chat/utils/message-grouping";
import { topicService } from "@/modules/topics/services/topic-service";
import {
	useDownloadProgress,
	ModelDownloadingScreen,
} from "@/modules/llm/components";

export const ChatPage: React.FC = () => {
	const navigate = useNavigate();
	const { model, isInitialized, handleModelLoaded } = useCurrentModel();
	const { downloadProgress, quickDownloadModel } = useDownloadProgress();
	const [topics, setTopics] = useState<Array<{ id: string; name: string }>>([]);
	const [isLoadingTopics, setIsLoadingTopics] = useState(false);
	const {
		inputValue,
		setInputValue,
		status,
		chatMode,
		setChatMode,
		selectedTopic,
		setSelectedTopic,
		messages,
		isLoading,
		abortController,
		inProgressMessage,
		handleSubmit,
		handleStop,
		insertSeparator,
		deleteMessages,
	} = useChat(model);

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

	// Navigate to models tab
	const navigateToModels = () => {
		navigate("/llm");
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

	return (
		<div className="flex flex-col h-full bg-background">
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

			<ChatInput
				inputValue={inputValue}
				setInputValue={setInputValue}
				onSubmit={handleSubmit}
				isLoading={isLoading}
				model={model}
				status={status}
				chatMode={chatMode}
				setChatMode={setChatMode}
				selectedTopic={selectedTopic}
				setSelectedTopic={setSelectedTopic}
				onInsertSeparator={insertSeparator}
				onStop={handleStop}
				onDeleteChat={deleteMessages}
				abortController={abortController}
				isLoadingTopics={isLoadingTopics}
				topics={topics}
			/>
		</div>
	);
};
