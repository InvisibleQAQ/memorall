import dayjs from "dayjs";
import React, { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MessageRenderer } from "./MessageRenderer";
import type { MessageGroup as MessageGroupType } from "../utils/message-grouping";
import type { InProgressMessage } from "../hooks/use-chat";

interface MessageGroupProps {
	group: MessageGroupType;
	isLoading?: boolean;
	inProgressMessage?: InProgressMessage | null;
	defaultCollapsed?: boolean;
	selectedTopic?: string;
}

export const MessageGroup: React.FC<MessageGroupProps> = React.memo(
	({ group, inProgressMessage, defaultCollapsed = false, selectedTopic }) => {
		const { t } = useTranslation("chat");
		const [isCollapsed, setIsCollapsed] = useState(
			defaultCollapsed && !group.isLatest,
		);

		const showCollapseControls = group.messages.length > 1 && !group.isLatest;

		const toggleCollapsed = useCallback(() => {
			setIsCollapsed((prev) => !prev);
		}, []);

		const separatorHeaderDate = useMemo(
			() =>
				group.separator
					? dayjs(group.separator.createdAt).format("MMM D, h:mm A")
					: "",
			[group.separator],
		);

		const separatorDate = useMemo(
			() =>
				group.separator
					? dayjs(group.separator.createdAt).format("MMM D, YYYY h:mm A")
					: "",
			[group.separator],
		);

		const messageComponents = useMemo(() => {
			return group.messages.map((message, index) =>
				message.content ? (
					<MessageRenderer
						key={message.id}
						message={message}
						index={index}
						isLastMessage={false}
						isStreaming={false}
						groupMessages={group.messages}
						selectedTopic={selectedTopic}
					/>
				) : undefined,
			);
		}, [group.messages, selectedTopic]);

		const inProgressMessageData = useMemo(() => {
			if (!inProgressMessage) return null;

			return {
				metadata: {
					actions: inProgressMessage.actions,
					executeState: inProgressMessage.executeState,
				},
				createdAt: new Date(),
				updatedAt: new Date(),
				...inProgressMessage,
				content: inProgressMessage.content || "",
				id: inProgressMessage.id,
				conversationId: "",
				type: "",
				role: "assistant" as const,
				complexContent: null,
				topicId: null,
				embedding: null,
				embeddingSmall: null,
				embeddingLarge: null,
			};
		}, [inProgressMessage]);

		const inProgressMessageComponent = useMemo(() => {
			return inProgressMessageData ? (
				<MessageRenderer
					key={inProgressMessageData.id}
					message={inProgressMessageData}
					index={0}
					isLastMessage={true}
					isStreaming={true}
				/>
			) : undefined;
		}, [inProgressMessageData]);

		return (
			<div className="message-group">
				{/* Group Header - only show for collapsible groups */}
				{showCollapseControls && (
					<div
						className="flex items-center gap-2 py-2 mb-2 cursor-pointer hover:bg-accent/50 rounded-md px-2 -mx-2 transition-colors duration-150"
						onClick={toggleCollapsed}
					>
						<div className="text-muted-foreground hover:text-foreground transition-colors duration-150">
							{isCollapsed ? (
								<ChevronRight
									size={14}
									className="transition-transform duration-200"
								/>
							) : (
								<ChevronDown
									size={14}
									className="transition-transform duration-200"
								/>
							)}
						</div>
						<span className="text-xs text-muted-foreground flex-1">
							{t("messages.count", { count: group.messages.length })}
							{separatorHeaderDate && (
								<span className="ml-2">• {separatorHeaderDate}</span>
							)}
						</span>
					</div>
				)}

				{/* Messages - conditionally render to avoid unnecessary processing */}
				{!isCollapsed && (
					<div className="space-y-2">
						{/* Completed messages */}
						{messageComponents}

						{/* In-progress message - only when provided */}
						{inProgressMessageComponent}
					</div>
				)}

				{/* Separator - always show if it exists */}
				{group.separator && (
					<div className="my-4 flex items-center">
						<div className="flex-1 border-t border-gray-300"></div>
						<div className="mx-4 text-xs text-gray-500 font-medium">
							{separatorDate}
						</div>
						<div className="flex-1 border-t border-gray-300"></div>
					</div>
				)}
			</div>
		);
	},
);
