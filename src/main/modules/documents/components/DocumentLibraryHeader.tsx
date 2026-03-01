import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import NiceModal from "@ebay/nice-modal-react";
import {
	Upload,
	FolderPlus,
	Grid3x3,
	List,
	Search,
	AlertCircle,
	Plus,
	FileText,
} from "lucide-react";
import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/main/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/main/components/ui/alert";
import { DocumentBreadcrumb } from "./DocumentBreadcrumb";
import {
	TopicFilterDropdown,
	ActiveTopicChips,
} from "@/main/modules/topics/components";
import { CreateFolderDialog } from "../modals";
import type { DocumentTreeNode } from "@/types/document-library";
import type { Topic } from "@/services/database/entities/topics";

interface DocumentLibraryHeaderProps {
	currentPath: string;
	activeTree: DocumentTreeNode[];
	homeTitle: string;
	isWorkspaceSection: boolean;
	viewMode: "grid" | "list";
	searchQuery: string;
	topics: Array<Topic & { fileCount: number }>;
	selectedTopicIds: string[];
	error: string | null;
	onNavigate: (node: DocumentTreeNode | null) => void;
	onViewModeChange: (mode: "grid" | "list") => void;
	onSearchChange: (q: string) => void;
	onTopicFilterChange: (ids: string[]) => void;
	onRemoveTopicFilter: (id: string) => void;
	onClearTopicFilters: () => void;
	onCreateDocument: () => void;
	onTriggerUpload: () => void;
	onCreateFolder: (name: string) => Promise<void>;
}

export const DocumentLibraryHeader = memo(function DocumentLibraryHeader({
	currentPath,
	activeTree,
	homeTitle,
	isWorkspaceSection,
	viewMode,
	searchQuery,
	topics,
	selectedTopicIds,
	error,
	onNavigate,
	onViewModeChange,
	onSearchChange,
	onTopicFilterChange,
	onRemoveTopicFilter,
	onClearTopicFilters,
	onCreateDocument,
	onTriggerUpload,
	onCreateFolder,
}: DocumentLibraryHeaderProps) {
	const { t } = useTranslation("documents");

	return (
		<div className="border-b bg-card">
			{/* Row 1: Breadcrumb + Actions */}
			<div className="flex items-center justify-between gap-2 px-2 md:px-3 py-2 border-b">
				<DocumentBreadcrumb
					currentPath={currentPath}
					tree={activeTree}
					onNavigate={onNavigate}
					homeTitle={homeTitle}
				/>

				<div className="flex items-center gap-1 flex-shrink-0">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="sm" className="h-8 gap-1.5">
								<Plus className="h-4 w-4" />
								<span className="hidden md:inline">{t("library.add")}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onCreateDocument}>
								<FileText className="h-4 w-4 mr-2" />
								{t("upload.createDocument", { defaultValue: "New Document" })}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onTriggerUpload}>
								<Upload className="h-4 w-4 mr-2" />
								{t("upload.uploadFiles")}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									NiceModal.show(CreateFolderDialog, {
										onCreateFolder,
									})
								}
							>
								<FolderPlus className="h-4 w-4 mr-2" />
								{t("upload.createFolder")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Row 2: Search + Topic Filter + View Controls */}
			<div className="flex items-center gap-2 px-2 md:px-3 py-2">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<div className="relative flex-1 min-w-0">
						<Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
						<Input
							placeholder={t("library.searchPlaceholder")}
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
							className="pl-8 md:pl-10 h-8 md:h-9 text-sm"
						/>
					</div>

					{!isWorkspaceSection && (
						<TopicFilterDropdown
							topics={topics}
							selectedTopicIds={selectedTopicIds}
							onSelectionChange={onTopicFilterChange}
							className="flex-shrink-0"
						/>
					)}
				</div>

				<div className="flex items-center gap-0.5 border rounded-md p-0.5 flex-shrink-0">
					<Button
						variant={viewMode === "list" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => onViewModeChange("list")}
						className="h-6 w-6 md:h-7 md:w-7 p-0"
						title={t("library.listView")}
					>
						<List className="h-3.5 w-3.5 md:h-4 md:w-4" />
					</Button>
					<Button
						variant={viewMode === "grid" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => onViewModeChange("grid")}
						className="h-6 w-6 md:h-7 md:w-7 p-0"
						title={t("library.gridView")}
					>
						<Grid3x3 className="h-3.5 w-3.5 md:h-4 md:w-4" />
					</Button>
				</div>
			</div>

			{!isWorkspaceSection && selectedTopicIds.length > 0 && (
				<div className="px-2 md:px-3 pb-2">
					<ActiveTopicChips
						selectedTopics={topics.filter((t) =>
							selectedTopicIds.includes(t.id),
						)}
						onRemoveTopic={onRemoveTopicFilter}
						onClearAll={onClearTopicFilters}
					/>
				</div>
			)}

			{error && (
				<div className="px-3 pb-2">
					<Alert variant="destructive">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				</div>
			)}
		</div>
	);
});
