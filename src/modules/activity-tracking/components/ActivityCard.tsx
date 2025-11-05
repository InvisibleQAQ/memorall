/**
 * Activity Card Component
 * Individual activity card in the timeline
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import type { Activity } from "@/types/activity-tracking";
import {
	formatTimestamp,
	formatDuration,
	getActivityTypeIcon,
	getActivityTypeLabel,
	getActivityTypeColor,
} from "../utils";

interface ActivityCardProps {
	activity: Activity;
	onClick: (activity: Activity) => void;
}

const renderActivityPreview = (
	activity: Activity,
	t: (key: string) => string,
): React.ReactNode => {
	const { data } = activity;

	try {
		switch (data.type) {
			case "page_visit":
				return (
					<div className="text-sm">
						<div className="font-medium truncate">{data.title}</div>
						<div className="text-xs text-muted-foreground truncate">
							{data.url}
						</div>
					</div>
				);

			case "user_input":
				return (
					<div className="text-sm text-muted-foreground">
						{data.isRedacted
							? t("preview.sensitiveInput")
							: `${t("preview.input")}: ${data.content.substring(0, 50)}${data.content.length > 50 ? "..." : ""}`}
					</div>
				);

			case "click":
				return (
					<div className="text-sm text-muted-foreground">
						{t("preview.clicked")} {data.elementInfo.tagName}
						{data.elementInfo.id && (
							<span className="text-primary"> #{data.elementInfo.id}</span>
						)}
					</div>
				);

			case "navigation":
				return (
					<div className="text-sm text-muted-foreground truncate">
						{data.fromUrl
							? `${t("preview.from")} ${new URL(data.fromUrl).hostname}`
							: t("preview.direct")}{" "}
						→ {new URL(data.toUrl).hostname}
					</div>
				);

			case "scroll":
				return (
					<div className="text-sm text-muted-foreground">
						{t("preview.scrolledTo")} {data.scrollDepth.toFixed(0)}%
					</div>
				);

			case "form_submit":
				return (
					<div className="text-sm text-muted-foreground">
						{t("preview.submittedForm")} {data.fieldCount} {t("preview.fields")}
					</div>
				);

			case "network_request":
				return (
					<div className="text-sm text-muted-foreground truncate">
						<span className="font-medium">{data.method}</span>{" "}
						{new URL(data.url).pathname}
					</div>
				);

			case "text_reading":
				return (
					<div className="text-sm text-muted-foreground">
						{t("preview.readFor")} {formatDuration(data.viewDuration)} •{" "}
						{data.textLength.toLocaleString()} chars
					</div>
				);

			default:
				return (
					<div className="text-sm text-muted-foreground">
						{t("preview.activityCaptured")}
					</div>
				);
		}
	} catch (error) {
		return (
			<div className="text-sm text-muted-foreground">
				{t("preview.activityCaptured")}
			</div>
		);
	}
};

export const ActivityCard: React.FC<ActivityCardProps> = ({
	activity,
	onClick,
}) => {
	const { t } = useTranslation("activity");

	return (
		<div className="relative pl-10">
			{/* Timeline dot */}
			<div
				className={`absolute left-0 w-[34px] h-[34px] rounded-full flex items-center justify-center z-10 backdrop-blur-sm transition-all hover:scale-110 ${getActivityTypeColor(activity.type)}`}
			>
				{getActivityTypeIcon(activity.type)}
			</div>

			{/* Activity card - clickable */}
			<div
				className="bg-card/80 backdrop-blur-sm border rounded-lg shadow-sm hover:shadow-lg hover:border-primary/50 transition-all duration-200 cursor-pointer group"
				onClick={() => onClick(activity)}
			>
				{/* Card header */}
				<div className="px-4 py-2.5 border-b bg-gradient-to-r from-muted/50 to-transparent">
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<div className="flex items-center gap-2">
							<Badge variant="outline" className="font-medium text-xs">
								{getActivityTypeLabel(activity.type, t)}
							</Badge>
							<Info
								size={14}
								className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
							/>
						</div>
						<span className="text-xs text-muted-foreground tabular-nums font-mono">
							{formatTimestamp(activity.timestamp)}
						</span>
					</div>
				</div>

				{/* Card content - preview only */}
				<div className="px-4 py-3">{renderActivityPreview(activity, t)}</div>
			</div>
		</div>
	);
};
