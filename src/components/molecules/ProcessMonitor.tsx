/**
 * ProcessMonitor Component
 * Displays active processes and history in a header popover
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
	Activity,
	Loader2,
	CheckCircle2,
	XCircle,
	Clock,
	FileText,
} from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	useProcessMonitor,
	useActiveProcessCount,
} from "@/stores/process-monitor";
import { serviceManager } from "@/services";
import { eq, desc } from "drizzle-orm";
import { getEffectiveSourceStatus } from "@/services/database/types";
import type { Source } from "@/services/database/types";
import { logError } from "@/utils/logger";
import { cn } from "@/lib/utils";

const STATUS_ICONS = {
	pending: Clock,
	processing: Loader2,
	completed: CheckCircle2,
	failed: XCircle,
} as const;

const STATUS_COLORS = {
	pending: "text-yellow-500",
	processing: "text-blue-500",
	completed: "text-green-500",
	failed: "text-red-500",
} as const;

// STATUS_LABELS will be created inside component to access translations

interface ProcessItemProps {
	filePath: string;
	name: string;
	status: string;
	progress?: number;
	stage?: string;
	createdAt: Date;
	updatedAt: Date;
	formatRelativeTime: (date: Date) => string;
}

const ProcessItem: React.FC<ProcessItemProps> = ({
	filePath,
	name,
	status,
	progress,
	stage,
	createdAt,
	updatedAt,
	formatRelativeTime,
}) => {
	const { t } = useTranslation("common");
	const StatusIcon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || Clock;
	const statusColor =
		STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "text-gray-500";
	const statusLabel = t(`processMonitor.status.${status}`, status);

	const isActive = status === "processing" || status === "pending";
	const showProgress = isActive && typeof progress === "number";

	return (
		<div className="flex flex-col gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
			<div className="flex items-start gap-3">
				<StatusIcon
					className={cn("h-4 w-4 flex-shrink-0 mt-0.5", statusColor, {
						"animate-spin": status === "processing",
					})}
				/>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<p className="text-sm font-medium truncate" title={name}>
							{name}
						</p>
						<Badge
							variant={status === "completed" ? "default" : "secondary"}
							className="text-xs"
						>
							{statusLabel}
						</Badge>
					</div>
					{stage && (
						<p className="text-xs text-muted-foreground mt-1">{stage}</p>
					)}
					{showProgress && <Progress value={progress} className="h-1.5 mt-2" />}
					<div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
						<span title={createdAt.toLocaleString()}>
							{t("processMonitor.started", {
								time: formatRelativeTime(createdAt),
							})}
						</span>
						{!isActive && (
							<span title={updatedAt.toLocaleString()}>
								{t("processMonitor.finished", {
									time: formatRelativeTime(updatedAt),
								})}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

// formatRelativeTime will be created inside component to access translations

export const ProcessMonitor: React.FC = () => {
	const { t } = useTranslation("common");

	// Create formatRelativeTime with translations
	const formatRelativeTime = (date: Date): string => {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return t("processMonitor.timeAgo.daysAgo", { count: days });
		if (hours > 0)
			return t("processMonitor.timeAgo.hoursAgo", { count: hours });
		if (minutes > 0)
			return t("processMonitor.timeAgo.minutesAgo", { count: minutes });
		return t("processMonitor.timeAgo.justNow");
	};
	const [open, setOpen] = useState(false);
	const activeProcessCount = useActiveProcessCount();
	const {
		activeProcesses,
		processHistory,
		historyLoading,
		setProcessHistory,
		setHistoryLoading,
	} = useProcessMonitor();

	// Infinite scroll state
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const ITEMS_PER_PAGE = 20;

	// Reset pagination when popover opens
	useEffect(() => {
		if (open && processHistory.length === 0) {
			setOffset(0);
			setHasMore(true);
			loadHistory(0);
		}
	}, [open]);

	// Auto-refresh history every 30 seconds when open (only first page)
	useEffect(() => {
		if (!open) return;

		const interval = setInterval(() => {
			loadHistory(0, true); // Refresh first page
		}, 30000);

		return () => clearInterval(interval);
	}, [open]);

	const loadHistory = async (
		newOffset: number = offset,
		isRefresh: boolean = false,
	) => {
		try {
			if (isRefresh) {
				setHistoryLoading(true);
			} else {
				setIsLoadingMore(true);
			}

			await serviceManager.databaseService.use(async ({ db, schema }) => {
				const sources = await db
					.select()
					.from(schema.sources)
					.where(eq(schema.sources.targetType, "file"))
					.orderBy(desc(schema.sources.updatedAt))
					.limit(ITEMS_PER_PAGE + 1) // Load one extra to check if more exist
					.offset(newOffset);

				const hasMoreItems = sources.length > ITEMS_PER_PAGE;
				const itemsToShow = hasMoreItems
					? sources.slice(0, ITEMS_PER_PAGE)
					: sources;

				if (isRefresh || newOffset === 0) {
					// Replace all items on refresh or initial load
					setProcessHistory(itemsToShow as Source[]);
					setOffset(ITEMS_PER_PAGE);
				} else {
					// Append items on load more
					setProcessHistory([...processHistory, ...itemsToShow] as Source[]);
					setOffset(newOffset + ITEMS_PER_PAGE);
				}

				setHasMore(hasMoreItems);
			});
		} catch (error) {
			logError("Failed to load process history:", error);
		} finally {
			setHistoryLoading(false);
			setIsLoadingMore(false);
		}
	};

	// Handle scroll event for infinite loading
	const handleScroll = useCallback(() => {
		if (!scrollContainerRef.current || isLoadingMore || !hasMore) return;

		const { scrollTop, scrollHeight, clientHeight } =
			scrollContainerRef.current;
		const scrolledToBottom = scrollHeight - scrollTop - clientHeight < 100; // Trigger 100px before bottom

		if (scrolledToBottom) {
			loadHistory(offset);
		}
	}, [offset, isLoadingMore, hasMore, processHistory]);

	const activeProcessArray = Array.from(activeProcesses.entries()).map(
		([filePath, process]) => ({
			filePath,
			name: process.name,
			status: process.status || "pending",
			progress: process.progress,
			stage: process.stage,
			createdAt: process.createdAt ? new Date(process.createdAt) : new Date(),
			updatedAt: process.updatedAt ? new Date(process.updatedAt) : new Date(),
		}),
	);

	const historyItems = processHistory
		.filter((source) => {
			// Don't show items that are in activeProcesses
			return !activeProcesses.has(source.targetId);
		})
		.map((source) => {
			const effectiveStatus = getEffectiveSourceStatus(source);
			return {
				filePath: source.targetId,
				name: source.name,
				status: effectiveStatus,
				createdAt: source.createdAt ? new Date(source.createdAt) : new Date(),
				updatedAt: source.updatedAt ? new Date(source.updatedAt) : new Date(),
			};
		});

	const hasActiveProcesses = activeProcessCount > 0;
	const hasHistory = historyItems.length > 0;
	const hasContent = hasActiveProcesses || hasHistory;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative h-8 w-8"
					title={t("processMonitor.viewProcesses")}
				>
					<Activity className="h-4 w-4" />
					{hasActiveProcesses && (
						<span className="absolute top-0 right-0 flex h-2 w-2">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[400px] p-0" align="end">
				<div className="flex items-center justify-between px-4 py-3 border-b">
					<div className="flex items-center gap-2">
						<Activity className="h-4 w-4" />
						<h3 className="font-semibold text-sm">
							{t("processMonitor.title")}
						</h3>
					</div>
					{hasActiveProcesses && (
						<Badge variant="secondary" className="text-xs">
							{t("processMonitor.activeCount", { count: activeProcessCount })}
						</Badge>
					)}
				</div>

				<div
					ref={scrollContainerRef}
					onScroll={handleScroll}
					className="h-[400px] overflow-y-auto"
					style={{ overscrollBehavior: "contain" }}
				>
					{!hasContent && !historyLoading && (
						<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
							<FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
							<p className="text-sm text-muted-foreground">
								{t("processMonitor.noActivity")}
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								{t("processMonitor.noActivityHelp")}
							</p>
						</div>
					)}

					{hasActiveProcesses && (
						<div className="p-2">
							<div className="px-2 py-1.5">
								<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									{t("processMonitor.activeProcesses")}
								</p>
							</div>
							<div className="space-y-1">
								{activeProcessArray.map((process) => (
									<ProcessItem
										key={process.filePath}
										{...process}
										formatRelativeTime={formatRelativeTime}
									/>
								))}
							</div>
						</div>
					)}

					{hasActiveProcesses && hasHistory && <Separator className="my-2" />}

					{hasHistory && (
						<div className="p-2">
							<div className="px-2 py-1.5">
								<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									{t("processMonitor.recentHistory")}
								</p>
							</div>
							<div className="space-y-1">
								{historyItems.map((item) => (
									<ProcessItem
										key={item.filePath}
										{...item}
										formatRelativeTime={formatRelativeTime}
									/>
								))}
							</div>
							{/* Loading more indicator */}
							{isLoadingMore && (
								<div className="flex items-center justify-center py-4">
									<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
									<span className="ml-2 text-sm text-muted-foreground">
										{t("processMonitor.loadingMore")}
									</span>
								</div>
							)}
							{/* End of list indicator */}
							{!hasMore &&
								!isLoadingMore &&
								historyItems.length >= ITEMS_PER_PAGE && (
									<div className="text-center py-4 text-xs text-muted-foreground">
										{t("processMonitor.noMoreHistory")}
									</div>
								)}
						</div>
					)}

					{historyLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};
