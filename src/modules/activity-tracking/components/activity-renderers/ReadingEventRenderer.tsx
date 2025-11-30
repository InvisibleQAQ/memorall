/**
 * Reading Event Renderer
 * User-friendly display for content reading activities
 */

import React from "react";
import { Book, Clock, FileText } from "lucide-react";
import type { Activity } from "@/types/activity-tracking";
import { formatDuration } from "../../utils";

interface ReadingEventRendererProps {
	activity: Activity;
	expanded?: boolean;
}

export const ReadingEventRenderer: React.FC<ReadingEventRendererProps> = ({
	activity,
	expanded = false,
}) => {
	const data = activity.data as any;

	// Extract reading data
	const pageTitle = data.pageTitle || "Untitled Page";
	const pageUrl = data.pageUrl || "";
	const mainContent = data.mainContent || "";
	const wordCount = data.contentMetadata?.wordCount || 0;
	const viewDuration = data.readingMetrics?.viewDuration || 0;
	const excerpt =
		data.contentMetadata?.excerpt || mainContent.substring(0, 200);

	// Calculate reading stats
	const readingTime = Math.round(viewDuration / 1000 / 60); // minutes
	const readingSpeed = readingTime > 0 ? Math.round(wordCount / readingTime) : 0;

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-start gap-3">
				<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
					<Book className="w-5 h-5 text-blue-500" />
				</div>
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-base mb-1 line-clamp-2">{pageTitle}</h4>
					<a
						href={pageUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-muted-foreground hover:text-primary truncate block"
					>
						{new URL(pageUrl).hostname}
					</a>
				</div>
			</div>

			{/* Reading Stats */}
			<div className="flex items-center gap-4 text-sm text-muted-foreground">
				<div className="flex items-center gap-1.5">
					<Clock className="w-4 h-4" />
					<span>{readingTime} min read</span>
				</div>
				<div className="flex items-center gap-1.5">
					<FileText className="w-4 h-4" />
					<span>{wordCount.toLocaleString()} words</span>
				</div>
				{readingSpeed > 0 && (
					<span className="text-xs">~{readingSpeed} wpm</span>
				)}
			</div>

			{/* Content Preview */}
			{expanded && excerpt && (
				<div className="mt-4 p-4 bg-muted/30 rounded-lg border border-muted">
					<p className="text-sm leading-relaxed text-foreground/80 italic line-clamp-6">
						"{excerpt}..."
					</p>
					{mainContent.length > 200 && (
						<button className="text-xs text-primary hover:underline mt-2">
							Read full content →
						</button>
					)}
				</div>
			)}

			{!expanded && excerpt && (
				<p className="text-sm text-muted-foreground line-clamp-2 italic">
					"{excerpt}..."
				</p>
			)}
		</div>
	);
};
