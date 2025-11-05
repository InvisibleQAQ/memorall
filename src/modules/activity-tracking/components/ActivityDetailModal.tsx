/**
 * Activity Detail Modal Component
 * Shows detailed information and AI explanation for an activity
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Info } from "lucide-react";
import type { Activity } from "@/types/activity-tracking";
import { ActivityDetails } from "./ActivityDetails";
import {
	getActivityTypeIcon,
	getActivityTypeLabel,
	getActivityTypeModalColor,
} from "../utils";
import { logError } from "@/utils/logger";

interface ActivityDetailModalProps {
	activity: Activity | null;
	onClose: () => void;
	onGenerateExplanation: (activity: Activity) => Promise<string>;
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
	activity,
	onClose,
	onGenerateExplanation,
}) => {
	const { t } = useTranslation("activity");
	const [aiExplanation, setAiExplanation] = useState<string>("");
	const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);

	// Auto-generate explanation when activity changes
	useEffect(() => {
		if (activity) {
			setAiExplanation("");
			generateExplanation(activity);
		}
	}, [activity?.id]);

	const generateExplanation = async (activityToExplain: Activity) => {
		setIsGeneratingExplanation(true);
		try {
			const explanation = await onGenerateExplanation(activityToExplain);
			setAiExplanation(explanation);
		} catch (error) {
			logError("Failed to generate AI explanation:", error);
			setAiExplanation("Failed to generate explanation. Please try again.");
		} finally {
			setIsGeneratingExplanation(false);
		}
	};

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
					<div className="space-y-6">
						{/* AI Explanation Section */}
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Sparkles size={18} className="text-primary" />
								<h3 className="text-lg font-semibold">
									{t("details.aiExplanation")}
								</h3>
							</div>
							<div className="p-4 bg-muted/50 rounded-lg border">
								{isGeneratingExplanation ? (
									<div className="flex items-center gap-2 text-muted-foreground">
										<div className="animate-spin">⚙️</div>
										<span>{t("details.generating")}</span>
									</div>
								) : aiExplanation ? (
									<p className="text-sm leading-relaxed">{aiExplanation}</p>
								) : (
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">
											{t("details.noExplanation")}
										</span>
										<Button
											size="sm"
											variant="outline"
											onClick={() => generateExplanation(activity)}
										>
											{t("details.generate")}
										</Button>
									</div>
								)}
							</div>
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
