import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import NiceModal from "@ebay/nice-modal-react";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import { topicService } from "@/main/modules/topics/services/topic-service";
import { TopicSelectorDialog } from "@/main/modules/topics/modals";
import { useKnowledgeConversion } from "./useKnowledgeConversion";
import type {
	DocumentLibraryItem,
	DocumentTreeNode,
	DocumentUploadProgress,
	DocumentFile,
	DocumentFolder,
} from "@/types/document-library";
import type { Topic } from "@/services/database/entities/topics";
import { logError, logInfo } from "@/utils/logger";
import { readPDFFile } from "../handlers/pdf-extraction";
import { readExcelFile } from "../handlers/excel-extraction";
import { UploadProgressDialog, CreateDocumentDialog } from "../modals";
import {
	findNodeById,
	findNodeByPath,
	toggleNodeExpand,
} from "../utils/tree-utils";

// ── Module-level helpers ──────────────────────────────────────────────────────

/** Convert logical workspace path → sandbox path (/workspaces/...). */
function toWsPath(logicalPath: string): string {
	const normalized = logicalPath.replace(/\\/g, "/");
	if (normalized === "/workspace" || normalized.startsWith("/workspace/")) {
		return normalized === "/workspace"
			? "/workspaces"
			: `/workspaces${normalized.slice("/workspace".length)}`;
	}
	if (normalized === "/workspaces" || normalized.startsWith("/workspaces/")) {
		return normalized;
	}
	return normalized === "/" ? "/workspaces" : `/workspaces${normalized}`;
}

/** Build the virtual workspace-root DocumentTreeNode that wraps workspace items. */
function makeWorkspaceRoot(items: DocumentTreeNode[]): DocumentTreeNode {
	const folder: DocumentFolder = {
		id: "__workspace_root__",
		name: "Workspace",
		path: "/",
		parentPath: null,
		createdAt: new Date(0),
		modifiedAt: new Date(0),
		childCount: items.length,
	};
	return {
		id: "__workspace_root__",
		name: "Workspace",
		path: "/",
		type: "folder",
		isExpanded: true,
		children: items,
		folder,
	};
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentLibrary() {
	const { t } = useTranslation("documents");
	const { convertToKnowledge } = useKnowledgeConversion();

	// ── State ───────────────────────────────────────────────────────────────
	const [tree, setTree] = useState<DocumentTreeNode[]>([]);
	const [workspaceTree, setWorkspaceTree] = useState<DocumentTreeNode[]>([]);
	const [selectedNode, setSelectedNode] = useState<DocumentTreeNode | null>(
		null,
	);
	const [selectedSection, setSelectedSection] = useState<
		"documents" | "workspace"
	>("documents");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"grid" | "list">("list");
	const [searchQuery, setSearchQuery] = useState("");
	const [uploadProgress, setUploadProgress] = useState<
		Map<string, DocumentUploadProgress>
	>(new Map());
	const [topics, setTopics] = useState<Array<Topic & { fileCount: number }>>(
		[],
	);
	const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
	const [fileTopicMap, setFileTopicMap] = useState<Map<string, Topic[]>>(
		new Map(),
	);

	// ── Derived ─────────────────────────────────────────────────────────────
	const currentPath = selectedNode?.path ?? "/";
	const isFileSelected = selectedNode?.type === "file";
	const isFolderSelected = selectedNode?.type === "folder";
	const isWorkspaceSection = selectedSection === "workspace";

	// ── Refs (for stable callbacks that read but don't capture state) ────────
	const selectedNodeRef = useRef(selectedNode);
	const treeRef = useRef(tree);
	const workspaceTreeRef = useRef(workspaceTree);
	const isWorkspaceSectionRef = useRef(isWorkspaceSection);
	const currentPathRef = useRef(currentPath);
	const fileTopicMapRef = useRef(fileTopicMap);
	const topicsRef = useRef(topics);

	useEffect(() => {
		selectedNodeRef.current = selectedNode;
	}, [selectedNode]);
	useEffect(() => {
		treeRef.current = tree;
	}, [tree]);
	useEffect(() => {
		workspaceTreeRef.current = workspaceTree;
	}, [workspaceTree]);
	useEffect(() => {
		isWorkspaceSectionRef.current = isWorkspaceSection;
	}, [isWorkspaceSection]);
	useEffect(() => {
		currentPathRef.current = currentPath;
	}, [currentPath]);
	useEffect(() => {
		fileTopicMapRef.current = fileTopicMap;
	}, [fileTopicMap]);
	useEffect(() => {
		topicsRef.current = topics;
	}, [topics]);

	// ── Folder contents (memoized) ───────────────────────────────────────────
	const folderContents = useMemo((): DocumentLibraryItem[] => {
		if (!selectedNode || selectedNode.type !== "folder") return [];
		const items: DocumentLibraryItem[] = [];
		for (const child of selectedNode.children) {
			if (child.type === "folder" && child.folder) {
				items.push({ type: "folder", item: child.folder });
			} else if (child.type === "file" && child.file) {
				if (selectedTopicIds.length > 0 && !isWorkspaceSection) {
					const childTopics = fileTopicMap.get(child.file.path) ?? [];
					const childTopicIds = childTopics.map((t) => t.id);
					if (selectedTopicIds.some((tid) => childTopicIds.includes(tid))) {
						items.push({ type: "file", item: child.file });
					}
				} else {
					items.push({ type: "file", item: child.file });
				}
			}
		}
		return items;
	}, [selectedNode, selectedTopicIds, fileTopicMap, isWorkspaceSection]);

	// ── Data loaders (stable — only use setters + services) ─────────────────
	const loadTopics = useCallback(async () => {
		try {
			const [topicsData, fileTopicMapData] = await Promise.all([
				topicService.getTopicsWithContentCount(),
				topicService.getFileTopicMap(),
			]);
			setTopics(topicsData);
			setFileTopicMap(fileTopicMapData);
		} catch (err) {
			logError("[DOCUMENT_LIBRARY] Failed to load topics:", err);
		}
	}, []);

	const loadTree = useCallback(async () => {
		try {
			const treeData = await documentFileSystemService.getTree();
			setTree(treeData);
			setSelectedNode((prev) => {
				if (!prev) return treeData.length > 0 ? treeData[0] : null;
				return (
					findNodeById(treeData, prev.id) ??
					findNodeByPath(treeData, prev.path) ??
					null
				);
			});
			return treeData;
		} catch (err) {
			logError("Failed to load tree:", err);
			return [] as DocumentTreeNode[];
		}
	}, []);

	const loadWorkspaceTree = useCallback(async () => {
		try {
			const treeData = await documentFileSystemService.getWorkspaceTree();
			setWorkspaceTree(treeData);
			// Keep selectedNode in sync if it belongs to workspace
			setSelectedNode((prev) => {
				if (!isWorkspaceSectionRef.current || !prev) return prev;
				if (prev.id === "__workspace_root__")
					return makeWorkspaceRoot(treeData);
				return (
					findNodeById(treeData, prev.id) ??
					findNodeByPath(treeData, prev.path) ??
					makeWorkspaceRoot(treeData)
				);
			});
			return treeData;
		} catch (err) {
			logError("Failed to load workspace tree:", err);
			return [] as DocumentTreeNode[];
		}
	}, []);

	// ── Initialization ───────────────────────────────────────────────────────
	const initializeLibrary = useCallback(async () => {
		try {
			setLoading(true);
			await documentFileSystemService.initialize();
			documentFileSystemService.forceRefresh();
			await Promise.all([loadTree(), loadTopics(), loadWorkspaceTree()]);
			setError(null);
		} catch (err) {
			logError("Failed to initialize document library:", err);
			setError(t("library.initializationError"));
		} finally {
			setLoading(false);
		}
	}, [loadTree, loadTopics, loadWorkspaceTree, t]);

	useEffect(() => {
		initializeLibrary();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		return documentFileSystemService.onFilesystemChanged(() => {
			Promise.all([loadTree(), loadTopics(), loadWorkspaceTree()]).catch(
				(err) => {
					logError(
						"[DOCUMENT_LIBRARY] Failed to reload after filesystem change:",
						err,
					);
				},
			);
		});
	}, [loadTree, loadTopics, loadWorkspaceTree]);

	// ── Node navigation (stable, [] deps) ───────────────────────────────────
	const handleSelectNode = useCallback((node: DocumentTreeNode | null) => {
		setSelectedNode(node);
	}, []);

	const handleSelectDocNode = useCallback((node: DocumentTreeNode) => {
		setSelectedSection("documents");
		setSelectedNode(node);
	}, []);

	const handleSelectWorkspaceNode = useCallback((node: DocumentTreeNode) => {
		setSelectedSection("workspace");
		setSelectedNode(node);
	}, []);

	/** Select the workspace root (used by the sidebar label click). */
	const handleSelectWorkspaceSection = useCallback(() => {
		setSelectedSection("workspace");
		setSelectedNode(makeWorkspaceRoot(workspaceTreeRef.current));
	}, []);

	const handleToggleExpand = useCallback((nodeToToggle: DocumentTreeNode) => {
		setTree((prev) => toggleNodeExpand(prev, nodeToToggle.id));
	}, []);

	const handleToggleExpandWorkspace = useCallback(
		(nodeToToggle: DocumentTreeNode) => {
			setWorkspaceTree((prev) => toggleNodeExpand(prev, nodeToToggle.id));
		},
		[],
	);

	/** Navigate to a node by id in the currently active tree. */
	const handleSelectNodeInActiveTree = useCallback((id: string) => {
		if (isWorkspaceSectionRef.current && id === "__workspace_root__") {
			setSelectedNode(makeWorkspaceRoot(workspaceTreeRef.current));
			return;
		}
		const activeTree = isWorkspaceSectionRef.current
			? workspaceTreeRef.current
			: treeRef.current;
		const node = findNodeById(activeTree, id);
		if (node) setSelectedNode(node);
	}, []);

	/** Navigate to a folder by path in the currently active tree. */
	const handleOpenFolderByPath = useCallback((path: string) => {
		if (isWorkspaceSectionRef.current && path === "/") {
			setSelectedNode(makeWorkspaceRoot(workspaceTreeRef.current));
			return;
		}
		const activeTree = isWorkspaceSectionRef.current
			? workspaceTreeRef.current
			: treeRef.current;
		const node = findNodeByPath(activeTree, path);
		if (node) setSelectedNode(node);
	}, []);

	/** Go to parent folder when closing a file viewer. */
	const handleCloseViewer = useCallback(() => {
		const path = currentPathRef.current;
		const parentPath = path.substring(0, path.lastIndexOf("/")) || "/";
		if (isWorkspaceSectionRef.current) {
			const node =
				parentPath === "/"
					? null
					: findNodeByPath(workspaceTreeRef.current, parentPath);
			setSelectedNode(node ?? makeWorkspaceRoot(workspaceTreeRef.current));
			return;
		}
		const parentNode = findNodeByPath(treeRef.current, parentPath);
		setSelectedNode(parentNode ?? null);
	}, []);

	// ── Upload ───────────────────────────────────────────────────────────────
	const updateProgress = useCallback(
		(
			id: string,
			progress: number,
			status: DocumentUploadProgress["status"],
			errorMsg?: string,
		) => {
			setUploadProgress((prev) => {
				const next = new Map(prev);
				const item = next.get(id);
				if (item) next.set(id, { ...item, progress, status, error: errorMsg });
				return next;
			});
		},
		[],
	);

	const handleUploadFiles = useCallback(
		async (files: FileList) => {
			const fileArray = Array.from(files);
			const newProgress = new Map<string, DocumentUploadProgress>();
			for (const file of fileArray) {
				const id = `${Date.now()}-${file.name}`;
				newProgress.set(id, { id, file, progress: 0, status: "pending" });
			}
			setUploadProgress(newProgress);
			NiceModal.show(UploadProgressDialog, { uploadProgress: newProgress });

			// Workspace upload: read file text and write via workspace API
			if (isWorkspaceSectionRef.current) {
				const basePath = currentPathRef.current;
				for (const file of fileArray) {
					const id = `${Date.now()}-${file.name}`;
					try {
						updateProgress(id, 10, "uploading");
						const text = await file.text();
						const newPath =
							basePath === "/" ? `/${file.name}` : `${basePath}/${file.name}`;
						updateProgress(id, 70, "uploading");
						await documentFileSystemService.writeWorkspaceFile(
							toWsPath(newPath),
							text,
						);
						updateProgress(id, 100, "completed");
						logInfo(`Uploaded workspace file: ${file.name}`);
					} catch (err) {
						logError(`Failed to upload workspace file ${file.name}:`, err);
						updateProgress(id, 0, "error", String(err));
					}
				}
				await loadWorkspaceTree();
				setTimeout(() => {
					NiceModal.hide(UploadProgressDialog);
					setUploadProgress(new Map());
				}, 2000);
				return;
			}

			for (const file of fileArray) {
				const id = `${Date.now()}-${file.name}`;
				try {
					updateProgress(id, 10, "uploading");
					let metadata: DocumentFile["metadata"] | undefined;

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
					} else if (
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
					await documentFileSystemService.uploadFile(
						file,
						currentPathRef.current,
						metadata,
					);
					updateProgress(id, 100, "completed");
					logInfo(`Uploaded file: ${file.name}`);
				} catch (err) {
					logError(`Failed to upload file ${file.name}:`, err);
					updateProgress(id, 0, "error", String(err));
				}
			}

			await loadTree();
			setTimeout(() => {
				NiceModal.hide(UploadProgressDialog);
				setUploadProgress(new Map());
			}, 2000);
		},
		[updateProgress, loadWorkspaceTree, loadTree],
	);

	const triggerFileUpload = useCallback(() => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;
		input.accept = ".pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.xlsm";
		input.onchange = (e) => {
			const files = (e.target as HTMLInputElement).files;
			if (files?.length) handleUploadFiles(files);
		};
		input.click();
	}, [handleUploadFiles]);

	// ── Create ───────────────────────────────────────────────────────────────
	const handleCreateFolder = useCallback(
		async (folderName: string) => {
			try {
				const node = selectedNodeRef.current;
				const targetPath = node?.type === "folder" ? node.path : "/";
				if (isWorkspaceSectionRef.current) {
					const newPath =
						targetPath === "/"
							? `/${folderName}`
							: `${targetPath}/${folderName}`;
					await documentFileSystemService.mkdirWorkspace(toWsPath(newPath));
					await loadWorkspaceTree();
					return;
				}
				await documentFileSystemService.createFolder(folderName, targetPath);
				await loadTree();
			} catch (err) {
				logError("Failed to create folder:", err);
				setError(t("library.createFolderError"));
				throw err;
			}
		},
		[loadWorkspaceTree, loadTree, t],
	);

	const handleCreateDocument = useCallback(async () => {
		try {
			const result = (await NiceModal.show(CreateDocumentDialog)) as {
				name: string;
				extension: string;
			} | null;
			if (!result) return;

			const node = selectedNodeRef.current;
			const targetPath = node?.type === "folder" ? node.path : "/";
			const fullFileName = `${result.name}${result.extension}`;

			if (isWorkspaceSectionRef.current) {
				const newPath =
					targetPath === "/"
						? `/${fullFileName}`
						: `${targetPath}/${fullFileName}`;
				await documentFileSystemService.writeWorkspaceFile(
					toWsPath(newPath),
					"",
				);
				await loadWorkspaceTree();
				return;
			}

			const file = new File(
				[new Blob([""], { type: "text/markdown" })],
				fullFileName,
				{ type: "text/markdown" },
			);
			await documentFileSystemService.uploadFile(file, targetPath);
			const newTree = await loadTree();
			const newFilePath =
				targetPath === "/"
					? `/${fullFileName}`
					: `${targetPath}/${fullFileName}`;
			const newNode = findNodeByPath(newTree, newFilePath);
			if (newNode) setSelectedNode(newNode);
		} catch (err) {
			logError("Failed to create document:", err);
			setError(
				t("library.createDocumentError", {
					defaultValue: "Failed to create document",
				}),
			);
		}
	}, [loadWorkspaceTree, loadTree, t]);

	// ── Delete / Rename ──────────────────────────────────────────────────────
	const handleDeleteItem = useCallback(
		async (item: DocumentLibraryItem) => {
			if (
				!confirm(
					item.type === "folder"
						? t("library.deleteConfirmFolder", { name: item.item.name })
						: t("library.deleteConfirm", { name: item.item.name }),
				)
			)
				return;

			try {
				if (isWorkspaceSectionRef.current) {
					const sandboxPath = toWsPath(item.item.path);
					if (item.type === "file") {
						await documentFileSystemService.deleteWorkspaceFile(sandboxPath);
					} else {
						await documentFileSystemService.deleteWorkspaceFolder(sandboxPath);
					}
					await loadWorkspaceTree();
					if (selectedNodeRef.current?.id === item.item.id)
						setSelectedNode(null);
					return;
				}

				if (item.type === "file") {
					await documentFileSystemService.deleteFile(item.item.id);
				} else {
					await documentFileSystemService.deleteFolder(item.item.id);
				}

				const newTree = await loadTree();
				if (selectedNodeRef.current?.id === item.item.id) {
					const curPath = currentPathRef.current;
					const parentPath =
						curPath.substring(0, curPath.lastIndexOf("/")) || "/";
					const parentNode = findNodeByPath(newTree, parentPath);
					setSelectedNode(
						parentNode ?? (newTree.length > 0 ? newTree[0] : null),
					);
				}
			} catch (err) {
				logError("Failed to delete item:", err);
				setError(t("library.deleteItemError"));
			}
		},
		[loadWorkspaceTree, loadTree, t],
	);

	const handleRenameItem = useCallback(
		async (item: DocumentLibraryItem, newName: string) => {
			try {
				if (isWorkspaceSectionRef.current) {
					const sandboxPath = toWsPath(item.item.path);
					await documentFileSystemService.renameWorkspaceFile(
						sandboxPath,
						newName,
					);
					await loadWorkspaceTree();
					return;
				}

				if (item.type === "file") {
					await documentFileSystemService.renameFile(item.item.id, newName);
				} else {
					await documentFileSystemService.renameFolder(item.item.id, newName);
				}

				const newTree = await loadTree();
				if (selectedNodeRef.current?.id === item.item.id) {
					const updatedNode = findNodeById(newTree, item.item.id);
					if (updatedNode) setSelectedNode(updatedNode);
				}
				logInfo(`Renamed ${item.type}: ${item.item.name} -> ${newName}`);
			} catch (err) {
				logError("Failed to rename item:", err);
				setError(t("library.renameItemError"));
			}
		},
		[loadWorkspaceTree, loadTree, t],
	);

	const handleDeleteSelectedFile = useCallback(async () => {
		const node = selectedNodeRef.current;
		if (!node || node.type !== "file") return;
		if (!confirm(t("library.deleteConfirm", { name: node.name }))) return;

		try {
			if (isWorkspaceSectionRef.current) {
				await documentFileSystemService.deleteWorkspaceFile(
					toWsPath(node.path),
				);
				await loadWorkspaceTree();
				setSelectedNode(null);
				return;
			}

			await documentFileSystemService.deleteFile(node.id);
			const newTree = await loadTree();
			const curPath = currentPathRef.current;
			const parentPath = curPath.substring(0, curPath.lastIndexOf("/")) || "/";
			const parentNode = findNodeByPath(newTree, parentPath);
			setSelectedNode(parentNode ?? (newTree.length > 0 ? newTree[0] : null));
		} catch (err) {
			logError("Failed to delete file:", err);
			setError(t("library.deleteFileError"));
		}
	}, [loadWorkspaceTree, loadTree, t]);

	// ── Download ─────────────────────────────────────────────────────────────
	const handleDownloadFile = useCallback(
		async (fileId: string) => {
			try {
				const content = await documentFileSystemService.getFileContent(fileId);
				const findFile = (nodes: DocumentTreeNode[]): DocumentFile | null => {
					for (const node of nodes) {
						if (node.type === "file" && node.id === fileId && node.file)
							return node.file;
						if (node.children) {
							const found = findFile(node.children);
							if (found) return found;
						}
					}
					return null;
				};
				const file = findFile(treeRef.current);
				if (!file) return;

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
		},
		[t],
	);

	const handleDownloadSelectedFile = useCallback(async () => {
		const node = selectedNodeRef.current;
		if (!node || node.type !== "file") return;

		if (isWorkspaceSectionRef.current) {
			try {
				const sandboxPath = toWsPath(node.path);
				const content =
					await documentFileSystemService.getWorkspaceFileContent(sandboxPath);
				const blob = new Blob([content.buffer as ArrayBuffer]);
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = node.name;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			} catch (err) {
				logError("Failed to download workspace file:", err);
				setError(t("library.downloadFileError"));
			}
			return;
		}

		await handleDownloadFile(node.id);
	}, [handleDownloadFile, t]);

	// ── Move ─────────────────────────────────────────────────────────────────
	const handleMove = useCallback(
		async (
			nodeId: string,
			targetFolderId: string,
			nodeType: "file" | "folder",
		) => {
			try {
				if (nodeType === "file") {
					await documentFileSystemService.moveFile(nodeId, targetFolderId);
				} else {
					await documentFileSystemService.moveFolder(nodeId, targetFolderId);
				}
				await loadTree();
			} catch (err) {
				logError("[DOCUMENT_LIBRARY] Failed to move item:", err);
				setError("Failed to move item");
			}
		},
		[loadTree],
	);

	// ── Topic handlers ────────────────────────────────────────────────────────
	const handleTopicFilterChange = useCallback((topicIds: string[]) => {
		setSelectedTopicIds(topicIds);
	}, []);

	const handleRemoveTopicFilter = useCallback((topicId: string) => {
		setSelectedTopicIds((prev) => prev.filter((id) => id !== topicId));
	}, []);

	const handleClearTopicFilters = useCallback(() => {
		setSelectedTopicIds([]);
	}, []);

	const handleToggleTopicFilter = useCallback((topicId: string) => {
		setSelectedTopicIds((prev) =>
			prev.includes(topicId)
				? prev.filter((id) => id !== topicId)
				: [...prev, topicId],
		);
	}, []);

	const handleManageFileTopic = useCallback(
		async (file: DocumentFile) => {
			const fileTopics = fileTopicMapRef.current.get(file.path) ?? [];
			const topicIds = await NiceModal.show(TopicSelectorDialog, {
				filePath: file.path,
				fileName: file.name,
				initialTopicIds: fileTopics.map((t) => t.id),
			});

			if (topicIds && Array.isArray(topicIds)) {
				const updatedTopics = topicsRef.current.filter((t) =>
					topicIds.includes(t.id),
				);
				const newMap = new Map(fileTopicMapRef.current);
				if (updatedTopics.length > 0) {
					newMap.set(file.path, updatedTopics);
				} else {
					newMap.delete(file.path);
				}
				setFileTopicMap(newMap);
				await loadTopics();
			}
		},
		[loadTopics],
	);

	const handleConvertToKnowledge = useCallback(
		async (file: DocumentFile) => {
			try {
				const currentFileTopics = fileTopicMapRef.current.get(file.path) ?? [];
				await convertToKnowledge(file, currentFileTopics, loadTopics);
			} catch (err) {
				logError("[DOCUMENT_LIBRARY] Failed to convert to knowledge:", err);
			}
		},
		[convertToKnowledge, loadTopics],
	);

	// ── Return ────────────────────────────────────────────────────────────────
	return {
		// State
		tree,
		workspaceTree,
		selectedNode,
		selectedSection,
		loading,
		error,
		viewMode,
		searchQuery,
		topics,
		selectedTopicIds,
		fileTopicMap,
		// Derived
		currentPath,
		isFileSelected,
		isFolderSelected,
		isWorkspaceSection,
		folderContents,
		// Setters (stable)
		setViewMode,
		setSearchQuery,
		// Handlers
		handleSelectNode,
		handleSelectDocNode,
		handleSelectWorkspaceNode,
		handleSelectWorkspaceSection,
		handleToggleExpand,
		handleToggleExpandWorkspace,
		handleSelectNodeInActiveTree,
		handleOpenFolderByPath,
		handleCloseViewer,
		handleUploadFiles,
		triggerFileUpload,
		handleCreateFolder,
		handleCreateDocument,
		handleDeleteItem,
		handleRenameItem,
		handleDeleteSelectedFile,
		handleDownloadFile,
		handleDownloadSelectedFile,
		handleMove,
		handleTopicFilterChange,
		handleRemoveTopicFilter,
		handleClearTopicFilters,
		handleToggleTopicFilter,
		handleManageFileTopic,
		handleConvertToKnowledge,
	};
}
