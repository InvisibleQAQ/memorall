/**
 * TopicFilterDropdown Component
 * Multi-select dropdown for filtering files by topics
 */

import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Plus, Search, Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Topic } from "@/services/database/entities/topics";

interface TopicWithCount extends Topic {
	fileCount: number;
}

interface TopicFilterDropdownProps {
	/** Available topics with file counts */
	topics: TopicWithCount[];
	/** Currently selected topic IDs */
	selectedTopicIds: string[];
	/** Callback when selection changes */
	onSelectionChange: (topicIds: string[]) => void;
	/** Callback to create a new topic */
	onCreateTopic?: () => void;
	/** Loading state */
	loading?: boolean;
	/** Additional CSS classes */
	className?: string;
}

export const TopicFilterDropdown: React.FC<TopicFilterDropdownProps> = ({
	topics,
	selectedTopicIds,
	onSelectionChange,
	onCreateTopic,
	loading = false,
	className,
}) => {
	const { t } = useTranslation("topics");
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	// Filter topics based on search query
	const filteredTopics = useMemo(() => {
		if (!searchQuery.trim()) return topics;

		const query = searchQuery.toLowerCase();
		return topics.filter(
			(topic) =>
				topic.name.toLowerCase().includes(query) ||
				(topic.description && topic.description.toLowerCase().includes(query)),
		);
	}, [topics, searchQuery]);

	// Handle topic selection toggle
	const handleToggleTopic = (topicId: string) => {
		const newSelection = selectedTopicIds.includes(topicId)
			? selectedTopicIds.filter((id) => id !== topicId)
			: [...selectedTopicIds, topicId];

		onSelectionChange(newSelection);
	};

	// Clear all selections
	const handleClearAll = () => {
		onSelectionChange([]);
	};

	// Select all filtered topics
	const handleSelectAll = () => {
		const allFilteredIds = filteredTopics.map((t) => t.id);
		const newSelection = Array.from(
			new Set([...selectedTopicIds, ...allFilteredIds]),
		);
		onSelectionChange(newSelection);
	};

	const selectedCount = selectedTopicIds.length;
	const hasSelection = selectedCount > 0;

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"h-8 md:h-9 gap-2 min-w-[120px] md:min-w-[140px] justify-between",
						hasSelection && "border-primary",
						className,
					)}
					disabled={loading}
				>
					<span className="flex items-center gap-1.5">
						<Tags className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0" />
						<span className="text-xs md:text-sm truncate">
							{hasSelection
								? selectedCount === 1
									? topics.find((t) => t.id === selectedTopicIds[0])?.name ||
										t("filter.oneTopic")
									: t("filter.multipleTopics", { count: selectedCount })
								: t("filter.topics")}
						</span>
					</span>
					<ChevronDown
						className={cn(
							"h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 transition-transform",
							open && "transform rotate-180",
						)}
					/>
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align="start"
				className="w-[280px] p-0"
				onCloseAutoFocus={(e) => {
					// Prevent focus loss when clicking inside dropdown
					e.preventDefault();
				}}
			>
				{/* Search Input */}
				<div className="p-2 border-b">
					<div className="relative">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							placeholder={t("filter.searchPlaceholder")}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="h-8 pl-8 pr-8 text-sm"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.stopPropagation()}
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setSearchQuery("");
								}}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				</div>

				{/* Action Buttons */}
				{hasSelection && (
					<div className="px-2 py-1.5 border-b bg-muted/50 flex items-center justify-between">
						<span className="text-xs text-muted-foreground">
							{t("filter.selectedCount", { count: selectedCount })}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={(e) => {
								e.stopPropagation();
								handleClearAll();
							}}
							className="h-6 px-2 text-xs"
						>
							{t("filter.clearAll")}
						</Button>
					</div>
				)}

				{/* Topic List */}
				<ScrollArea className="max-h-[300px]">
					<div className="p-1">
						{filteredTopics.length === 0 ? (
							<div className="py-6 text-center text-sm text-muted-foreground">
								{searchQuery
									? t("filter.noTopicsFound")
									: t("filter.noTopicsAvailable")}
							</div>
						) : (
							<>
								{/* Select All Option (when searching) */}
								{searchQuery && filteredTopics.length > 1 && (
									<>
										<DropdownMenuItem
											onClick={(e) => {
												e.preventDefault();
												handleSelectAll();
											}}
											className="cursor-pointer"
										>
											<div className="flex items-center gap-2 w-full">
												<div
													className={cn(
														"h-4 w-4 border rounded flex items-center justify-center flex-shrink-0",
														"border-primary",
													)}
												>
													<Check className="h-3 w-3 text-primary" />
												</div>
												<span className="flex-1 text-sm font-medium">
													{t("filter.selectAllResults")}
												</span>
											</div>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
									</>
								)}

								{/* Individual Topics */}
								{filteredTopics.map((topic) => {
									const isSelected = selectedTopicIds.includes(topic.id);

									return (
										<DropdownMenuItem
											key={topic.id}
											onClick={(e) => {
												e.preventDefault();
												handleToggleTopic(topic.id);
											}}
											className="cursor-pointer"
										>
											<div className="flex items-center gap-2 w-full">
												{/* Checkbox */}
												<div
													className={cn(
														"h-4 w-4 border rounded flex items-center justify-center flex-shrink-0",
														isSelected
															? "bg-primary border-primary"
															: "border-input",
													)}
												>
													{isSelected && (
														<Check className="h-3 w-3 text-primary-foreground" />
													)}
												</div>

												{/* Topic Name */}
												<span className="flex-1 text-sm truncate">
													{topic.name}
												</span>

												{/* File Count */}
												<span className="text-xs text-muted-foreground flex-shrink-0 ml-auto">
													{topic.fileCount}
												</span>
											</div>
										</DropdownMenuItem>
									);
								})}
							</>
						)}
					</div>
				</ScrollArea>

				{/* Create New Topic */}
				{onCreateTopic && (
					<>
						<DropdownMenuSeparator />
						<div className="p-1">
							<DropdownMenuItem
								onClick={(e) => {
									e.preventDefault();
									setOpen(false);
									onCreateTopic();
								}}
								className="cursor-pointer text-primary"
							>
								<Plus className="h-4 w-4 mr-2" />
								<span className="text-sm font-medium">
									{t("filter.createNewTopic")}
								</span>
							</DropdownMenuItem>
						</div>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

/**
 * ActiveTopicChips Component
 * Displays removable chips for selected topics
 */

interface ActiveTopicChipsProps {
	/** Selected topics */
	selectedTopics: Topic[];
	/** Callback when a topic is removed */
	onRemoveTopic: (topicId: string) => void;
	/** Callback to clear all topics */
	onClearAll: () => void;
	/** Additional CSS classes */
	className?: string;
}

export const ActiveTopicChips: React.FC<ActiveTopicChipsProps> = ({
	selectedTopics,
	onRemoveTopic,
	onClearAll,
	className,
}) => {
	const { t } = useTranslation("topics");

	if (selectedTopics.length === 0) {
		return null;
	}

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			<span className="text-xs text-muted-foreground">
				{t("filter.filteredBy")}
			</span>

			{selectedTopics.map((topic) => (
				<button
					key={topic.id}
					type="button"
					onClick={() => onRemoveTopic(topic.id)}
					className={cn(
						"inline-flex items-center gap-1 px-2 py-1 rounded-md",
						"text-xs font-medium transition-colors",
						"bg-primary/10 text-primary border border-primary/20",
						"hover:bg-primary/20 hover:border-primary/30",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					)}
				>
					<span className="truncate max-w-[100px]">{topic.name}</span>
					<X className="h-3 w-3 flex-shrink-0" />
				</button>
			))}

			{selectedTopics.length > 1 && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onClearAll}
					className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
				>
					{t("filter.clearAll")}
				</Button>
			)}
		</div>
	);
};
