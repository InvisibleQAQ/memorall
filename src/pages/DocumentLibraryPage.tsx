/**
 * Document Library Page
 * Main page for document management with file system interface
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import NiceModal from "@ebay/nice-modal-react";
import {
	Upload,
	FolderPlus,
	Grid3x3,
	List,
	Search,
	Loader2,
	AlertCircle,
	Home,
	ChevronRight,
	Folder,
	Tags,
	Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { documentStorageService } from "@/modules/documents/services/document-storage";
import { DocumentTreeDraggable } from "@/modules/documents/components/DocumentTreeDraggable";
import { DocumentList } from "@/modules/documents/components/DocumentList";
import { DocumentViewer } from "@/modules/documents/components/DocumentViewer";
import type {
	DocumentLibraryItem,
	DocumentTreeNode,
	DocumentUploadProgress,
	DocumentFile,
} from "@/types/document-library";
import { logError, logInfo } from "@/utils/logger";
import { readPDFFile } from "@/modules/documents/handlers/pdf-extraction";
import { readExcelFile } from "@/modules/documents/handlers/excel-extraction";
import {
	UploadProgressDialog,
	CreateFolderDialog,
} from "@/modules/documents/modals";
import {
	TopicSelectorDialog,
	CreateTopicDialog,
	ManageTopicsDialog,
} from "@/modules/topics/modals";
import {
	TopicFilterDropdown,
	ActiveTopicChips,
} from "@/modules/topics/components";
import { topicService } from "@/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/entities/topics";
import { useKnowledgeConversion } from "@/modules/documents/hooks/useKnowledgeConversion";
import { useMultipleSourceStatus } from "@/modules/documents/hooks/useSourceStatus";
// CONTENT_BACKGROUND_EVENTS import removed - using unified service API instead

export const DocumentLibraryPage: React.FC = () => {
	// Hooks
	const { t } = useTranslation("documents");
	const { convertToKnowledge } = useKnowledgeConversion();

	// State
	const [tree, setTree] = useState<DocumentTreeNode[]>([]);
	const [selectedNode, setSelectedNode] = useState<DocumentTreeNode | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"grid" | "list">("list");
	const [searchQuery, setSearchQuery] = useState("");

	// Derived state
	const currentPath = selectedNode?.path || "/";
	const isFileSelected = selectedNode?.type === "file";
	const isFolderSelected = selectedNode?.type === "folder";

	// Upload state
	const [uploadProgress, setUploadProgress] = useState<
		Map<string, DocumentUploadProgress>
	>(new Map());

	// Topic state
	const [topics, setTopics] = useState<Array<Topic & { fileCount: number }>>(
		[],
	);
	const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
	const [fileTopicMap, setFileTopicMap] = useState<Map<string, Topic[]>>(
		new Map(),
	);

	// Initialize
	useEffect(() => {
		initializeLibrary();
	}, []);

	// Listen for filesystem changes from other contexts (e.g., offscreen)
	// Using the unified service API instead of scattered message listeners
	useEffect(() => {
		const unsubscribe = documentStorageService.onFilesystemChanged(() => {
			logInfo(
				"[DOCUMENT_LIBRARY] Filesystem changed, reloading tree and topics...",
			);
			// Reload both tree and topics since files may have topic associations
			Promise.all([loadTree(), loadTopics()]).catch((err) => {
				logError(
					"[DOCUMENT_LIBRARY] Failed to reload after filesystem change:",
					err,
				);
			});
		});

		// Cleanup subscription on unmount
		return unsubscribe;
	}, []);

	const initializeLibrary = async () => {
		try {
			setLoading(true);
			await documentStorageService.initialize();
			await Promise.all([loadTree(), loadTopics()]);
			setError(null);
		} catch (err) {
			logError("Failed to initialize document library:", err);
			setError(t("library.initializationError"));
		} finally {
			setLoading(false);
		}
	};

	const loadTopics = async () => {
		try {
			const [topicsData, fileTopicMapData] = await Promise.all([
				topicService.getTopicsWithContentCount(),
				topicService.getFileTopicMap(),
			]);
			setTopics(topicsData);
			setFileTopicMap(fileTopicMapData);
			logInfo("[DOCUMENT_LIBRARY] Loaded topics:", {
				topicCount: topicsData.length,
				fileCount: fileTopicMapData.size,
			});
		} catch (err) {
			logError("[DOCUMENT_LIBRARY] Failed to load topics:", err);
		}
	};

	const loadTree = async () => {
		try {
			const treeData = await documentStorageService.getTree();
			setTree(treeData);
			// Select root by default if nothing selected
			if (!selectedNode && treeData.length > 0) {
				setSelectedNode(treeData[0]);
			}
			return treeData;
		} catch (err) {
			logError("Failed to load tree:", err);
			return [];
		}
	};

	/**
	 * Handle node selection in tree
	 * - If folder selected: show its contents in grid/list
	 * - If file selected: show file viewer
	 */
	const handleSelectNode = (node: DocumentTreeNode) => {
		setSelectedNode(node);
	};

	/**
	 * Toggle folder expansion in tree
	 */
	const handleToggleExpand = (nodeToToggle: DocumentTreeNode) => {
		const toggleNode = (nodes: DocumentTreeNode[]): DocumentTreeNode[] => {
			return nodes.map((node) => {
				if (node.id === nodeToToggle.id) {
					return { ...node, isExpanded: !node.isExpanded };
				}
				if (node.children && node.children.length > 0) {
					return { ...node, children: toggleNode(node.children) };
				}
				return node;
			});
		};

		setTree((prevTree) => toggleNode(prevTree));
	};

	/**
	 * Get folder contents for display in main area
	 * Filters by selected topics if any are selected
	 */
	const getFolderContents = (): DocumentLibraryItem[] => {
		if (!selectedNode || selectedNode.type !== "folder") return [];

		const items: DocumentLibraryItem[] = [];

		// Get children from the selected node
		selectedNode.children.forEach((child) => {
			if (child.type === "folder" && child.folder) {
				items.push({ type: "folder", item: child.folder });
			} else if (child.type === "file" && child.file) {
				// Filter by topics if any are selected
				if (selectedTopicIds.length > 0) {
					const fileTopics = fileTopicMap.get(child.file.path) || [];
					const fileTopicIds = fileTopics.map((t) => t.id);
					// Show file if it has ANY of the selected topics
					const hasMatchingTopic = selectedTopicIds.some((topicId) =>
						fileTopicIds.includes(topicId),
					);
					if (hasMatchingTopic) {
						items.push({ type: "file", item: child.file });
					}
				} else {
					items.push({ type: "file", item: child.file });
				}
			}
		});

		return items;
	};

	const handleUploadFiles = async (files: FileList) => {
		const fileArray = Array.from(files);
		const newProgress = new Map(uploadProgress);

		for (const file of fileArray) {
			const id = `${Date.now()}-${file.name}`;
			newProgress.set(id, {
				id,
				file,
				progress: 0,
				status: "pending",
			});
		}

		setUploadProgress(newProgress);
		NiceModal.show(UploadProgressDialog, { uploadProgress: newProgress });

		for (const file of fileArray) {
			const id = `${Date.now()}-${file.name}`;

			try {
				// Update progress
				updateProgress(id, 10, "uploading");

				// Extract metadata based on file type
				let metadata: DocumentFile["metadata"] | undefined;

				// PDF metadata
				if (file.type === "application/pdf") {
					try {
						updateProgress(id, 30, "processing");
						const pdfContent = await readPDFFile(file);
						metadata = {
							title: pdfContent.title,
							author: pdfContent.author,
							subject: pdfContent.subject,
							pageCount: pdfContent.numPages,
						};
					} catch (err) {
						logError("Failed to extract PDF metadata:", err);
					}
				}

				// Excel metadata
				else if (
					file.type === "application/vnd.ms-excel" ||
					file.type ===
						"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
					file.type === "application/vnd.ms-excel.sheet.macroEnabled.12"
				) {
					try {
						updateProgress(id, 30, "processing");
						const excelContent = await readExcelFile(file);
						metadata = {
							title: excelContent.title,
							sheetCount: excelContent.sheetCount,
							sheetNames: excelContent.sheetNames,
						};
					} catch (err) {
						logError("Failed to extract Excel metadata:", err);
					}
				}

				updateProgress(id, 70, "uploading");

				// Upload file
				await documentStorageService.uploadFile(file, currentPath, metadata);

				updateProgress(id, 100, "completed");

				logInfo(`Uploaded file: ${file.name}`);
			} catch (err) {
				logError(`Failed to upload file ${file.name}:`, err);
				updateProgress(id, 0, "error", String(err));
			}
		}

		// Reload tree
		await loadTree();

		// Close dialog after a delay
		setTimeout(() => {
			NiceModal.hide(UploadProgressDialog);
			setUploadProgress(new Map());
		}, 2000);
	};

	const updateProgress = (
		id: string,
		progress: number,
		status: DocumentUploadProgress["status"],
		error?: string,
	) => {
		setUploadProgress((prev) => {
			const newMap = new Map(prev);
			const item = newMap.get(id);
			if (item) {
				newMap.set(id, { ...item, progress, status, error });
			}
			return newMap;
		});
	};

	const handleCreateFolder = async (folderName: string) => {
		try {
			// Get the current folder path for creating subfolder
			const targetPath =
				selectedNode?.type === "folder" ? selectedNode.path : "/";
			await documentStorageService.createFolder(folderName, targetPath);
			await loadTree();
		} catch (err) {
			logError("Failed to create folder:", err);
			setError(t("library.createFolderError"));
			throw err; // Re-throw to let modal handle error
		}
	};

	const handleDeleteItem = async (item: DocumentLibraryItem) => {
		if (
			!confirm(
				item.type === "folder" 
					? t("library.deleteConfirmFolder", { name: item.item.name })
					: t("library.deleteConfirm", { name: item.item.name })
			)
		) {
			return;
		}

		try {
			if (item.type === "file") {
				await documentStorageService.deleteFile(item.item.id);
			} else {
				await documentStorageService.deleteFolder(item.item.id);
			}

			const newTree = await loadTree();

			// Clear selection if deleted item was selected
			if (selectedNode?.id === item.item.id) {
				// Go back to parent folder or root
				const parentPath =
					currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
				const findNodeByPath = (
					nodes: DocumentTreeNode[],
					targetPath: string,
				): DocumentTreeNode | null => {
					for (const node of nodes) {
						if (node.path === targetPath) return node;
						if (node.children) {
							const found = findNodeByPath(node.children, targetPath);
							if (found) return found;
						}
					}
					return null;
				};

				const parentNode = findNodeByPath(newTree, parentPath);
				if (parentNode) {
					setSelectedNode(parentNode);
				} else if (newTree.length > 0) {
					setSelectedNode(newTree[0]);
				}
			}
		} catch (err) {
			logError("Failed to delete item:", err);
			setError(t("library.deleteItemError"));
		}
	};

	const handleRenameItem = async (
		item: DocumentLibraryItem,
		newName: string,
	) => {
		try {
			if (item.type === "file") {
				await documentStorageService.renameFile(item.item.id, newName);
			} else {
				await documentStorageService.renameFolder(item.item.id, newName);
			}

			const newTree = await loadTree();

			// Update selection if renamed item was selected
			if (selectedNode?.id === item.item.id) {
				// Find the renamed item in the new tree
				const findNodeById = (
					nodes: DocumentTreeNode[],
					id: string,
				): DocumentTreeNode | null => {
					for (const node of nodes) {
						if (node.id === id) return node;
						if (node.children) {
							const found = findNodeById(node.children, id);
							if (found) return found;
						}
					}
					return null;
				};

				const updatedNode = findNodeById(newTree, item.item.id);
				if (updatedNode) {
					setSelectedNode(updatedNode);
				}
			}

			logInfo(`Renamed ${item.type}: ${item.item.name} -> ${newName}`);
		} catch (err) {
			logError("Failed to rename item:", err);
			setError(t("library.renameItemError"));
		}
	};

	const handleDeleteSelectedFile = async () => {
		if (!selectedNode || selectedNode.type !== "file") return;

		if (!confirm(t("library.deleteConfirm", { name: selectedNode.name }))) {
			return;
		}

		try {
			await documentStorageService.deleteFile(selectedNode.id);
			const newTree = await loadTree();

			// Go back to parent folder
			const parentPath =
				currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
			const findNodeByPath = (
				nodes: DocumentTreeNode[],
				targetPath: string,
			): DocumentTreeNode | null => {
				for (const node of nodes) {
					if (node.path === targetPath) return node;
					if (node.children) {
						const found = findNodeByPath(node.children, targetPath);
						if (found) return found;
					}
				}
				return null;
			};

			const parentNode = findNodeByPath(newTree, parentPath);
			if (parentNode) {
				setSelectedNode(parentNode);
			} else if (newTree.length > 0) {
				setSelectedNode(newTree[0]);
			}
		} catch (err) {
			logError("Failed to delete file:", err);
			setError(t("library.deleteFileError"));
		}
	};

	const handleDownloadFile = async (fileId: string) => {
		try {
			const content = await documentStorageService.getFileContent(fileId);

			// Find file in tree
			const findFile = (nodes: DocumentTreeNode[]): DocumentFile | null => {
				for (const node of nodes) {
					if (node.type === "file" && node.id === fileId && node.file) {
						return node.file;
					}
					if (node.children) {
						const found = findFile(node.children);
						if (found) return found;
					}
				}
				return null;
			};

			const file = findFile(tree);
			if (!file) return;

			// Convert Uint8Array to ArrayBuffer for Blob
			const arrayBuffer =
				content.buffer instanceof ArrayBuffer
					? content.buffer
					: new ArrayBuffer(content.byteLength);
			const blob = new Blob([arrayBuffer], { type: file.mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = file.name;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			logError("Failed to download file:", err);
			setError(t("library.downloadFileError"));
		}
	};

	const handleDownloadSelectedFile = async () => {
		if (selectedNode?.type === "file") {
			await handleDownloadFile(selectedNode.id);
		}
	};

	const triggerFileUpload = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		input.accept = ".pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.xlsm";
		input.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files;
			if (files && files.length > 0) {
				handleUploadFiles(files);
			}
		};
		input.click();
	};

	// Topic handlers
	const handleTopicFilterChange = (topicIds: string[]) => {
		setSelectedTopicIds(topicIds);
		logInfo("[DOCUMENT_LIBRARY] Topic filter changed:", topicIds);
	};

	const handleRemoveTopicFilter = (topicId: string) => {
		setSelectedTopicIds((prev) => prev.filter((id) => id !== topicId));
	};

	const handleClearTopicFilters = () => {
		setSelectedTopicIds([]);
	};

	const handleManageFileTopic = async (file: DocumentFile) => {
		const fileTopics = fileTopicMap.get(file.path) || [];
		const topicIds = await NiceModal.show(TopicSelectorDialog, {
			filePath: file.path,
			fileName: file.name,
			initialTopicIds: fileTopics.map((t) => t.id),
		});

		if (topicIds && Array.isArray(topicIds)) {
			// Update local state
			const updatedTopics = topics.filter((t) => topicIds.includes(t.id));
			const newMap = new Map(fileTopicMap);
			if (updatedTopics.length > 0) {
				newMap.set(file.path, updatedTopics);
			} else {
				newMap.delete(file.path);
			}
			setFileTopicMap(newMap);

			// Reload topics to update file counts
			await loadTopics();

			logInfo("[DOCUMENT_LIBRARY] Updated file topics:", {
				file: file.path,
				topics: topicIds,
			});
		}
	};

	const handleCreateTopicFromFilter = async () => {
		logInfo("[DOCUMENT_LIBRARY] Create topic requested");
		const newTopic = await NiceModal.show(CreateTopicDialog);
		if (newTopic) {
			// Reload topics to include the new one
			await loadTopics();
			logInfo("[DOCUMENT_LIBRARY] Topic created and list refreshed:", newTopic);
		}
	};

	const handleManageTopics = async () => {
		const result = await NiceModal.show(ManageTopicsDialog);
		if (result) {
			// Reload topics when they are changed
			await loadTopics();
			logInfo("[DOCUMENT_LIBRARY] Topics changed, list refreshed");
		}
	};

	const handleConvertToKnowledge = async (file: DocumentFile) => {
		try {
			const currentFileTopics = fileTopicMap.get(file.path) || [];
			await convertToKnowledge(file, currentFileTopics, loadTopics);
		} catch (error) {
			logError("[DOCUMENT_LIBRARY] Failed to convert to knowledge:", error);
		}
	};

	/**
	 * Handle moving a file or folder to a new location
	 */
	const handleMove = async (
		nodeId: string,
		targetFolderId: string,
		nodeType: "file" | "folder",
	) => {
		try {
			logInfo("[DOCUMENT_LIBRARY] Moving item:", {
				nodeId,
				targetFolderId,
				nodeType,
			});

			if (nodeType === "file") {
				await documentStorageService.moveFile(nodeId, targetFolderId);
			} else {
				await documentStorageService.moveFolder(nodeId, targetFolderId);
			}

			// Reload tree to reflect the changes
			await loadTree();

			logInfo("[DOCUMENT_LIBRARY] Item moved successfully");
		} catch (err) {
			logError("[DOCUMENT_LIBRARY] Failed to move item:", err);
			setError("Failed to move item");
		}
	};

	// Breadcrumb navigation
	const pathSegments = currentPath.split("/").filter(Boolean);

	// Get folder contents for main area display
	const folderContents = getFolderContents();

	// Get all file paths for source status tracking
	const filePaths = folderContents
		.filter((item) => item.type === "file")
		.map((item) => item.item.path);

	// Track source status for all files
	const sourceStatusMap = useMultipleSourceStatus(filePaths);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full overflow-hidden bg-background">
			{/* Header */}
			<div className="border-b bg-card">
				{/* Row 1: Breadcrumb + Actions */}
				<div className="flex items-center justify-between gap-2 px-2 md:px-3 py-2 border-b">
					{/* Breadcrumb - More compact on small screens */}
					<div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground min-w-0 flex-1 overflow-hidden">
						<button
							onClick={() => {
								// Find root node and select it
								if (tree.length > 0) {
									handleSelectNode(tree[0]);
								}
							}}
							className="flex items-center gap-1 hover:text-foreground transition-colors flex-shrink-0"
							title={t("title")}
						>
							<Home className="h-3.5 w-3.5 md:h-4 md:w-4" />
						</button>
						{pathSegments.length > 0 && (
							<>
								<ChevronRight className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
								{/* Show only last 2 segments on small screens */}
								{pathSegments.slice(-2).map((segment, index) => {
									const actualIndex = pathSegments.length - 2 + index;
									const path =
										"/" + pathSegments.slice(0, actualIndex + 1).join("/");
									const isLast = actualIndex === pathSegments.length - 1;
									return (
										<React.Fragment key={path}>
											<button
												onClick={() => {
													// Find node by path and select it
													const findNodeByPath = (
														nodes: DocumentTreeNode[],
														targetPath: string,
													): DocumentTreeNode | null => {
														for (const node of nodes) {
															if (node.path === targetPath) return node;
															if (node.children) {
																const found = findNodeByPath(
																	node.children,
																	targetPath,
																);
																if (found) return found;
															}
														}
														return null;
													};

													const node = findNodeByPath(tree, path);
													if (node) handleSelectNode(node);
												}}
												className={`hover:text-foreground transition-colors truncate max-w-[120px] ${
													isLast ? "font-medium text-foreground" : ""
												}`}
												title={segment}
											>
												{segment}
											</button>
											{!isLast && (
												<ChevronRight className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
											)}
										</React.Fragment>
									);
								})}
							</>
						)}
					</div>

					{/* Actions */}
					<div className="flex items-center gap-1 flex-shrink-0">
						{/* Add Dropdown (Upload Files or Create Folder) */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button size="sm" className="h-8 gap-1.5">
									<Plus className="h-4 w-4" />
									<span className="hidden md:inline">{t("library.add")}</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={triggerFileUpload}>
									<Upload className="h-4 w-4 mr-2" />
									{t("upload.uploadFiles")}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() =>
										NiceModal.show(CreateFolderDialog, {
											onCreateFolder: handleCreateFolder,
										})
									}
								>
									<FolderPlus className="h-4 w-4 mr-2" />
									{t("upload.createFolder")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Manage Topics Button */}
						<Button
							variant="outline"
							size="sm"
							onClick={handleManageTopics}
							className="h-8 gap-1.5"
							title="Manage Topics"
						>
							<Tags className="h-4 w-4" />
							<span className="hidden md:inline">{t("library.topics")}</span>
						</Button>
					</div>
				</div>

				{/* Row 2: Search + Topic Filter + View Controls */}
				<div className="flex items-center gap-2 px-2 md:px-3 py-2">
					{/* Combined Search and Topic Filter */}
					<div className="flex items-center gap-2 flex-1 min-w-0">
						{/* Search Input */}
						<div className="relative flex-1 min-w-0">
							<Search className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
							<Input
								placeholder={t("library.searchPlaceholder")}
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-8 md:pl-10 h-8 md:h-9 text-sm"
							/>
						</div>

						{/* Topic Filter Dropdown */}
						<TopicFilterDropdown
							topics={topics}
							selectedTopicIds={selectedTopicIds}
							onSelectionChange={handleTopicFilterChange}
							onCreateTopic={handleCreateTopicFromFilter}
							className="flex-shrink-0"
						/>
					</div>

					{/* View Mode Toggle */}
					<div className="flex items-center gap-0.5 border rounded-md p-0.5 flex-shrink-0">
						<Button
							variant={viewMode === "list" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setViewMode("list")}
							className="h-6 w-6 md:h-7 md:w-7 p-0"
							title={t("library.listView")}
						>
							<List className="h-3.5 w-3.5 md:h-4 md:w-4" />
						</Button>
						<Button
							variant={viewMode === "grid" ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setViewMode("grid")}
							className="h-6 w-6 md:h-7 md:w-7 p-0"
							title={t("library.gridView")}
						>
							<Grid3x3 className="h-3.5 w-3.5 md:h-4 md:w-4" />
						</Button>
					</div>
				</div>

				{/* Active Topic Chips - Only show if topics are selected */}
				{selectedTopicIds.length > 0 && (
					<div className="px-2 md:px-3 pb-2">
						<ActiveTopicChips
							selectedTopics={topics.filter((t) =>
								selectedTopicIds.includes(t.id),
							)}
							onRemoveTopic={handleRemoveTopicFilter}
							onClearAll={handleClearTopicFilters}
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

			{/* Main Content - Windows Explorer Style */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left Panel: Tree Navigation (shows files and folders) - Hidden on small screens */}
				<div className="hidden md:block md:w-48 lg:w-64 border-r bg-card overflow-hidden flex-shrink-0">
					<DocumentTreeDraggable
						tree={tree}
						selectedId={selectedNode?.id || null}
						onSelectNode={handleSelectNode}
						onToggleExpand={handleToggleExpand}
						onMove={handleMove}
					/>
				</div>

				{/* Right Panel: Content or Viewer */}
				<div className="flex-1 overflow-hidden min-w-0">
					{isFolderSelected ? (
						/* Show folder contents in grid/list */
						<DocumentList
							items={folderContents}
							selectedItem={null}
							sourceStatusMap={sourceStatusMap}
							onSelectItem={(item) => {
								// When clicking an item in the list, find it in tree and select it
								const findNodeById = (
									nodes: DocumentTreeNode[],
									id: string,
								): DocumentTreeNode | null => {
									for (const node of nodes) {
										if (node.id === id) return node;
										if (node.children) {
											const found = findNodeById(node.children, id);
											if (found) return found;
										}
									}
									return null;
								};

								const node = findNodeById(tree, item.item.id);
								if (node) handleSelectNode(node);
							}}
							onOpenFolder={(path) => {
								// Find folder node and select it
								const findNodeByPath = (
									nodes: DocumentTreeNode[],
									targetPath: string,
								): DocumentTreeNode | null => {
									for (const node of nodes) {
										if (node.path === targetPath) return node;
										if (node.children) {
											const found = findNodeByPath(node.children, targetPath);
											if (found) return found;
										}
									}
									return null;
								};

								const node = findNodeByPath(tree, path);
								if (node) handleSelectNode(node);
							}}
							onDeleteItem={handleDeleteItem}
							onRenameItem={handleRenameItem}
							onDownloadFile={handleDownloadFile}
							onManageTopics={handleManageFileTopic}
							onConvertToKnowledge={handleConvertToKnowledge}
							fileTopicMap={fileTopicMap}
							selectedTopicIds={selectedTopicIds}
							onTopicClick={(topicId) => {
								// Toggle topic filter when clicking a badge
								if (selectedTopicIds.includes(topicId)) {
									handleRemoveTopicFilter(topicId);
								} else {
									setSelectedTopicIds((prev) => [...prev, topicId]);
								}
							}}
							viewMode={viewMode}
						/>
					) : isFileSelected && selectedNode.file ? (
						/* Show file viewer */
						<DocumentViewer
							file={selectedNode.file}
							onClose={() => {
								// Go back to parent folder
								const parentPath =
									currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
								const findNodeByPath = (
									nodes: DocumentTreeNode[],
									targetPath: string,
								): DocumentTreeNode | null => {
									for (const node of nodes) {
										if (node.path === targetPath) return node;
										if (node.children) {
											const found = findNodeByPath(node.children, targetPath);
											if (found) return found;
										}
									}
									return null;
								};

								const parentNode = findNodeByPath(tree, parentPath);
								if (parentNode) handleSelectNode(parentNode);
							}}
							onDelete={handleDeleteSelectedFile}
							onDownload={handleDownloadSelectedFile}
							onManageTopics={handleManageFileTopic}
							onConvertToKnowledge={handleConvertToKnowledge}
							fileTopics={fileTopicMap.get(selectedNode.file.path) || []}
							selectedTopicIds={selectedTopicIds}
							onTopicClick={(topicId) => {
								// Toggle topic filter when clicking a badge
								if (selectedTopicIds.includes(topicId)) {
									handleRemoveTopicFilter(topicId);
								} else {
									setSelectedTopicIds((prev) => [...prev, topicId]);
								}
							}}
						/>
					) : (
						/* Empty state */
						<div className="flex items-center justify-center h-full text-muted-foreground">
							<div className="text-center">
								<Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
								<p className="text-sm">{t("library.emptyState")}</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
