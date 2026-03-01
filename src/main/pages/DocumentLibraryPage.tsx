import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useDocumentLibrary } from "@/main/modules/documents/hooks/useDocumentLibrary";
import { DocumentLibraryHeader } from "@/main/modules/documents/components/DocumentLibraryHeader";
import { DocumentLibrarySidebar } from "@/main/modules/documents/components/DocumentLibrarySidebar";
import { DocumentLibraryContent } from "@/main/modules/documents/components/DocumentLibraryContent";

export const DocumentLibraryPage: React.FC = () => {
	const { t } = useTranslation("documents");
	const lib = useDocumentLibrary();
	const activeTree = lib.isWorkspaceSection ? lib.workspaceTree : lib.tree;

	if (lib.loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full overflow-hidden bg-background">
			<DocumentLibraryHeader
				currentPath={lib.currentPath}
				activeTree={activeTree}
				homeTitle={lib.isWorkspaceSection ? "Workspace" : t("title")}
				isWorkspaceSection={lib.isWorkspaceSection}
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
			<div className="flex-1 flex overflow-hidden">
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
	);
};
