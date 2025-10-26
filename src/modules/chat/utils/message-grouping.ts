import type { Message } from "@/services/database";

export interface MessageGroup {
	id: string;
	messages: Message[];
	separator?: Message; // The separator that ends this group
	isLatest: boolean;
}

/**
 * Groups messages by separators. Each group contains messages up to (but not including) the next separator.
 * The separator itself is stored with the group it ends.
 */
export function groupMessagesBySeparators(messages: Message[]) {
	if (messages.length === 0) {
		return {
			groups: [],
			inprogressGroup: null,
			completedGroupsIds: [],
		};
	}

	const groups: MessageGroup[] = [];
	let currentGroupMessages: Message[] = [];
	let groupIndex = 0;
	let inprogressGroup: MessageGroup | null = null;
	let completedGroupsIds: string[] = [];

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];

		if (message.type === "separator") {
			// End current group with this separator
			if (currentGroupMessages.length > 0 || groups.length === 0) {
				completedGroupsIds.push(`group-${groupIndex}`);
				groups.push({
					id: `group-${groupIndex}`,
					messages: [...currentGroupMessages],
					separator: message,
					isLatest: false, // Will be updated later
				});
				groupIndex++;
			}
			// Start new group
			currentGroupMessages = [];
		} else {
			// Add message to current group
			currentGroupMessages.push(message);
		}
	}

	// Add remaining messages as the final group (no separator)
	if (currentGroupMessages.length > 0) {
		inprogressGroup = {
			id: `group-${groupIndex}`,
			messages: currentGroupMessages,
			separator: undefined,
			isLatest: true, // Will be updated later
		};
	}

	return {
		groups,
		inprogressGroup,
		completedGroupsIds,
	};
}
