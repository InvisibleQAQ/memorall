/**
 * Activity Chat Panel Component
 * Right-side slide panel for analyzing activities with AI
 */

import React, { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/main/components/ui/button";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/main/components/ui/shadcn-io/ai/conversation";
import {
	ChatInput,
	useCurrentModel,
	useChat,
} from "@/main/modules/chat/components";
import { MessageGroup } from "@/main/modules/chat/components/MessageGroup";
import { groupMessagesBySeparators } from "@/main/modules/chat/utils/message-grouping";

interface ActivityChatPanelProps {
	isOpen: boolean;
	onClose: () => void;
	initialMessage?: string;
}

export const ActivityChatPanel: React.FC<ActivityChatPanelProps> = ({
	isOpen,
	onClose,
	initialMessage,
}) => {
	const { t } = useTranslation("activity");
	const { model } = useCurrentModel();
	const {
		inputValue,
		setInputValue,
		status,
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

	// Set initial message to input when panel opens
	useEffect(() => {
		if (isOpen && initialMessage) {
			setInputValue(initialMessage);
		}
	}, [isOpen, initialMessage, setInputValue]);

	// Memoized message groups
	const { groups, inprogressGroup, completedGroupsIds } = useMemo(() => {
		const groupResponse = groupMessagesBySeparators(messages);
		return {
			groups: groupResponse.groups,
			inprogressGroup: groupResponse.inprogressGroup,
			completedGroupsIds: groupResponse.completedGroupsIds.join(","),
		};
	}, [messages]);

	// Memoized completed components
	const completedMessageGroups = useMemo(() => {
		return groups.map((group) => (
			<MessageGroup
				key={group.id}
				group={group}
				isLoading={false}
				inProgressMessage={null}
				defaultCollapsed={true}
			/>
		));
	}, [completedGroupsIds]);

	if (!isOpen) return null;

	return (
		<div className="flex-1 flex flex-col min-h-0">
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 z-40 transition-opacity"
				onClick={onClose}
			/>

			{/* Panel */}
			<div className="fixed right-0 top-0 h-full w-full sm:w-[600px] bg-background border-l shadow-2xl z-50 flex flex-col !mt-0">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b">
					<h2 className="text-lg font-semibold">{t("chatPanel.title")}</h2>
					<Button variant="ghost" size="icon" onClick={onClose}>
						<X size={20} />
					</Button>
				</div>

				{/* Chat Content */}
				{!model ? (
					<div className="flex-1 flex items-center justify-center text-muted-foreground">
						<div className="text-center space-y-2">
							<p>{t("chatPanel.noModel")}</p>
							<p className="text-sm">{t("chatPanel.configureModel")}</p>
						</div>
					</div>
				) : (
					<div className="flex-1 flex flex-col min-h-0">
						<Conversation className="flex-1 min-h-0">
							<ConversationContent className="max-w-full px-4 space-y-6">
								{completedMessageGroups}

								{inprogressGroup ? (
									<MessageGroup
										key={inprogressGroup.id}
										group={inprogressGroup}
										isLoading={true}
										inProgressMessage={inProgressMessage}
										defaultCollapsed={false}
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
							selectedTopic={selectedTopic}
							setSelectedTopic={setSelectedTopic}
							onInsertSeparator={insertSeparator}
							onStop={handleStop}
							onDeleteChat={deleteMessages}
							abortController={abortController}
							isLoadingTopics={false}
							topics={[]}
							agentFlows={[]}
							selectedAgentFlowId={selectedAgentFlowId}
							setSelectedAgentFlowId={setSelectedAgentFlowId}
						/>
					</div>
				)}
			</div>
		</div>
	);
};
