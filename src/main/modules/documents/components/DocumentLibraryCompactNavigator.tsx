import React, { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
	onRenameNode?: (node: DocumentTreeNode, newName: string) => void;
	onDeleteNode?: (node: DocumentTreeNode) => void;
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
		onRenameNode,
		onDeleteNode,
	}: DocumentLibraryCompactNavigatorProps) {
		const { t } = useTranslation("documents");
		const [isCollapsed, setIsCollapsed] = useState(false);
		const isWorkspaceSection = selectedSection === "workspace";
		const activeTree = isWorkspaceSection ? workspaceTree : tree;

		if (isCollapsed) {
			return (
				<aside className="flex h-full flex-col border-r bg-card">
					<button
						onClick={() => setIsCollapsed(false)}
						className="flex items-center justify-center p-2 hover:bg-accent"
						title={t("navigator.expand")}
					>
						<PanelLeftOpen className="h-4 w-4" />
					</button>
				</aside>
			);
		}

		return (
			<aside className="flex h-full w-[42%] min-w-[190px] max-w-[240px] flex-col border-r bg-card">
				<div className="flex items-center gap-1 border-b px-2 py-2">
					<Tabs
						value={selectedSection}
						className="flex-1"
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
					<button
						onClick={() => setIsCollapsed(true)}
						className="flex-shrink-0 rounded p-1 hover:bg-accent"
						title={t("navigator.collapse")}
					>
						<PanelLeftClose className="h-4 w-4" />
					</button>
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
						onRename={onRenameNode}
						onDelete={onDeleteNode}
					/>
				</div>
			</aside>
		);
	},
);
