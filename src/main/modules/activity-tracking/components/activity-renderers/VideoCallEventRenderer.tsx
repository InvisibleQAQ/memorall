/**
 * Video Call Event Renderer
 * User-friendly display for video call activities
 */

import React from "react";
import { Video, Clock, Users } from "lucide-react";
import type { Activity } from "@/types/activity-tracking";

interface VideoCallEventRendererProps {
	activity: Activity;
	expanded?: boolean;
}

export const VideoCallEventRenderer: React.FC<VideoCallEventRendererProps> = ({
	activity,
	expanded = false,
}) => {
	const data = activity.data as any;

	// Extract video call data
	const platform = data.platform || "Unknown Platform";
	const meetingUrl = data.meetingUrl || "";
	const duration = data.duration || 0; // seconds
	const captions = data.captions || [];
	const participantCount = data.participantCount;

	// Platform icons and colors
	const platformConfig: Record<string, { icon: string; color: string }> = {
		zoom: { icon: "🎥", color: "blue" },
		meet: { icon: "📹", color: "green" },
		teams: { icon: "💼", color: "purple" },
		webex: { icon: "🌐", color: "cyan" },
	};

	const config = platformConfig[platform.toLowerCase()] || platformConfig.zoom;
	const durationMin = Math.round(duration / 60);

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-start gap-3">
				<div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 text-xl">
					{config.icon}
				</div>
				<div className="flex-1 min-w-0">
					<h4 className="font-semibold text-base mb-1">Video Call</h4>
					<p className="text-sm text-muted-foreground capitalize">{platform}</p>
				</div>
			</div>

			{/* Call Stats */}
			<div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
				<div className="flex items-center gap-1.5">
					<Clock className="w-4 h-4" />
					<span>{durationMin} min</span>
				</div>
				{participantCount && (
					<div className="flex items-center gap-1.5">
						<Users className="w-4 h-4" />
						<span>{participantCount} participants</span>
					</div>
				)}
			</div>

			{/* Captions Preview */}
			{expanded && captions.length > 0 && (
				<div className="mt-4 p-4 bg-muted/30 rounded-lg border border-muted space-y-2">
					<p className="text-xs font-semibold text-muted-foreground uppercase">
						Meeting Highlights
					</p>
					{captions.slice(0, 5).map((caption: any, index: number) => (
						<div key={index} className="text-sm">
							<span className="text-muted-foreground">
								{caption.speaker && `${caption.speaker}: `}
							</span>
							<span className="text-foreground/80">{caption.text}</span>
						</div>
					))}
					{captions.length > 5 && (
						<p className="text-xs text-muted-foreground">
							+{captions.length - 5} more captions
						</p>
					)}
				</div>
			)}

			{/* Meeting Link */}
			{meetingUrl && (
				<a
					href={meetingUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="text-sm text-primary hover:underline inline-flex items-center gap-1"
				>
					View meeting →
				</a>
			)}
		</div>
	);
};
