import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { MessageRenderer } from "./MessageRenderer";
import type { MessageGroup as MessageGroupType } from "../utils/message-grouping";
import type { InProgressMessage } from "../hooks/use-chat";

interface MessageGroupProps {
	group: MessageGroupType;
	isLoading?: boolean;
	inProgressMessage?: InProgressMessage | null;
	defaultCollapsed?: boolean;
}

export const MessageGroup: React.FC<MessageGroupProps> = ({
	group,
	inProgressMessage,
	defaultCollapsed = false,
}) => {
	const [isCollapsed, setIsCollapsed] = useState(
		defaultCollapsed && !group.isLatest,
	);

	// Don't show collapse controls for groups with only 1 message or the latest group
	const showCollapseControls = group.messages.length > 1 && !group.isLatest;

	const toggleCollapsed = () => {
		setIsCollapsed(!isCollapsed);
	};

	const messageComponents = useMemo(() => {
		return group.messages.map((message, index) =>
			message.content ? (
				<MessageRenderer
					key={message.id}
					message={message}
					index={index}
					isLastMessage={false}
					isLoading={false}
				/>
			) : undefined,
		);
	}, [group.messages]);

	const inProgressMessageComponent = useMemo(() => {
		return inProgressMessage ? (
			<MessageRenderer
				key={inProgressMessage.id}
				message={{
					metadata: {},
					createdAt: new Date(),
					updatedAt: new Date(),
					...inProgressMessage,
					content: inProgressMessage.content || "",
					id: inProgressMessage.id,
					conversationId: "",
					type: "",
					role: "",
					complexContent: null,
					topicId: null,
					embedding: null,
				}}
				index={0}
				isLastMessage={true}
				isLoading={true}
			/>
		) : undefined;
	}, [inProgressMessage]);

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
						{group.messages.length} message
						{group.messages.length !== 1 ? "s" : ""}
						{group.separator && (
							<span className="ml-2">
								• {dayjs(group.separator.createdAt).format("MMM D, h:mm A")}
							</span>
						)}
					</span>
				</div>
			)}

			{/* Messages - animated show/hide */}
			<div
				className={`
					overflow-hidden transition-all duration-300 ease-in-out
					${!isCollapsed ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}
				`}
			>
				<div className="space-y-4">
					{/* Completed messages */}
					{messageComponents}

					{/* In-progress message - only when provided */}
					{inProgressMessageComponent}
				</div>
			</div>

			{/* Separator - always show if it exists */}
			{group.separator && (
				<div className="my-4 flex items-center">
					<div className="flex-1 border-t border-gray-300"></div>
					<div className="mx-4 text-xs text-gray-500 font-medium">
						{dayjs(group.separator.createdAt).format("MMM D, YYYY h:mm A")}
					</div>
					<div className="flex-1 border-t border-gray-300"></div>
				</div>
			)}
		</div>
	);
};
