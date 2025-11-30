/**
 * Page Visit Event Renderer
 * User-friendly display for page visit activities
 */

import React from "react";
import { Globe, Clock, ExternalLink } from "lucide-react";
import type { Activity } from "@/types/activity-tracking";

interface PageVisitEventRendererProps {
	activity: Activity;
	expanded?: boolean;
}

export const PageVisitEventRenderer: React.FC<PageVisitEventRendererProps> = ({
	activity,
	expanded = false,
}) => {
	const data = activity.data as any;

	// Extract page visit data
	const title = data.title || "Untitled Page";
	const url = data.url || "";
	const duration = data.duration; // milliseconds
	const startTime = data.startTime
		? new Date(data.startTime).toLocaleTimeString()
		: "";
	const endTime = data.endTime
		? new Date(data.endTime).toLocaleTimeString()
		: "";

	// Get favicon
	const domain = url ? new URL(url).hostname : "";
	const faviconUrl = url ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : "";

	// Format duration
	const durationText = duration
		? duration < 60000
			? `${Math.round(duration / 1000)}s`
			: `${Math.round(duration / 60000)}min`
		: "Quick visit";

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-start gap-3">
				{faviconUrl ? (
					<div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
						<img
							src={faviconUrl}
							alt=""
							className="w-6 h-6"
							onError={(e) => {
								e.currentTarget.style.display = "none";
								e.currentTarget.parentElement!.innerHTML = "🌐";
							}}
						/>
					</div>
				) : (
					<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
						<Globe className="w-5 h-5 text-blue-500" />
					</div>
				)}
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-base mb-1 line-clamp-2">{title}</h4>
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-muted-foreground hover:text-primary truncate block flex items-center gap-1"
					>
						{domain}
						<ExternalLink className="w-3 h-3" />
					</a>
				</div>
			</div>

			{/* Visit Stats */}
			<div className="flex items-center gap-4 text-sm text-muted-foreground">
				<div className="flex items-center gap-1.5">
					<Clock className="w-4 h-4" />
					<span>{durationText}</span>
				</div>
				{startTime && endTime && expanded && (
					<span className="text-xs">
						{startTime} - {endTime}
					</span>
				)}
			</div>

			{/* URL Preview (expanded) */}
			{expanded && url && (
				<div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded truncate font-mono">
					{url}
				</div>
			)}
		</div>
	);
};
