import React, { useRef, useState } from "react";
import {
	ChevronLeft,
	ChevronsRight,
	MessageSquare,
	MessageSquarePlus,
	RefreshCw,
	X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/main/stores/chat";
import { cn } from "@/lib/utils";
import { Button } from "@/main/components/ui/button";
import { ConversationListSection } from "./ConversationListSection";
import { CollapsedRailItem } from "./CollapsedRailItem";

interface ChatSidePanelProps {
	onShowConversationGroup?: (groupId: string) => void;
	defaultCollapsed?: boolean;
	allowCollapse?: boolean;
	allowResize?: boolean;
	showCollapsedToggle?: boolean;
	onClose?: () => void;
}

export const ChatSidePanel: React.FC<ChatSidePanelProps> = ({
	onShowConversationGroup = () => undefined,
	defaultCollapsed = true,
	allowCollapse = true,
	allowResize = true,
	showCollapsedToggle = true,
	onClose,
}) => {
	const conversations = useChatStore((state) => state.conversations);
	const currentConversation = useChatStore(
		(state) => state.currentConversation,
	);
	const loadConversations = useChatStore((state) => state.loadConversations);
	const createNewConversation = useChatStore(
		(state) => state.createNewConversation,
	);
	const { t } = useTranslation();
	const [collapsed, setCollapsed] = useState(defaultCollapsed);
	const [width, setWidth] = useState(320);
	const isDraggingRef = useRef(false);
	const dragStartXRef = useRef(0);
	const dragStartWidthRef = useRef(0);
	const conversationCount = Math.max(
		conversations.length,
		currentConversation ? 1 : 0,
	);

	const handleRefresh = async () => {
		await loadConversations();
	};

	const handleNewConversation = async () => {
		await createNewConversation("Main Chat");
		await loadConversations();
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
			className="relative z-10 h-full min-h-0 flex-shrink-0 transition-[width] duration-300 ease-out"
			style={
				allowCollapse && collapsed
					? { width: 56 }
					: allowResize
						? { width }
						: { width: "100%" }
			}
		>
			<div
				className={cn(
					"flex h-full min-h-0 flex-col border-r",
					collapsed ? "bg-background" : "bg-card",
				)}
			>
				<div
					className={cn(
						"flex-shrink-0",
						collapsed
							? "flex h-12 w-14 items-center justify-center p-0"
							: "flex items-center gap-2 border-b bg-muted/20 px-2 py-2",
					)}
				>
					{allowCollapse && collapsed && showCollapsedToggle ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setCollapsed(false)}
							className="h-9 w-9 text-muted-foreground hover:text-foreground"
							title={t("sandboxPanel.expand")}
							aria-label={t("sandboxPanel.expand")}
						>
							<ChevronsRight size={16} />
						</Button>
					) : allowCollapse && collapsed ? (
						<div className="h-9 w-9" />
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
								{allowCollapse ? (
									<button
										type="button"
										onClick={() => setCollapsed(true)}
										className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										title={t("sandboxPanel.collapse")}
										aria-label={t("sandboxPanel.collapse")}
									>
										<ChevronLeft size={18} />
									</button>
								) : onClose ? (
									<button
										type="button"
										onClick={onClose}
										className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										title="Close"
										aria-label="Close chat side panel"
									>
										<X size={16} />
									</button>
								) : null}
							</div>
						</>
					)}
				</div>

				{allowCollapse && collapsed ? (
					<div className="flex w-14 flex-1 flex-col items-center gap-1 px-0 py-2">
						<CollapsedRailItem
							icon={<MessageSquare size={17} />}
							label="Conversations"
							count={conversationCount}
							active
							onClick={() => setCollapsed(false)}
						/>
						<CollapsedRailItem
							icon={<MessageSquarePlus size={16} />}
							label="New chat"
							onClick={() => void handleNewConversation()}
						/>
					</div>
				) : (
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
						<ConversationListSection onShowGroup={onShowConversationGroup} />
					</div>
				)}
			</div>
			{allowResize && !collapsed && (
				<div
					onMouseDown={handleResizeMouseDown}
					className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors"
				/>
			)}
		</div>
	);
};
