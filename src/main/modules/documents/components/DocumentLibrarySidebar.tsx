import React, { memo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DocumentTreeDraggable } from "./DocumentTreeDraggable";
import type { DocumentTreeNode } from "@/types/document-library";
import { cn } from "@/lib/utils";

interface DocumentLibrarySidebarProps {
	tree: DocumentTreeNode[];
	workspaceTree: DocumentTreeNode[];
	selectedSection: "documents" | "workspace";
	selectedNodeId: string | null;
	docsTitle: string;
	onSelectDocNode: (node: DocumentTreeNode) => void;
	onSelectWorkspaceNode: (node: DocumentTreeNode) => void;
	/** Called when the user clicks the "Workspace" section header. */
	onSelectWorkspaceRoot: () => void;
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

export const DocumentLibrarySidebar = memo(function DocumentLibrarySidebar({
	tree,
	workspaceTree,
	selectedSection,
	selectedNodeId,
	docsTitle,
	onSelectDocNode,
	onSelectWorkspaceNode,
	onSelectWorkspaceRoot,
	onToggleExpand,
	onToggleExpandWorkspace,
	onMove,
	onRenameNode,
	onDeleteNode,
}: DocumentLibrarySidebarProps) {
	const { t } = useTranslation("documents");
	const [docsExpanded, setDocsExpanded] = useState(true);
	const [workspaceExpanded, setWorkspaceExpanded] = useState(true);

	return (
		<div className="hidden h-full bg-background md:flex md:flex-col overflow-hidden flex-shrink-0">
			{/* Documents Section */}
			<button
				className={cn(
					"flex items-center gap-1.5 px-2 py-2 text-xs font-semibold uppercase tracking-wide transition-colors flex-shrink-0 text-left w-full",
					selectedSection === "documents"
						? "text-foreground"
						: "text-muted-foreground hover:text-foreground",
				)}
				onClick={() => setDocsExpanded((v) => !v)}
			>
				{docsExpanded ? (
					<ChevronDown className="h-3 w-3 flex-shrink-0" />
				) : (
					<ChevronRight className="h-3 w-3 flex-shrink-0" />
				)}
				{docsTitle}
			</button>

			{docsExpanded && (
				<div className="flex-1 overflow-hidden min-h-0">
					<DocumentTreeDraggable
						tree={tree}
						selectedId={selectedSection === "documents" ? selectedNodeId : null}
						onSelectNode={onSelectDocNode}
						onToggleExpand={onToggleExpand}
						onMove={onMove}
						onRename={onRenameNode}
						onDelete={onDeleteNode}
					/>
				</div>
			)}

			{/* Workspace Section */}
			<button
				className={cn(
					"flex items-center gap-1.5 px-2 py-2 text-xs font-semibold uppercase tracking-wide transition-colors flex-shrink-0 text-left w-full border-t",
					selectedSection === "workspace"
						? "text-foreground"
						: "text-muted-foreground hover:text-foreground",
				)}
				onClick={() => {
					setWorkspaceExpanded((v) => !v);
					onSelectWorkspaceRoot();
				}}
			>
				{workspaceExpanded ? (
					<ChevronDown className="h-3 w-3 flex-shrink-0" />
				) : (
					<ChevronRight className="h-3 w-3 flex-shrink-0" />
				)}
				{t("sidebar.workspace")}
			</button>

			{workspaceExpanded && (
				<div className="overflow-hidden flex-shrink-0 max-h-48 lg:max-h-64">
					<DocumentTreeDraggable
						tree={workspaceTree}
						selectedId={selectedSection === "workspace" ? selectedNodeId : null}
						onSelectNode={onSelectWorkspaceNode}
						onToggleExpand={onToggleExpandWorkspace}
						onRename={onRenameNode}
						onDelete={onDeleteNode}
					/>
				</div>
			)}
		</div>
	);
});
