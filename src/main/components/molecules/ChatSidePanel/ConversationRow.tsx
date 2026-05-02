import React from "react";
import { ChevronDown, ChevronRight, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/services/database/types";
import {
	formatConversationTime,
	getConversationTitle,
} from "./chat-side-panel-utils";

interface ConversationRowProps {
	conversation: Conversation;
	isActive: boolean;
	isExpanded: boolean;
	onSelect: () => void;
	onDelete: () => void;
	children?: React.ReactNode;
}

export const ConversationRow: React.FC<ConversationRowProps> = ({
	conversation,
	isActive,
	isExpanded,
	onSelect,
	onDelete,
	children,
}) => {
	const handleDelete = (event: React.MouseEvent) => {
		event.stopPropagation();
		onDelete();
	};

	return (
		<div className="group/row">
			<div
				className={cn(
					"flex items-center rounded-md transition-colors",
					"hover:bg-muted/70",
					isActive && "bg-muted text-foreground",
				)}
			>
				<button
					type="button"
					onClick={onSelect}
					className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{isExpanded ? (
						<ChevronDown size={13} className="shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight
							size={13}
							className="shrink-0 text-muted-foreground"
						/>
					)}
					<MessageSquare
						size={13}
						className={cn(
							"shrink-0 text-muted-foreground",
							isActive && "text-primary",
						)}
					/>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-xs font-semibold">
							{getConversationTitle(conversation)}
						</span>
						<span className="block truncate text-[10px] text-muted-foreground">
							{isActive ? "Active" : formatConversationTime(conversation)}
						</span>
					</span>
				</button>
				<button
					type="button"
					onClick={handleDelete}
					className={cn(
						"mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition",
						"hover:bg-destructive/10 hover:text-destructive group-hover/row:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					)}
					title="Delete chat"
					aria-label="Delete chat"
				>
					<Trash2 size={13} />
				</button>
			</div>
			{isExpanded ? children : null}
		</div>
	);
};
