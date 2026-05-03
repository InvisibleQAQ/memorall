import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useDocumentLibrary } from "@/main/modules/documents/hooks/use-document-library";
import { DocumentLibraryHeader } from "@/main/modules/documents/components/DocumentLibraryHeader";
import { DocumentLibrarySidebar } from "@/main/modules/documents/components/DocumentLibrarySidebar";
import { DocumentLibraryContent } from "@/main/modules/documents/components/DocumentLibraryContent";
import { DocumentLibraryCompactNavigator } from "@/main/modules/documents/components/DocumentLibraryCompactNavigator";
import type { DocumentTreeNode } from "@/types/document-library";

const PANEL_STORAGE_KEY = "memorall.documents.workspace-panels.v1";
const DEFAULT_PANEL_SIZES = [22, 78] as const;
const MIN_PANEL_SIZES = [16, 36] as const;
const DESKTOP_BREAKPOINT = 1180;
const DESKTOP_SEPARATOR_TRACK = 2;

const clampPair = (
	nextPrimary: number,
	total: number,
	minPrimary: number,
	minSecondary: number,
): [number, number] => {
	const clampedPrimary = Math.min(
		total - minSecondary,
		Math.max(minPrimary, nextPrimary),
	);
	return [clampedPrimary, total - clampedPrimary];
};

const readStoredPanelSizes = (): [number, number] => {
	if (typeof window === "undefined") return [...DEFAULT_PANEL_SIZES];
	try {
		const raw = window.localStorage.getItem(PANEL_STORAGE_KEY);
		if (!raw) return [...DEFAULT_PANEL_SIZES];
		const parsed = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.length === 2 &&
			parsed.every((value) => typeof value === "number")
		) {
			return [parsed[0], parsed[1]];
		}
	} catch {
		// Fall back to defaults when localStorage is unavailable or corrupt.
	}
	return [...DEFAULT_PANEL_SIZES];
};

export const DocumentLibraryPage: React.FC = () => {
	const { t } = useTranslation("documents");
	const lib = useDocumentLibrary();
	const [panelSizes, setPanelSizes] =
		React.useState<[number, number]>(readStoredPanelSizes);
	const [isDesktop, setIsDesktop] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const isPopupSurface =
		typeof document !== "undefined" &&
		document.documentElement.dataset.uiSurface === "popup";
	const activeTree = lib.isWorkspaceSection ? lib.workspaceTree : lib.tree;

	const handleResizeStart = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!isDesktop || !containerRef.current) return;
			event.preventDefault();
			const startX = event.clientX;
			const startSizes = panelSizes;
			const containerWidth = containerRef.current.getBoundingClientRect().width;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			const handlePointerMove = (pointerEvent: MouseEvent) => {
				const deltaInFr =
					((pointerEvent.clientX - startX) / containerWidth) *
					(startSizes[0] + startSizes[1]);
				setPanelSizes(() => {
					const [left, right] = clampPair(
						startSizes[0] + deltaInFr,
						startSizes[0] + startSizes[1],
						MIN_PANEL_SIZES[0],
						MIN_PANEL_SIZES[1],
					);
					return [left, right];
				});
			};
			const handlePointerUp = () => {
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				window.removeEventListener("mousemove", handlePointerMove);
				window.removeEventListener("mouseup", handlePointerUp);
			};
			window.addEventListener("mousemove", handlePointerMove);
			window.addEventListener("mouseup", handlePointerUp);
		},
		[isDesktop, panelSizes],
	);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const handleViewportChange = () => {
			const isPopup = document.documentElement.dataset.uiSurface === "popup";
			setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT && !isPopup);
		};
		handleViewportChange();
		window.addEventListener("resize", handleViewportChange);
		return () => window.removeEventListener("resize", handleViewportChange);
	}, []);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panelSizes));
	}, [panelSizes]);

	const handleTreeRename = useCallback(
		(node: DocumentTreeNode, newName: string) => {
			if (node.type === "file" && node.file) {
				lib.handleRenameItem({ type: "file", item: node.file }, newName);
			} else if (node.type === "folder" && node.folder) {
				lib.handleRenameItem({ type: "folder", item: node.folder }, newName);
			}
		},
		[lib],
	);

	const handleTreeDelete = useCallback(
		(node: DocumentTreeNode) => {
			if (node.type === "file" && node.file) {
				lib.handleDeleteItem({ type: "file", item: node.file });
			} else if (node.type === "folder" && node.folder) {
				lib.handleDeleteItem({ type: "folder", item: node.folder });
			}
		},
		[lib],
	);

	if (lib.loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
			{isPopupSurface ? (
				<>
					<DocumentLibraryHeader
						currentPath={lib.currentPath}
						activeTree={activeTree}
						homeTitle={
							lib.isWorkspaceSection ? t("sidebar.workspace") : t("title")
						}
						isWorkspaceSection={lib.isWorkspaceSection}
						compact
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
							onRenameNode={handleTreeRename}
							onDeleteNode={handleTreeDelete}
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
				</>
			) : (
				<div
					ref={containerRef}
					className={
						isDesktop
							? "grid min-h-0 min-w-0 flex-1 overflow-hidden bg-background"
							: "flex min-h-0 min-w-0 flex-1 overflow-hidden"
					}
					style={
						isDesktop
							? {
									gridTemplateColumns: `${panelSizes[0]}fr ${DESKTOP_SEPARATOR_TRACK}px ${panelSizes[1]}fr`,
								}
							: undefined
					}
				>
					<div className={isDesktop ? "min-h-0 overflow-hidden" : ""}>
						<DocumentLibrarySidebar
							tree={lib.tree}
							workspaceTree={lib.workspaceTree}
							selectedSection={lib.selectedSection}
							selectedNodeId={lib.selectedNode?.id ?? null}
							docsTitle={t("title")}
							onSelectDocumentsRoot={lib.handleSelectDocumentsSection}
							onSelectDocNode={lib.handleSelectDocNode}
							onSelectWorkspaceNode={lib.handleSelectWorkspaceNode}
							onSelectWorkspaceRoot={lib.handleSelectWorkspaceSection}
							onToggleExpand={lib.handleToggleExpand}
							onToggleExpandWorkspace={lib.handleToggleExpandWorkspace}
							onMove={lib.handleMove}
							onRenameNode={handleTreeRename}
							onDeleteNode={handleTreeDelete}
						/>
					</div>
					<div
						role="separator"
						aria-orientation="vertical"
						className={
							isDesktop
								? "group relative z-10 -mx-[5px] flex w-3 cursor-col-resize items-center justify-center bg-transparent"
								: "hidden"
						}
						onMouseDown={handleResizeStart}
					>
						<div className="h-full w-px bg-border/80 transition-all group-hover:w-[2px] group-hover:bg-foreground/20" />
					</div>
					<div className="min-w-0 flex-1 overflow-hidden">
						<div className="flex h-full min-h-0 flex-col">
							<DocumentLibraryHeader
								currentPath={lib.currentPath}
								activeTree={activeTree}
								homeTitle={
									lib.isWorkspaceSection ? t("sidebar.workspace") : t("title")
								}
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
							<div className="min-h-0 flex-1 overflow-hidden">
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
					</div>
				</div>
			)}
		</div>
	);
};
