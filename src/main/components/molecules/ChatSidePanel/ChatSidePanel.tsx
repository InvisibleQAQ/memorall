import React, { useRef, useState } from "react";
import {
	ChevronLeft,
	ChevronRight,
	Globe,
	MessageSquare,
	RefreshCw,
	Server,
	Terminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRuntimeSessionsStore } from "@/main/stores/runtime-sessions";
import { useChatStore } from "@/main/stores/chat";
import { cn } from "@/lib/utils";
import { ConversationListSection } from "./ConversationListSection";
import { CollapsedRailItem } from "./CollapsedRailItem";
import { RuntimeSessionsSectionList } from "../RuntimeSessions/RuntimeSessionsSectionList";

interface ChatSidePanelProps {
	onShowConversationGroup?: (groupId: string) => void;
}

export const ChatSidePanel: React.FC<ChatSidePanelProps> = ({
	onShowConversationGroup = () => undefined,
}) => {
	const commands = useRuntimeSessionsStore((state) => state.commands);
	const servers = useRuntimeSessionsStore((state) => state.servers);
	const activeWebSession = useRuntimeSessionsStore(
		(state) => state.activeWebSession,
	);
	const refreshRuntimeSessions = useRuntimeSessionsStore(
		(state) => state.refresh,
	);
	const conversations = useChatStore((state) => state.conversations);
	const currentConversation = useChatStore(
		(state) => state.currentConversation,
	);
	const loadConversations = useChatStore((state) => state.loadConversations);
	const { t } = useTranslation();
	const [collapsed, setCollapsed] = useState(true);
	const [width, setWidth] = useState(320);
	const isDraggingRef = useRef(false);
	const dragStartXRef = useRef(0);
	const dragStartWidthRef = useRef(0);
	const hasWebSession = Boolean(activeWebSession.isOpen);
	const hasRuntimeActivity =
		hasWebSession || commands.length > 0 || servers.length > 0;
	const conversationCount = Math.max(
		conversations.length,
		currentConversation ? 1 : 0,
	);

	const handleRefresh = async () => {
		await Promise.all([refreshRuntimeSessions(), loadConversations()]);
	};

	const handleResizeMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		isDraggingRef.current = true;
		dragStartXRef.current = e.clientX;
		dragStartWidthRef.current = width;

		const onMouseMove = (ev: MouseEvent) => {
			if (!isDraggingRef.current) return;
			const delta = ev.clientX - dragStartXRef.current;
			const next = Math.max(
				200,
				Math.min(600, dragStartWidthRef.current + delta),
			);
			setWidth(next);
		};

		const onMouseUp = () => {
			isDraggingRef.current = false;
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
	};

	return (
		<div
			className="relative z-10 flex-shrink-0"
			style={collapsed ? { width: 56 } : { width }}
		>
			<div
				className={cn(
					"flex h-full flex-col border-r",
					collapsed ? "bg-background" : "bg-card",
				)}
			>
				<div
					className={cn(
						"flex-shrink-0",
						collapsed
							? "flex items-center justify-center px-2 pt-3 pb-2"
							: "flex items-center gap-2 border-b bg-muted/20 px-2 py-2",
					)}
				>
					{collapsed ? (
						<button
							type="button"
							onClick={() => setCollapsed(false)}
							className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							title={t("sandboxPanel.expand")}
							aria-label={t("sandboxPanel.expand")}
						>
							<ChevronRight size={18} />
						</button>
					) : (
						<>
							<div className="min-w-0 flex items-center gap-2 text-muted-foreground">
								<MessageSquare size={13} className="shrink-0" />
								<span className="truncate text-xs font-semibold text-foreground">
									Chats
								</span>
							</div>
							<div className="ml-auto flex items-center gap-1">
								<button
									type="button"
									title={t("sandboxPanel.refresh")}
									onClick={() => void handleRefresh()}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									<RefreshCw size={14} />
								</button>
								<button
									type="button"
									onClick={() => setCollapsed(true)}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									title={t("sandboxPanel.collapse")}
									aria-label={t("sandboxPanel.collapse")}
								>
									<ChevronLeft size={18} />
								</button>
							</div>
						</>
					)}
				</div>

				{collapsed ? (
					<div className="flex flex-1 flex-col items-center gap-1 px-2 py-2">
						<CollapsedRailItem
							icon={<MessageSquare size={17} />}
							label="Conversations"
							count={conversationCount}
							active
							onClick={() => setCollapsed(false)}
						/>
						{hasRuntimeActivity ? (
							<div className="my-2 h-px w-7 bg-border/70" />
						) : null}
						{hasWebSession ? (
							<CollapsedRailItem
								icon={<Globe size={16} />}
								count={1}
								label={t("sandboxPanel.webSessionTitle")}
								onClick={() => setCollapsed(false)}
							/>
						) : null}
						{commands.length > 0 ? (
							<CollapsedRailItem
								icon={<Terminal size={16} />}
								count={commands.length}
								label={t("sandboxPanel.commandsTitle")}
								onClick={() => setCollapsed(false)}
							/>
						) : null}
						{servers.length > 0 ? (
							<CollapsedRailItem
								icon={<Server size={16} />}
								count={servers.length}
								label={t("sandboxPanel.serversTitle")}
								onClick={() => setCollapsed(false)}
							/>
						) : null}
					</div>
				) : (
					<div className="flex-1 overflow-y-auto p-2">
						<div className="space-y-5">
							<ConversationListSection onShowGroup={onShowConversationGroup} />
							<div className="space-y-2 border-t border-border/70 pt-4">
								<div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
									<Server size={12} />
									<span>{t("sandboxPanel.title")}</span>
								</div>
								<RuntimeSessionsSectionList
									commands={commands}
									servers={servers}
									activeWebSession={activeWebSession}
									onRefresh={refreshRuntimeSessions}
									variant="docked"
								/>
							</div>
						</div>
					</div>
				)}
			</div>
			{!collapsed && (
				<div
					onMouseDown={handleResizeMouseDown}
					className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors"
				/>
			)}
		</div>
	);
};
