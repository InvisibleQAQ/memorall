import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useDocumentLibrary } from "@/main/modules/documents/hooks/useDocumentLibrary";
import { DocumentLibraryHeader } from "@/main/modules/documents/components/DocumentLibraryHeader";
import { DocumentLibrarySidebar } from "@/main/modules/documents/components/DocumentLibrarySidebar";
import { DocumentLibraryContent } from "@/main/modules/documents/components/DocumentLibraryContent";
import { DocumentLibraryCompactNavigator } from "@/main/modules/documents/components/DocumentLibraryCompactNavigator";

export const DocumentLibraryPage: React.FC = () => {
	const { t } = useTranslation("documents");
	const lib = useDocumentLibrary();
	const isPopupSurface =
		typeof document !== "undefined" &&
		document.documentElement.dataset.uiSurface === "popup";
	const activeTree = lib.isWorkspaceSection ? lib.workspaceTree : lib.tree;

	if (lib.loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
			<DocumentLibraryHeader
				currentPath={lib.currentPath}
				activeTree={activeTree}
				homeTitle={lib.isWorkspaceSection ? t("sidebar.workspace") : t("title")}
				isWorkspaceSection={lib.isWorkspaceSection}
				compact={isPopupSurface}
				viewMode={lib.viewMode}
				searchQuery={lib.searchQuery}
				topics={lib.topics}
				selectedTopicIds={lib.selectedTopicIds}
				error={lib.error}
				onNavigate={lib.handleSelectNode}
				onViewModeChange={lib.setViewMode}
				onSearchChange={lib.setSearchQuery}
				onTopicFilterChange={lib.handleTopicFilterChange}
				onRemoveTopicFilter={lib.handleRemoveTopicFilter}
				onClearTopicFilters={lib.handleClearTopicFilters}
				onCreateDocument={lib.handleCreateDocument}
				onTriggerUpload={lib.triggerFileUpload}
				onCreateFolder={lib.handleCreateFolder}
			/>
			{isPopupSurface ? (
				<div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
					<DocumentLibraryCompactNavigator
						tree={lib.tree}
						workspaceTree={lib.workspaceTree}
						selectedSection={lib.selectedSection}
						selectedNodeId={lib.selectedNode?.id ?? null}
						docsTitle={t("title")}
						onSelectDocumentsRoot={lib.handleSelectDocumentsSection}
						onSelectWorkspaceRoot={lib.handleSelectWorkspaceSection}
						onSelectDocNode={lib.handleSelectDocNode}
						onSelectWorkspaceNode={lib.handleSelectWorkspaceNode}
						onToggleExpand={lib.handleToggleExpand}
						onToggleExpandWorkspace={lib.handleToggleExpandWorkspace}
						onMove={lib.handleMove}
					/>
					<div className="min-w-0 flex-1 overflow-hidden">
						<DocumentLibraryContent
							selectedNode={lib.selectedNode}
							isFileSelected={lib.isFileSelected}
							isFolderSelected={lib.isFolderSelected}
							isWorkspaceSection={lib.isWorkspaceSection}
							folderContents={lib.folderContents}
							viewMode={lib.viewMode}
							fileTopicMap={lib.fileTopicMap}
							selectedTopicIds={lib.selectedTopicIds}
							compact={isPopupSurface}
							onSelectNodeById={lib.handleSelectNodeInActiveTree}
							onOpenFolderByPath={lib.handleOpenFolderByPath}
							onCloseViewer={lib.handleCloseViewer}
							onDeleteItem={lib.handleDeleteItem}
							onRenameItem={lib.handleRenameItem}
							onDownloadFile={lib.handleDownloadFile}
							onDownloadSelectedFile={lib.handleDownloadSelectedFile}
							onManageTopics={lib.handleManageFileTopic}
							onConvertToKnowledge={lib.handleConvertToKnowledge}
							onDeleteSelectedFile={lib.handleDeleteSelectedFile}
							onToggleTopicFilter={lib.handleToggleTopicFilter}
						/>
					</div>
				</div>
			) : (
				<div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
					<DocumentLibrarySidebar
						tree={lib.tree}
						workspaceTree={lib.workspaceTree}
						selectedSection={lib.selectedSection}
						selectedNodeId={lib.selectedNode?.id ?? null}
						docsTitle={t("title")}
						onSelectDocNode={lib.handleSelectDocNode}
						onSelectWorkspaceNode={lib.handleSelectWorkspaceNode}
						onSelectWorkspaceRoot={lib.handleSelectWorkspaceSection}
						onToggleExpand={lib.handleToggleExpand}
						onToggleExpandWorkspace={lib.handleToggleExpandWorkspace}
						onMove={lib.handleMove}
					/>
					<div className="min-w-0 flex-1 overflow-hidden">
						<DocumentLibraryContent
							selectedNode={lib.selectedNode}
							isFileSelected={lib.isFileSelected}
							isFolderSelected={lib.isFolderSelected}
							isWorkspaceSection={lib.isWorkspaceSection}
							folderContents={lib.folderContents}
							viewMode={lib.viewMode}
							fileTopicMap={lib.fileTopicMap}
							selectedTopicIds={lib.selectedTopicIds}
							onSelectNodeById={lib.handleSelectNodeInActiveTree}
							onOpenFolderByPath={lib.handleOpenFolderByPath}
							onCloseViewer={lib.handleCloseViewer}
							onDeleteItem={lib.handleDeleteItem}
							onRenameItem={lib.handleRenameItem}
							onDownloadFile={lib.handleDownloadFile}
							onDownloadSelectedFile={lib.handleDownloadSelectedFile}
							onManageTopics={lib.handleManageFileTopic}
							onConvertToKnowledge={lib.handleConvertToKnowledge}
							onDeleteSelectedFile={lib.handleDeleteSelectedFile}
							onToggleTopicFilter={lib.handleToggleTopicFilter}
						/>
					</div>
				</div>
			)}
		</div>
	);
};
