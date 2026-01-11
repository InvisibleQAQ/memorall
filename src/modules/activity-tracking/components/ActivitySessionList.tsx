/**
 * Activity Session List Component
 * Displays list of activity tracking sessions
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/popup/components/ui/card";
import { Button } from "@/popup/components/ui/button";
import { Badge } from "@/popup/components/ui/badge";
import { ScrollArea } from "@/popup/components/ui/scroll-area";
import type { ActivitySession } from "@/types/activity-tracking";
import { formatTimestamp, formatDuration } from "../utils";

interface ActivitySessionListProps {
	sessions: ActivitySession[];
	selectedSession: string | null;
	onSelectSession: (sessionId: string) => void;
	onDeleteSession: (sessionId: string) => void;
}

export const ActivitySessionList: React.FC<ActivitySessionListProps> = ({
	sessions,
	selectedSession,
	onSelectSession,
	onDeleteSession,
}) => {
	const { t } = useTranslation("activity");

	return (
		<Card className="md:col-span-1">
			<CardHeader>
				<CardTitle>{t("sessions.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[600px] pr-4">
					<div className="space-y-2">
						{sessions.map((session) => (
							<div
								key={session.id}
								className={`p-3 rounded-lg border cursor-pointer transition-colors ${
									selectedSession === session.id
										? "bg-primary/10 border-primary"
										: "hover:bg-muted"
								}`}
								onClick={() => onSelectSession(session.id)}
							>
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0">
										<div className="font-medium">
											{formatTimestamp(session.startTime)}
										</div>
										<div className="text-sm text-muted-foreground">
											{session.totalActivities} {t("sessions.activities")}
										</div>
										{session.endTime && (
											<div className="text-xs text-muted-foreground">
												{t("sessions.duration")}:{" "}
												{formatDuration(session.endTime - session.startTime)}
											</div>
										)}
									</div>
									<Badge
										variant={
											session.status === "active" ? "default" : "secondary"
										}
									>
										{t(`activity:sessions.status.${session.status}`)}
									</Badge>
								</div>
								{selectedSession === session.id && (
									<Button
										variant="destructive"
										size="sm"
										className="w-full mt-2"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteSession(session.id);
										}}
									>
										{t("common:buttons.delete")} {t("sessions.title")}
									</Button>
								)}
							</div>
						))}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
};
