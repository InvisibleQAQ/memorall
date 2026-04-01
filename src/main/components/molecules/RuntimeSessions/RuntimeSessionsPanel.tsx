import React, { useRef, useState } from "react";
import {
	ChevronLeft,
	ChevronRight,
	Globe,
	RefreshCw,
	Server,
	Terminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRuntimeSessionsStore } from "@/main/stores/runtime-sessions";
import { cn } from "@/lib/utils";
import { RuntimeSummaryTile } from "./SharedComponents";
import { RuntimeSessionsSectionList } from "./RuntimeSessionsSectionList";

export const RuntimeSessionsPanel: React.FC = () => {
	const commands = useRuntimeSessionsStore((state) => state.commands);
	const servers = useRuntimeSessionsStore((state) => state.servers);
	const activeWebSession = useRuntimeSessionsStore(
		(state) => state.activeWebSession,
	);
	const refreshRuntimeSessions = useRuntimeSessionsStore(
		(state) => state.refresh,
	);
	const { t } = useTranslation();
	const [collapsed, setCollapsed] = useState(true);
	const [width, setWidth] = useState(320);
	const isDraggingRef = useRef(false);
	const dragStartXRef = useRef(0);
	const dragStartWidthRef = useRef(0);
	const hasWebSession = Boolean(activeWebSession.isOpen);

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
			className="flex-shrink-0 relative"
			style={collapsed ? { width: 64 } : { width }}
		>
			<div className="flex h-full flex-col border-r bg-background">
				<div
					className={cn(
						"flex-shrink-0 border-b bg-muted/20",
						collapsed
							? "flex items-center justify-center px-2 py-2"
							: "flex items-center gap-2 px-2 py-2",
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
								<Server size={13} className="shrink-0" />
								<span className="truncate text-xs font-semibold text-foreground">
									{t("sandboxPanel.title")}
								</span>
							</div>
							<div className="ml-auto flex items-center gap-1">
								<button
									type="button"
									title={t("sandboxPanel.refresh")}
									onClick={() => void refreshRuntimeSessions()}
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
					<div className="flex-1 space-y-2 px-1.5 py-2">
						{hasWebSession ? (
							<RuntimeSummaryTile
								icon={<Globe size={14} />}
								value={1}
								label={t("sandboxPanel.webSessionShort")}
							/>
						) : null}
						{commands.length > 0 ? (
							<RuntimeSummaryTile
								icon={<Terminal size={14} />}
								value={commands.length}
								label={t("sandboxPanel.commandsShort")}
							/>
						) : null}
						{servers.length > 0 ? (
							<RuntimeSummaryTile
								icon={<Server size={14} />}
								value={servers.length}
								label={t("sandboxPanel.serversShort")}
							/>
						) : null}
					</div>
				) : (
					<div className="flex-1 overflow-y-auto p-2">
						<RuntimeSessionsSectionList
							commands={commands}
							servers={servers}
							activeWebSession={activeWebSession}
							onRefresh={refreshRuntimeSessions}
							variant="docked"
						/>
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
