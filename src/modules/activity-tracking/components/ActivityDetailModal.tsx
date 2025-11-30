/**
 * Activity Detail Modal Component
 * Shows detailed information and AI explanation for an activity
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Info, MessageSquare } from "lucide-react";
import type { Activity } from "@/types/activity-tracking";
import { ActivityDetails } from "./ActivityDetails";
import {
	getActivityTypeIcon,
	getActivityTypeLabel,
	getActivityTypeModalColor,
} from "../utils";
import {
	ReadingEventRenderer,
	YouTubeEventRenderer,
	VideoCallEventRenderer,
	PageVisitEventRenderer,
	InteractionEventRenderer,
} from "./activity-renderers";

interface ActivityDetailModalProps {
	activity: Activity | null;
	onClose: () => void;
	onAnalyzeWithAI?: (activity: Activity) => void;
}

// Render user-friendly activity content
const renderActivityContent = (activity: Activity): React.ReactNode => {
	const data = activity.data as any;

	switch (data.type) {
		case "content_reading":
			return <ReadingEventRenderer activity={activity} expanded={true} />;
		case "youtube_video":
			return <YouTubeEventRenderer activity={activity} expanded={true} />;
		case "video_call":
			return <VideoCallEventRenderer activity={activity} expanded={true} />;
		case "page_visit":
			return <PageVisitEventRenderer activity={activity} expanded={true} />;
		case "user_input":
		case "click":
			return <InteractionEventRenderer activity={activity} expanded={true} />;
		default:
			return null;
	}
};

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
	activity,
	onClose,
	onAnalyzeWithAI,
}) => {
	const { t } = useTranslation("activity");

	return (
		<Dialog open={!!activity} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center ${
								activity ? getActivityTypeModalColor(activity.type) : "bg-muted"
							}`}
						>
							{activity && getActivityTypeIcon(activity.type)}
						</div>
						<span>{activity && getActivityTypeLabel(activity.type, t)}</span>
					</DialogTitle>
					<DialogDescription>{t("details.title")}</DialogDescription>
				</DialogHeader>

				{activity && (
					<div className="space-y-6 max-w-full overflow-hidden">
						{/* User-Friendly Content Preview */}
						{renderActivityContent(activity) && (
							<div className="bg-card border rounded-lg p-6">
								{renderActivityContent(activity)}
							</div>
						)}

						{/* AI Explanation Section */}
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Sparkles size={18} className="text-primary" />
								<h3 className="text-lg font-semibold">
									{t("details.aiExplanation")}
								</h3>
							</div>
							{onAnalyzeWithAI && (
								<Button
									onClick={() => onAnalyzeWithAI(activity)}
									variant="secondary"
									className="w-full gap-2"
								>
									<MessageSquare size={18} />
									{t("details.analyzeWithChat")}
								</Button>
							)}
						</div>

						{/* Detailed Fields - Collapsed by default */}
						<details className="space-y-3 border rounded-lg p-4 bg-muted/20">
							<summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground flex items-center gap-2">
								<Info size={18} className="text-primary" />
								<span>{t("details.viewTechnicalDetails")}</span>
							</summary>
							<div className="mt-4">
								<ActivityDetails activity={activity} />
							</div>
						</details>

						{/* Raw Data Section */}
						<details className="space-y-2 border rounded-lg p-4 bg-muted/20">
							<summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
								{t("details.viewRawData")}
							</summary>
							<pre className="bg-muted p-4 rounded text-xs overflow-x-auto max-h-60 font-mono mt-2">
								{JSON.stringify(activity, null, 2)}
							</pre>
						</details>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};
