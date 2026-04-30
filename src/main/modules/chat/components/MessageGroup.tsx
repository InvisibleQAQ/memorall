import dayjs from "dayjs";
import React, { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AgentIconCanvas } from "@/main/components/atoms/AgentIconCanvas";
import { MessageRenderer } from "./MessageRenderer";
import type { InProgressMessage } from "../hooks/use-chat";
import type { ChatMessageGroup } from "@/main/stores/chat";

interface MessageGroupProps {
	group: ChatMessageGroup;
	inProgressMessage?: InProgressMessage | null;
	defaultCollapsed?: boolean;
	selectedTopic?: string;
	suppressSeparator?: boolean;
	onLoadMessages?: (groupId: string) => Promise<void>;
}

export const MessageGroup: React.FC<MessageGroupProps> = React.memo(
	({
		group,
		inProgressMessage,
		defaultCollapsed = false,
		selectedTopic,
		suppressSeparator = false,
		onLoadMessages,
	}) => {
		const { t } = useTranslation("chat");
		const [isCollapsed, setIsCollapsed] = useState(
			defaultCollapsed && !group.isLatest,
		);

		const showCollapseControls = !group.isLatest;

		const toggleCollapsed = useCallback(async () => {
			if (!group.isLoaded && !group.isLatest) {
				await onLoadMessages?.(group.id);
				setIsCollapsed(false);
				return;
			}

			setIsCollapsed((prev) => !prev);
		}, [group.id, group.isLatest, group.isLoaded, onLoadMessages]);

		const separatorHeaderDate = useMemo(
			() =>
				group.separator
					? dayjs(group.separator.createdAt).format("MMM D, h:mm A")
					: "",
			[group.separator],
		);

		const showLatestEmptyIcon =
			group.isLatest && group.messages.length === 0 && !inProgressMessage;
		const displaySeparator = suppressSeparator
			? null
			: group.separator || (showLatestEmptyIcon ? group.previousSeparator : null);

		const separatorDate = useMemo(
			() =>
				displaySeparator
					? dayjs(displaySeparator.createdAt).format("MMM D, YYYY h:mm A")
					: "",
			[displaySeparator],
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
							{group.isLoading
								? "Loading messages..."
								: !group.isLoaded
									? "Load messages"
									: t("messages.count", { count: group.messages.length })}
							{separatorHeaderDate && (
								<span className="ml-2">• {separatorHeaderDate}</span>
							)}
						</span>
					</div>
				)}

				{!isCollapsed && group.isLoaded && (
					<div className="space-y-2">
						{messageComponents}
						{inProgressMessageComponent}
					</div>
				)}

				{displaySeparator || showLatestEmptyIcon ? (
					<div className="my-4 flex flex-col items-center gap-3">
						{displaySeparator ? (
							<div className="flex w-full items-center">
								<div className="flex-1 border-t border-border"></div>
								<div className="mx-4 text-xs font-medium text-muted-foreground">
									{separatorDate}
								</div>
								<div className="flex-1 border-t border-border"></div>
							</div>
						) : null}
						{showLatestEmptyIcon ? (
							<div className="flex h-24 w-24 items-center justify-center">
								<AgentIconCanvas
									size={96}
									animation="blink"
									aria-label="Agent"
								/>
							</div>
						) : null}
					</div>
				) : null}
			</div>
		);
	},
);
