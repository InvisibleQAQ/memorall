import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/main/components/ui/tabs";
import { DocumentTreeDraggable } from "./DocumentTreeDraggable";
import type { DocumentTreeNode } from "@/types/document-library";

interface DocumentLibraryCompactNavigatorProps {
	tree: DocumentTreeNode[];
	workspaceTree: DocumentTreeNode[];
	selectedSection: "documents" | "workspace";
	selectedNodeId: string | null;
	docsTitle: string;
	onSelectDocumentsRoot: () => void;
	onSelectWorkspaceRoot: () => void;
	onSelectDocNode: (node: DocumentTreeNode) => void;
	onSelectWorkspaceNode: (node: DocumentTreeNode) => void;
	onToggleExpand: (node: DocumentTreeNode) => void;
	onToggleExpandWorkspace: (node: DocumentTreeNode) => void;
	onMove: (
		nodeId: string,
		targetFolderId: string,
		nodeType: "file" | "folder",
	) => void;
}

export const DocumentLibraryCompactNavigator = memo(
	function DocumentLibraryCompactNavigator({
		tree,
		workspaceTree,
		selectedSection,
		selectedNodeId,
		docsTitle,
		onSelectDocumentsRoot,
		onSelectWorkspaceRoot,
		onSelectDocNode,
		onSelectWorkspaceNode,
		onToggleExpand,
		onToggleExpandWorkspace,
		onMove,
	}: DocumentLibraryCompactNavigatorProps) {
		const { t } = useTranslation("documents");
		const isWorkspaceSection = selectedSection === "workspace";
		const activeTree = isWorkspaceSection ? workspaceTree : tree;

		return (
			<aside className="flex h-full w-[42%] min-w-[190px] max-w-[240px] flex-col border-r bg-card">
				<div className="border-b px-2 py-2">
					<Tabs
						value={selectedSection}
						onValueChange={(value) => {
							if (value === "workspace") {
								onSelectWorkspaceRoot();
								return;
							}
							onSelectDocumentsRoot();
						}}
					>
						<TabsList className="grid h-9 w-full grid-cols-2">
							<TabsTrigger value="documents" className="px-2 text-xs">
								{docsTitle}
							</TabsTrigger>
							<TabsTrigger value="workspace" className="px-2 text-xs">
								{t("sidebar.workspace")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				<div className="min-h-0 flex-1 overflow-hidden">
					<DocumentTreeDraggable
						tree={activeTree}
						selectedId={selectedNodeId}
						onSelectNode={
							isWorkspaceSection ? onSelectWorkspaceNode : onSelectDocNode
						}
						onToggleExpand={
							isWorkspaceSection ? onToggleExpandWorkspace : onToggleExpand
						}
						onMove={isWorkspaceSection ? undefined : onMove}
					/>
				</div>
			</aside>
		);
	},
);
