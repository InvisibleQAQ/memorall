import dayjs from "dayjs";
import type { ChatMessageGroup } from "@/main/stores/chat";
import type { Conversation } from "@/services/database/types";

export const getConversationTitle = (conversation: Conversation): string =>
	conversation.title?.trim() || conversation.name?.trim() || "Untitled chat";

export const getConversationTime = (conversation: Conversation): Date =>
	new Date(conversation.updatedAt ?? conversation.createdAt);

export const getConversationDateLabel = (
	conversation: Conversation,
): string => {
	const value = dayjs(getConversationTime(conversation));
	const today = dayjs();

	if (value.isSame(today, "day")) return "Today";
	if (value.isSame(today.subtract(1, "day"), "day")) return "Yesterday";
	return "Earlier";
};

export const formatConversationTime = (conversation: Conversation): string => {
	const value = dayjs(getConversationTime(conversation));
	const today = dayjs();

	if (value.isSame(today, "day")) return value.format("h:mm A");
	if (value.isSame(today.subtract(1, "day"), "day")) return "Yesterday";
	return value.format("MMM D");
};

export const formatGroupTitle = (group: ChatMessageGroup): string => {
	if (group.isLatest) return "Current segment";
	if (!group.separator) return "Previous segment";
	return dayjs(group.separator.createdAt).format("MMM D, h:mm A");
};

export const formatGroupMeta = (group: ChatMessageGroup): string => {
	if (group.isLoading) return "Loading messages";
	if (!group.isLatest && !group.isLoaded) return "Load messages";

	const count = group.messages.length;
	return `${count} ${count === 1 ? "message" : "messages"}`;
};
