import React, { useMemo } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessageGroup } from "@/main/stores/chat";
import { formatGroupMeta, formatGroupTitle } from "./chat-side-panel-utils";

interface ConversationGroupListProps {
	groups: ChatMessageGroup[];
	onSelectGroup: (group: ChatMessageGroup) => void;
}

export const ConversationGroupList: React.FC<ConversationGroupListProps> = ({
	groups,
	onSelectGroup,
}) => {
	const orderedGroups = useMemo(() => {
		const latest = groups.find((group) => group.isLatest);
		const previous = groups.filter((group) => !group.isLatest).reverse();
		return latest ? [latest, ...previous] : previous;
	}, [groups]);

	if (orderedGroups.length === 0) return null;

	return (
		<div className="ml-4 mt-1 space-y-0.5 border-l border-border/70 pl-2">
			{orderedGroups.map((group) => (
				<button
					key={group.id}
					type="button"
					onClick={() => onSelectGroup(group)}
					className={cn(
						"group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
						"hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						group.isLatest ? "text-foreground" : "text-muted-foreground",
					)}
				>
					{group.isLoading ? (
						<Loader2 size={12} className="shrink-0 animate-spin" />
					) : (
						<ChevronRight
							size={12}
							className={cn(
								"shrink-0 transition-colors group-hover:text-foreground",
								group.isLatest && "text-primary",
							)}
						/>
					)}
					<span className="min-w-0 flex-1">
						<span className="block truncate text-xs font-medium">
							{formatGroupTitle(group)}
						</span>
						<span className="block truncate text-[10px] text-muted-foreground">
							{formatGroupMeta(group)}
						</span>
					</span>
				</button>
			))}
		</div>
	);
};
