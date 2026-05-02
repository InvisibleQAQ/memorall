import React, { useEffect, useMemo } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useChatStore, type ChatMessageGroup } from "@/main/stores/chat";
import type { Conversation } from "@/services/database/types";
import { ConversationGroupList } from "./ConversationGroupList";
import { ConversationRow } from "./ConversationRow";

interface ConversationListSectionProps {
	onShowGroup: (groupId: string) => void;
}

export const ConversationListSection: React.FC<
	ConversationListSectionProps
> = ({ onShowGroup }) => {
	const conversations = useChatStore((state) => state.conversations);
	const currentConversation = useChatStore(
		(state) => state.currentConversation,
	);
	const messageGroups = useChatStore((state) => state.messageGroups);
	const createNewConversation = useChatStore(
		(state) => state.createNewConversation,
	);
	const loadConversation = useChatStore((state) => state.loadConversation);
	const loadConversations = useChatStore((state) => state.loadConversations);
	const loadMessageGroup = useChatStore((state) => state.loadMessageGroup);
	const deleteConversation = useChatStore((state) => state.deleteConversation);

	useEffect(() => {
		void loadConversations();
	}, [loadConversations]);

	const visibleConversations = useMemo(() => {
		const byId = new Map(conversations.map((item) => [item.id, item]));
		if (currentConversation) {
			byId.set(currentConversation.id, currentConversation);
		}
		return Array.from(byId.values());
	}, [conversations, currentConversation]);

	const handleNewConversation = async () => {
		await createNewConversation("Main Chat");
		await loadConversations();
	};

	const handleSelectConversation = async (conversationId: string) => {
		if (conversationId === currentConversation?.id) return;
		await loadConversation(conversationId);
	};

	const handleDeleteConversation = async (conversation: Conversation) => {
		const confirmed = window.confirm(
			`Delete "${conversation.title || conversation.name || "this chat"}"?`,
		);
		if (!confirmed) return;
		await deleteConversation(conversation.id);
	};

	const handleSelectGroup = async (group: ChatMessageGroup) => {
		if (!group.isLatest && !group.isLoaded) {
			await loadMessageGroup(group.id);
		}
		onShowGroup(group.id);
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2 px-1">
				<div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					Conversations
				</div>
				<button
					type="button"
					onClick={handleNewConversation}
					className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					title="New chat"
					aria-label="New chat"
				>
					<MessageSquarePlus size={14} />
				</button>
			</div>

			{visibleConversations.length > 0 ? (
				<div className="space-y-1">
					{visibleConversations.map((conversation) => {
						const isActive = conversation.id === currentConversation?.id;
						return (
							<ConversationRow
								key={conversation.id}
								conversation={conversation}
								isActive={isActive}
								isExpanded={isActive}
								onSelect={() => void handleSelectConversation(conversation.id)}
								onDelete={() => void handleDeleteConversation(conversation)}
							>
								<ConversationGroupList
									groups={messageGroups}
									onSelectGroup={(group) => void handleSelectGroup(group)}
								/>
							</ConversationRow>
						);
					})}
				</div>
			) : (
				<div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
					No conversations yet
				</div>
			)}
		</div>
	);
};
