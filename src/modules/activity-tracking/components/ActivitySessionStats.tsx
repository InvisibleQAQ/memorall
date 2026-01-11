/**
 * Activity Session Statistics Component
 * Displays statistics for a selected session
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/popup/components/ui/card";
import { Badge } from "@/popup/components/ui/badge";
import { Separator } from "@/popup/components/ui/separator";
import type { ActivityStats } from "@/types/activity-tracking";

interface ActivitySessionStatsProps {
	stats: ActivityStats;
}

export const ActivitySessionStats: React.FC<ActivitySessionStatsProps> = ({
	stats,
}) => {
	const { t } = useTranslation("activity");

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("statistics.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div>
						<div className="text-2xl font-bold">{stats.totalActivities}</div>
						<div className="text-sm text-muted-foreground">
							{t("statistics.totalActivities")}
						</div>
					</div>
					<div>
						<div className="text-2xl font-bold">{stats.uniquePages}</div>
						<div className="text-sm text-muted-foreground">
							{t("statistics.uniquePages")}
						</div>
					</div>
					<div>
						<div className="text-2xl font-bold">{stats.byType.page_visit}</div>
						<div className="text-sm text-muted-foreground">
							{t("statistics.pageVisits")}
						</div>
					</div>
					<div>
						<div className="text-2xl font-bold">{stats.byType.click}</div>
						<div className="text-sm text-muted-foreground">
							{t("statistics.clicks")}
						</div>
					</div>
				</div>

				{stats.mostVisitedPages.length > 0 && (
					<>
						<Separator className="my-4" />
						<div>
							<h4 className="font-semibold mb-2">
								{t("statistics.mostVisitedPages")}
							</h4>
							<div className="space-y-1">
								{stats.mostVisitedPages.slice(0, 5).map((page, idx) => (
									<div
										key={idx}
										className="text-sm flex items-center justify-between"
									>
										<span className="truncate flex-1 mr-2">{page.url}</span>
										<Badge variant="secondary">{page.count}</Badge>
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
};
