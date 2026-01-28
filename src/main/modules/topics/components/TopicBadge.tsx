/**
 * TopicBadge Component
 * Displays a colorful, clickable badge for a topic tag
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Topic } from "@/services/database/types";

interface TopicBadgeProps {
	/** Topic to display */
	topic: Topic;
	/** Size variant */
	size?: "sm" | "md";
	/** Click handler for badge */
	onClick?: (topic: Topic) => void;
	/** Show remove button */
	onRemove?: (topic: Topic) => void;
	/** Whether badge is active/selected */
	isActive?: boolean;
	/** Additional CSS classes */
	className?: string;
}

// Pastel color palette - consistent with TopicsPage design
const TOPIC_COLORS = [
	{
		bg: "bg-yellow-100 dark:bg-yellow-900/30",
		border: "border-yellow-300 dark:border-yellow-700",
		text: "text-yellow-800 dark:text-yellow-200",
		hover: "hover:bg-yellow-200 dark:hover:bg-yellow-900/50",
		active: "bg-yellow-300 dark:bg-yellow-800/60",
	},
	{
		bg: "bg-pink-100 dark:bg-pink-900/30",
		border: "border-pink-300 dark:border-pink-700",
		text: "text-pink-800 dark:text-pink-200",
		hover: "hover:bg-pink-200 dark:hover:bg-pink-900/50",
		active: "bg-pink-300 dark:bg-pink-800/60",
	},
	{
		bg: "bg-blue-100 dark:bg-blue-900/30",
		border: "border-blue-300 dark:border-blue-700",
		text: "text-blue-800 dark:text-blue-200",
		hover: "hover:bg-blue-200 dark:hover:bg-blue-900/50",
		active: "bg-blue-300 dark:bg-blue-800/60",
	},
	{
		bg: "bg-green-100 dark:bg-green-900/30",
		border: "border-green-300 dark:border-green-700",
		text: "text-green-800 dark:text-green-200",
		hover: "hover:bg-green-200 dark:hover:bg-green-900/50",
		active: "bg-green-300 dark:bg-green-800/60",
	},
	{
		bg: "bg-purple-100 dark:bg-purple-900/30",
		border: "border-purple-300 dark:border-purple-700",
		text: "text-purple-800 dark:text-purple-200",
		hover: "hover:bg-purple-200 dark:hover:bg-purple-900/50",
		active: "bg-purple-300 dark:bg-purple-800/60",
	},
	{
		bg: "bg-orange-100 dark:bg-orange-900/30",
		border: "border-orange-300 dark:border-orange-700",
		text: "text-orange-800 dark:text-orange-200",
		hover: "hover:bg-orange-200 dark:hover:bg-orange-900/50",
		active: "bg-orange-300 dark:bg-orange-800/60",
	},
] as const;

/**
 * Get consistent color for a topic based on its ID
 */
const getTopicColor = (topicId: string) => {
	const hash = topicId
		.split("")
		.reduce((acc, char) => acc + char.charCodeAt(0), 0);
	return TOPIC_COLORS[hash % TOPIC_COLORS.length];
};

export const TopicBadge: React.FC<TopicBadgeProps> = ({
	topic,
	size = "sm",
	onClick,
	onRemove,
	isActive = false,
	className,
}) => {
	const { t } = useTranslation("topics");
	const color = getTopicColor(topic.id);

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onClick?.(topic);
	};

	const handleRemove = (e: React.MouseEvent) => {
		e.stopPropagation();
		onRemove?.(topic);
	};

	const sizeClasses = {
		sm: "text-xs px-2 py-0.5 gap-1",
		md: "text-sm px-2.5 py-1 gap-1.5",
	};

	const iconSize = {
		sm: "h-3 w-3",
		md: "h-3.5 w-3.5",
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={!onClick && !onRemove}
			className={cn(
				// Base styles
				"inline-flex items-center rounded-full border font-medium transition-all",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
				// Size
				sizeClasses[size],
				// Colors
				isActive ? color.active : color.bg,
				color.border,
				color.text,
				// Hover (only if interactive)
				(onClick || onRemove) && !isActive && color.hover,
				// Cursor
				onClick || onRemove ? "cursor-pointer" : "cursor-default",
				// Custom classes
				className,
			)}
			title={topic.description || topic.name}
		>
			<span className="truncate max-w-[120px]">{topic.name}</span>
			{onRemove && (
				<X
					className={cn(iconSize[size], "flex-shrink-0")}
					onClick={handleRemove}
					aria-label={t("badge.removeAriaLabel", { name: topic.name })}
				/>
			)}
		</button>
	);
};

/**
 * TopicBadgeList Component
 * Displays a list of topic badges with optional "show more" functionality
 */

interface TopicBadgeListProps {
	/** Topics to display */
	topics: Topic[];
	/** Maximum number of badges to show before "+N more" */
	maxVisible?: number;
	/** Size variant */
	size?: "sm" | "md";
	/** Click handler for individual badges */
	onTopicClick?: (topic: Topic) => void;
	/** Remove handler for individual badges */
	onTopicRemove?: (topic: Topic) => void;
	/** Active topic IDs */
	activeTopicIds?: string[];
	/** Additional CSS classes */
	className?: string;
}

export const TopicBadgeList: React.FC<TopicBadgeListProps> = ({
	topics,
	maxVisible = 3,
	size = "sm",
	onTopicClick,
	onTopicRemove,
	activeTopicIds = [],
	className,
}) => {
	const { t } = useTranslation("topics");
	const [showAll, setShowAll] = React.useState(false);

	const visibleTopics = showAll ? topics : topics.slice(0, maxVisible);
	const hiddenCount = topics.length - maxVisible;

	if (topics.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-wrap items-center gap-1", className)}>
			{visibleTopics.map((topic) => (
				<TopicBadge
					key={topic.id}
					topic={topic}
					size={size}
					onClick={onTopicClick}
					onRemove={onTopicRemove}
					isActive={activeTopicIds.includes(topic.id)}
				/>
			))}
			{!showAll && hiddenCount > 0 && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						setShowAll(true);
					}}
					className={cn(
						"inline-flex items-center rounded-full border bg-muted text-muted-foreground",
						"hover:bg-muted/80 transition-colors cursor-pointer",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						sizeClasses[size],
					)}
				>
					{t("badge.showMore", { count: hiddenCount })}
				</button>
			)}
		</div>
	);
};

// Size classes for the +N more button
const sizeClasses = {
	sm: "text-xs px-2 py-0.5",
	md: "text-sm px-2.5 py-1",
};
