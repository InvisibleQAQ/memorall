import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageRenderer } from "./MessageRenderer";
import type { MessageGroup as MessageGroupType } from "../utils/message-grouping";
import dayjs from "dayjs";

interface MessageGroupProps {
	group: MessageGroupType;
	isLoading?: boolean;
	inProgressMessage?: any;
	defaultCollapsed?: boolean;
}

export const MessageGroup: React.FC<MessageGroupProps> = ({
	group,
	isLoading = false,
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
					${
						!isCollapsed || group.isLatest
							? "max-h-[10000px] opacity-100"
							: "max-h-0 opacity-0"
					}
				`}
			>
				<div className="space-y-4">
					{group.messages.map((message, index) => {
						// Skip the last placeholder message if we're loading
						if (isLoading && index === group.messages.length - 1) {
							return null;
						}
						return (
							<MessageRenderer
								key={message.id}
								message={message}
								index={index}
								isLastMessage={false}
								isLoading={false}
							/>
						);
					})}

					{/* In-progress message for the latest group */}
					{group.isLatest && inProgressMessage && (
						<MessageRenderer
							key={inProgressMessage.id}
							message={inProgressMessage}
							index={0}
							isLastMessage={true}
							isLoading={true}
						/>
					)}
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
