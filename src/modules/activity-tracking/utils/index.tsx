/**
 * Activity Tracking Utilities
 * Shared formatting and rendering functions
 */

import React from "react";
import {
	Globe,
	Network,
	Keyboard,
	MousePointer,
	ArrowDownUp,
	Navigation as NavigationIcon,
	FileCheck,
	BookOpen,
} from "lucide-react";
import type { ActivityType } from "@/types/activity-tracking";

export const formatTimestamp = (timestamp: number): string => {
	return new Date(timestamp).toLocaleString();
};

export const formatDuration = (ms: number): string => {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	} else {
		return `${seconds}s`;
	}
};

export const getActivityTypeIcon = (type: ActivityType): React.ReactNode => {
	const iconProps = { size: 20, strokeWidth: 2 };
	const icons: Record<ActivityType, React.ReactNode> = {
		page_visit: <Globe {...iconProps} />,
		network_request: <Network {...iconProps} />,
		user_input: <Keyboard {...iconProps} />,
		click: <MousePointer {...iconProps} />,
		scroll: <ArrowDownUp {...iconProps} />,
		navigation: <NavigationIcon {...iconProps} />,
		form_submit: <FileCheck {...iconProps} />,
		text_reading: <BookOpen {...iconProps} />,
	};
	return icons[type] || <Globe {...iconProps} />;
};

export const getActivityTypeLabel = (
	type: ActivityType,
	t?: (key: string) => string,
): string => {
	if (t) {
		return t(`activity:activityTypes.${type}`);
	}
	// Fallback for when t is not provided
	const labels: Record<ActivityType, string> = {
		page_visit: "Page Visit",
		network_request: "Network Request",
		user_input: "User Input",
		click: "Click",
		scroll: "Scroll",
		navigation: "Navigation",
		form_submit: "Form Submit",
		text_reading: "Text Reading",
	};
	return labels[type] || type;
};

export const getActivityTypeColor = (type: ActivityType): string => {
	const colors: Record<ActivityType, string> = {
		page_visit:
			"bg-blue-500/30 text-blue-600 dark:text-blue-400 border-2 border-blue-500 shadow-lg shadow-blue-500/20",
		network_request:
			"bg-purple-500/30 text-purple-600 dark:text-purple-400 border-2 border-purple-500 shadow-lg shadow-purple-500/20",
		user_input:
			"bg-green-500/30 text-green-600 dark:text-green-400 border-2 border-green-500 shadow-lg shadow-green-500/20",
		click:
			"bg-orange-500/30 text-orange-600 dark:text-orange-400 border-2 border-orange-500 shadow-lg shadow-orange-500/20",
		scroll:
			"bg-cyan-500/30 text-cyan-600 dark:text-cyan-400 border-2 border-cyan-500 shadow-lg shadow-cyan-500/20",
		navigation:
			"bg-indigo-500/30 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-500 shadow-lg shadow-indigo-500/20",
		form_submit:
			"bg-pink-500/30 text-pink-600 dark:text-pink-400 border-2 border-pink-500 shadow-lg shadow-pink-500/20",
		text_reading:
			"bg-amber-500/30 text-amber-600 dark:text-amber-400 border-2 border-amber-500 shadow-lg shadow-amber-500/20",
	};
	return colors[type] || "bg-muted/50 border-2 border-muted";
};

export const getActivityTypeModalColor = (type: ActivityType): string => {
	const colors: Record<ActivityType, string> = {
		page_visit: "bg-blue-500/20 text-blue-600",
		network_request: "bg-purple-500/20 text-purple-600",
		user_input: "bg-green-500/20 text-green-600",
		click: "bg-orange-500/20 text-orange-600",
		scroll: "bg-cyan-500/20 text-cyan-600",
		navigation: "bg-indigo-500/20 text-indigo-600",
		form_submit: "bg-pink-500/20 text-pink-600",
		text_reading: "bg-amber-500/20 text-amber-600",
	};
	return colors[type] || "bg-muted";
};
