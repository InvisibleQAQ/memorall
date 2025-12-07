/**
 * Simple Document Storage Service
 * Direct filesystem operations without metadata
 */

import fs, { initializeFs } from "@/utils/fs";
import { logInfo, logError } from "@/utils/logger";
import type {
	DocumentFile,
	DocumentFolder,
	DocumentTreeNode,
	DocumentType,
} from "@/types/document-library";
import { CONTENT_BACKGROUND_EVENTS } from "@/constants/content-background";

const DOCUMENTS_ROOT = "/home/documents";

class DocumentStorageService {
	private static instance: DocumentStorageService;
	private initialized = false;
	private changeListeners: Set<() => void> = new Set();
	private messageListenerRegistered = false;

	// Internal cache with invalidation
	private treeCache: DocumentTreeNode[] | null = null;
	private treeCacheValid = false;

	private constructor() {
		// Register message listener immediately when service is created
		// This ensures we can receive notifications from other contexts right away
		this.registerMessageListener();
	}

	static getInstance(): DocumentStorageService {
		if (!DocumentStorageService.instance) {
			DocumentStorageService.instance = new DocumentStorageService();
		}
		return DocumentStorageService.instance;
	}

	/**
	 * Register the cross-context message listener
	 * Called automatically in constructor to ensure it's always ready
	 */
	private registerMessageListener(): void {
		if (this.messageListenerRegistered) return;

		try {
			chrome.runtime.onMessage.addListener(this.handleFilesystemChangeMessage);
			this.messageListenerRegistered = true;
			logInfo("📚 Document storage message listener registered");
		} catch (error) {
			// In non-extension contexts, this will fail - that's okay
			logError("Failed to register message listener:", error);
		}
	}

	/**
	 * Register a listener for filesystem changes from other contexts
	 * This allows UI components to react to changes made in other contexts (offscreen, popup, etc.)
	 */
	onFilesystemChanged(callback: () => void): () => void {
		this.changeListeners.add(callback);

		// Return unsubscribe function
		return () => {
			this.changeListeners.delete(callback);
		};
	}

	/**
	 * Notify all contexts (including this one) that the filesystem has changed
	 * Uses chrome.runtime.sendMessage which broadcasts to ALL extension contexts automatically:
	 * - Background service worker
	 * - Popup windows
	 * - Offscreen documents
	 * - Options pages
	 * - Extension tabs
	 *
	 * No relay needed in MV3 - the message reaches all contexts directly!
	 */
	private notifyFilesystemChanged(): void {
		// CRITICAL: Invalidate cache FIRST before notifying anyone
		this.invalidateCache();

		try {
			// Immediately notify local listeners
			this.changeListeners.forEach((callback) => {
				try {
					callback();
				} catch (error) {
					logError("Error in local filesystem change listener:", error);
				}
			});

			// Then broadcast to ALL other extension contexts (MV3 auto-broadcast)
			chrome.runtime
				.sendMessage({
					type: CONTENT_BACKGROUND_EVENTS.FILESYSTEM_CHANGED,
				})
				.catch((err: Error) => {
					// Ignore "no receiver" errors (expected when no other contexts are open)
					if (
						!err.message?.includes("Receiving end does not exist") &&
						!err.message?.includes("Could not establish connection")
					) {
						logError("Failed to send filesystem change notification:", err);
					}
				});
		} catch (error) {
			// In non-extension context, this might fail - notify local listeners anyway
			logError("Failed to notify filesystem change:", error);

			// Still notify local listeners even if broadcasting fails
			this.changeListeners.forEach((callback) => {
				try {
					callback();
				} catch (callbackError) {
					logError("Error in local filesystem change listener:", callbackError);
				}
			});
		}
	}

	/**
	 * Invalidate internal cache
	 * Called when filesystem changes in ANY context
	 */
	private invalidateCache(): void {
		this.treeCacheValid = false;
		this.treeCache = null;
	}

	/**
	 * Handle filesystem change messages from other contexts
	 * IMPORTANT: Must not return a value or return undefined for synchronous handling
	 * Returning true would indicate async response, but we handle everything sync
	 */
	private handleFilesystemChangeMessage = (
		message: unknown,
		_sender: chrome.runtime.MessageSender,
		_sendResponse: (response?: unknown) => void,
	): void => {
		// Type guard for message structure
		if (
			message &&
			typeof message === "object" &&
			"type" in message &&
			message.type === CONTENT_BACKGROUND_EVENTS.FILESYSTEM_CHANGED
		) {
			logInfo(
				"📢 Received filesystem change notification from another context",
			);

			// CRITICAL: Invalidate cache when receiving notification
			this.invalidateCache();

			// Notify all registered listeners synchronously
			this.changeListeners.forEach((callback) => {
				try {
					callback();
				} catch (error) {
					logError("Error in filesystem change listener:", error);
				}
			});
		}
		// Don't return anything - synchronous handling
	};

	/**
	 * Initialize the document storage system
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Wait for filesystem to be ready
			await initializeFs();

			// Ensure documents directory exists
			await this.ensureDirectory(DOCUMENTS_ROOT);

			this.initialized = true;
			logInfo("📚 Document storage initialized");
		} catch (error) {
			logError("Failed to initialize document storage:", error);
			throw error;
		}
	}

	/**
	 * Ensure a directory exists
	 */
	private async ensureDirectory(path: string): Promise<void> {
		// Split path into segments and create each level
		const segments = path.split("/").filter(Boolean);
		let currentPath = "";

		for (const segment of segments) {
			currentPath += `/${segment}`;
			try {
				await fs.promises.stat(currentPath);
				// Directory exists, continue to next level
			} catch {
				// Directory doesn't exist, create it
				try {
					await fs.promises.mkdir(currentPath);
				} catch (error) {
					// Ignore EEXIST error (directory was created by another operation)
					if (
						error &&
						typeof error === "object" &&
						"code" in error &&
						error.code !== "EEXIST"
					) {
						throw error;
					}
				}
			}
		}
	}

	/**
	 * Get document type from MIME type and filename
	 */
	private getDocumentType(mimeType: string, fileName?: string): DocumentType {
		// Check MIME type first
		if (mimeType.startsWith("application/pdf")) return "pdf";
		if (mimeType.startsWith("text/plain")) return "text";
		if (mimeType.includes("markdown")) return "markdown";
		if (mimeType.startsWith("image/")) return "image";
		if (
			mimeType === "application/vnd.ms-excel" ||
			mimeType ===
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
			mimeType === "application/vnd.ms-excel.sheet.macroEnabled.12"
		)
			return "excel";

		// Fallback to file extension
		if (fileName) {
			const ext = fileName.toLowerCase().split(".").pop();
			if (ext) {
				if (ext === "pdf") return "pdf";
				if (ext === "txt") return "text";
				if (ext === "md" || ext === "markdown") return "markdown";
				if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
				if (["xls", "xlsx", "xlsm"].includes(ext)) return "excel";
			}
		}

		return "other";
	}

	/**
	 * Upload a document file
	 */
	async uploadFile(
		file: File,
		targetPath: string = "/",
		metadata?: DocumentFile["metadata"],
	): Promise<DocumentFile> {
		await this.initialize();

		const normalizedPath = this.normalizePath(targetPath);
		let fileName = file.name;
		let fullPath = `${DOCUMENTS_ROOT}${normalizedPath}/${fileName}`;

		try {
			// Ensure target directory exists BEFORE checking if file exists
			await this.ensureDirectory(`${DOCUMENTS_ROOT}${normalizedPath}`);

			// Check if file already exists
			try {
				await fs.promises.stat(fullPath);
				// File exists, generate unique name
				const { name: baseName, ext } = this.parseFileName(fileName);
				let counter = 1;
				let newFileName = fileName;
				let newFullPath = fullPath;

				while (true) {
					try {
						await fs.promises.stat(newFullPath);
						// Still exists, try next number
						newFileName = `${baseName} (${counter})${ext}`;
						newFullPath = `${DOCUMENTS_ROOT}${normalizedPath}/${newFileName}`;
						counter++;
					} catch {
						// File doesn't exist, we can use this name
						fileName = newFileName;
						fullPath = newFullPath;
						break;
					}
				}
			} catch {
				// File doesn't exist, we can use original name
			}

			// Read file as ArrayBuffer
			const arrayBuffer = await file.arrayBuffer();
			const uint8Array = new Uint8Array(arrayBuffer);

			// Write file to filesystem (directory already ensured above)
			await fs.promises.writeFile(fullPath, uint8Array);

			// Create file metadata (use path as ID for consistency)
			const filePath = `${normalizedPath}/${fileName}`;
			const docFile: DocumentFile = {
				id: filePath, // Use path as ID
				name: fileName,
				path: filePath,
				type: this.getDocumentType(file.type, fileName),
				mimeType: file.type,
				size: file.size,
				createdAt: new Date(),
				modifiedAt: new Date(),
				metadata: metadata || {},
			};

			logInfo(`📄 Uploaded file: ${docFile.path}`);

			// Notify other contexts about the filesystem change
			this.notifyFilesystemChanged();

			return docFile;
		} catch (error) {
			logError(`Failed to upload file ${fileName}:`, error);
			throw error;
		}
	}

	/**
	 * Create a new folder
	 */
	async createFolder(
		name: string,
		parentPath: string = "/",
	): Promise<DocumentFolder> {
		await this.initialize();

		const normalizedParentPath = this.normalizePath(parentPath);
		const folderPath = `${normalizedParentPath}/${name}`;
		const fullPath = `${DOCUMENTS_ROOT}${folderPath}`;

		try {
			// Ensure parent directory exists BEFORE checking if folder exists
			await this.ensureDirectory(`${DOCUMENTS_ROOT}${normalizedParentPath}`);

			// Check if folder already exists
			try {
				await fs.promises.stat(fullPath);
				throw new Error(`Folder already exists: ${name}`);
			} catch (error) {
				// If it's not a "folder exists" error, check if it's just missing (which is what we want)
				if (
					error instanceof Error &&
					error.message.includes("already exists")
				) {
					throw error;
				}
				// Folder doesn't exist, we can create it
			}

			await this.ensureDirectory(fullPath);

			const folder: DocumentFolder = {
				id: folderPath, // Use path as ID
				name,
				path: folderPath,
				parentPath: normalizedParentPath === "/" ? null : normalizedParentPath,
				createdAt: new Date(),
				modifiedAt: new Date(),
				childCount: 0,
			};

			logInfo(`📁 Created folder: ${folder.path}`);

			// Notify other contexts about the filesystem change
			this.notifyFilesystemChanged();

			return folder;
		} catch (error) {
			logError(`Failed to create folder ${name}:`, error);
			throw error;
		}
	}

	/**
	 * Get file content by file ID (which is actually the file path)
	 */
	async getFileContent(fileId: string): Promise<Uint8Array> {
		// In the simple approach, we'll use the file path as ID
		// First try to use fileId as path directly
		let filePath = fileId;

		// If fileId doesn't start with /, it might be an old random ID
		// In that case, scan to find the file
		if (!fileId.startsWith("/")) {
			const files = await this.scanFiles("/");
			const file = files.find((f) => f.id === fileId);

			if (!file) {
				throw new Error(`File not found: ${fileId}`);
			}
			filePath = file.path;
		}

		const fullPath = `${DOCUMENTS_ROOT}${filePath}`;

		try {
			return await fs.promises.readFile(fullPath);
		} catch (error) {
			throw new Error(`File not found: ${fileId}`);
		}
	}

	/**
	 * Update file content by file ID
	 * Note: Does NOT trigger filesystem changed notification since
	 * content updates don't affect the tree structure
	 */
	async updateFileContent(fileId: string, content: Uint8Array): Promise<void> {
		// Get file path from ID
		let filePath = fileId;

		// If fileId doesn't start with /, it might be an old random ID
		// In that case, scan to find the file
		if (!fileId.startsWith("/")) {
			const files = await this.scanFiles("/");
			const file = files.find((f) => f.id === fileId);

			if (!file) {
				throw new Error(`File not found: ${fileId}`);
			}
			filePath = file.path;
		}

		const fullPath = `${DOCUMENTS_ROOT}${filePath}`;

		try {
			// Write the new content
			await fs.promises.writeFile(fullPath, content);

			// Do NOT notify filesystem changed for content updates
			// Content changes don't affect tree structure, so no reload needed
			// This prevents the editor from closing/resetting after save

			logInfo(`📝 Updated file content: ${filePath}`);
		} catch (error) {
			logError(`Failed to update file content: ${filePath}`, error);
			throw new Error(`Failed to update file: ${fileId}`);
		}
	}

	/**
	 * Get tree structure by scanning filesystem
	 * Uses internal cache to avoid re-scanning when data hasn't changed
	 * Cache is automatically invalidated when filesystem changes in ANY context
	 */
	async getTree(): Promise<DocumentTreeNode[]> {
		await this.initialize();

		// Return cached data if valid
		if (this.treeCacheValid && this.treeCache) {
			logInfo("📦 Returning cached tree data");
			return this.treeCache;
		}

		// Cache invalid or empty, fetch fresh data
		logInfo("🔄 Fetching fresh tree data");
		const freshTree = await this.scanDirectory(DOCUMENTS_ROOT, "/");

		// Update cache
		this.treeCache = freshTree;
		this.treeCacheValid = true;

		return freshTree;
	}

	/**
	 * Scan directory and build tree
	 */
	private async scanDirectory(
		fsPath: string,
		logicalPath: string,
	): Promise<DocumentTreeNode[]> {
		const nodes: DocumentTreeNode[] = [];

		try {
			const entries = await fs.promises.readdir(fsPath, {
				withFileTypes: true,
			});

			for (const entry of entries) {
				const fullFsPath = `${fsPath}/${entry.name}`;
				const fullLogicalPath =
					logicalPath === "/"
						? `/${entry.name}`
						: `${logicalPath}/${entry.name}`;

				if (entry.isDirectory()) {
					const children = await this.scanDirectory(
						fullFsPath,
						fullLogicalPath,
					);
					const folder: DocumentFolder = {
						id: fullLogicalPath, // Use path as ID
						name: entry.name,
						path: fullLogicalPath,
						parentPath: logicalPath === "/" ? null : logicalPath,
						createdAt: new Date(),
						modifiedAt: new Date(),
						childCount: children.length,
					};

					nodes.push({
						id: folder.id,
						name: entry.name,
						path: fullLogicalPath,
						type: "folder",
						isExpanded: false,
						children,
						folder,
					});
				} else if (entry.isFile()) {
					try {
						const stats = await fs.promises.stat(fullFsPath);
						const detectedType = this.getDocumentType("", entry.name);
						const mimeType = this.getMimeTypeFromExtension(entry.name);

						const file: DocumentFile = {
							id: fullLogicalPath, // Use path as ID
							name: entry.name,
							path: fullLogicalPath,
							type: detectedType,
							mimeType: mimeType,
							size: stats.size,
							createdAt: new Date(stats.birthtime || stats.mtime),
							modifiedAt: new Date(stats.mtime),
							metadata: {},
						};

						nodes.push({
							id: file.id,
							name: entry.name,
							path: fullLogicalPath,
							type: "file",
							isExpanded: false,
							children: [],
							file,
						});
					} catch (error) {
						logError(`Failed to stat file ${fullFsPath}:`, error);
					}
				}
			}
		} catch (error) {
			logError(`Failed to scan directory ${fsPath}:`, error);
		}

		return nodes;
	}

	/**
	 * Scan all files (helper for getFileContent)
	 */
	private async scanFiles(path: string): Promise<DocumentFile[]> {
		const files: DocumentFile[] = [];
		const tree = await this.getTree();

		const collectFiles = (nodes: DocumentTreeNode[]) => {
			for (const node of nodes) {
				if (node.type === "file" && node.file) {
					files.push(node.file);
				}
				if (node.children) {
					collectFiles(node.children);
				}
			}
		};

		collectFiles(tree);
		return files;
	}

	/**
	 * Delete a file
	 */
	async deleteFile(fileId: string): Promise<void> {
		const files = await this.scanFiles("/");
		const file = files.find((f) => f.id === fileId);

		if (!file) {
			throw new Error(`File not found: ${fileId}`);
		}

		const fullPath = `${DOCUMENTS_ROOT}${file.path}`;
		await fs.promises.unlink(fullPath);
		logInfo(`🗑️ Deleted file: ${file.path}`);

		// Notify other contexts about the filesystem change
		this.notifyFilesystemChanged();
	}

	/**
	 * Delete a folder
	 */
	async deleteFolder(folderId: string): Promise<void> {
		// This is complex without metadata, would need to scan and find folder
		// For now, throw error
		throw new Error("Folder deletion not implemented in simple mode");
	}

	/**
	 * Rename a file
	 */
	async renameFile(fileId: string, newName: string): Promise<DocumentFile> {
		await this.initialize();

		const files = await this.scanFiles("/");
		const file = files.find((f) => f.id === fileId);

		if (!file) {
			throw new Error(`File not found: ${fileId}`);
		}

		const oldFullPath = `${DOCUMENTS_ROOT}${file.path}`;
		const parentPath = file.path.substring(0, file.path.lastIndexOf("/"));
		const newPath = `${parentPath}/${newName}`;
		const newFullPath = `${DOCUMENTS_ROOT}${newPath}`;

		try {
			// Check if a file with the new name already exists
			try {
				await fs.promises.stat(newFullPath);
				throw new Error(`A file with the name "${newName}" already exists`);
			} catch (error) {
				// If it's not a "file exists" error, continue with rename
				if (
					error instanceof Error &&
					error.message.includes("already exists")
				) {
					throw error;
				}
			}

			// Rename the file
			await fs.promises.rename(oldFullPath, newFullPath);

			// Get new file stats
			const stats = await fs.promises.stat(newFullPath);
			const mimeType = this.getMimeTypeFromExtension(newName);

			const renamedFile: DocumentFile = {
				id: newPath,
				name: newName,
				path: newPath,
				type: this.getDocumentType(mimeType, newName),
				mimeType,
				size: stats.size,
				createdAt: new Date(stats.birthtime || stats.mtime),
				modifiedAt: new Date(stats.mtime),
				metadata: file.metadata || {},
			};

			logInfo(`📝 Renamed file: ${file.path} -> ${newPath}`);

			// Notify other contexts about the filesystem change
			this.notifyFilesystemChanged();

			return renamedFile;
		} catch (error) {
			logError(`Failed to rename file ${fileId}:`, error);
			throw error;
		}
	}

	/**
	 * Rename a folder
	 */
	async renameFolder(
		folderId: string,
		newName: string,
	): Promise<DocumentFolder> {
		await this.initialize();

		const oldFullPath = `${DOCUMENTS_ROOT}${folderId}`;
		const parentPath = folderId.substring(0, folderId.lastIndexOf("/")) || "/";
		const newPath =
			parentPath === "/" ? `/${newName}` : `${parentPath}/${newName}`;
		const newFullPath = `${DOCUMENTS_ROOT}${newPath}`;

		try {
			// Check if folder exists
			const stats = await fs.promises.stat(oldFullPath);
			if (!stats.isDirectory()) {
				throw new Error("Path is not a folder");
			}

			// Check if a folder with the new name already exists
			try {
				await fs.promises.stat(newFullPath);
				throw new Error(`A folder with the name "${newName}" already exists`);
			} catch (error) {
				// If it's not a "folder exists" error, continue with rename
				if (
					error instanceof Error &&
					error.message.includes("already exists")
				) {
					throw error;
				}
			}

			// Rename the folder
			await fs.promises.rename(oldFullPath, newFullPath);

			// Get new folder stats and count children
			const newStats = await fs.promises.stat(newFullPath);
			const entries = await fs.promises.readdir(newFullPath);

			const renamedFolder: DocumentFolder = {
				id: newPath,
				name: newName,
				path: newPath,
				parentPath: parentPath === "/" ? null : parentPath,
				createdAt: new Date(newStats.birthtime || newStats.mtime),
				modifiedAt: new Date(newStats.mtime),
				childCount: entries.length,
			};

			logInfo(`📁 Renamed folder: ${folderId} -> ${newPath}`);

			// Notify other contexts about the filesystem change
			this.notifyFilesystemChanged();

			return renamedFolder;
		} catch (error) {
			logError(`Failed to rename folder ${folderId}:`, error);
			throw error;
		}
	}

	/**
	 * Parse filename into name and extension
	 */
	private parseFileName(fileName: string): { name: string; ext: string } {
		const lastDotIndex = fileName.lastIndexOf(".");
		if (lastDotIndex === -1) {
			return { name: fileName, ext: "" };
		}
		return {
			name: fileName.substring(0, lastDotIndex),
			ext: fileName.substring(lastDotIndex),
		};
	}

	/**
	 * Get MIME type from file extension
	 */
	private getMimeTypeFromExtension(fileName: string): string {
		const ext = fileName.toLowerCase().split(".").pop();
		if (!ext) return "application/octet-stream";

		const mimeTypes: Record<string, string> = {
			pdf: "application/pdf",
			txt: "text/plain",
			md: "text/markdown",
			markdown: "text/markdown",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			png: "image/png",
			gif: "image/gif",
			webp: "image/webp",
			xls: "application/vnd.ms-excel",
			xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
		};

		return mimeTypes[ext] || "application/octet-stream";
	}

	/**
	 * Normalize path
	 */
	private normalizePath(path: string): string {
		return path.replace(/\/+$/, "") || "/";
	}

	/**
	 * Move a file to a new location
	 */
	async moveFile(
		fileId: string,
		targetFolderPath: string,
	): Promise<DocumentFile> {
		await this.initialize();

		const normalizedTargetPath = this.normalizePath(targetFolderPath);
		const filePath = `${DOCUMENTS_ROOT}${fileId}`;

		try {
			// Get file stats to ensure it exists and is a file
			const stats = await fs.promises.stat(filePath);
			if (!stats.isFile()) {
				throw new Error("Path is not a file");
			}

			// Get file name from path
			const fileName = filePath.split("/").pop() || "";
			let newFilePath = `${DOCUMENTS_ROOT}${normalizedTargetPath}/${fileName}`;

			// Check if file already exists at destination
			try {
				await fs.promises.stat(newFilePath);
				// File exists, generate unique name
				const { name: baseName, ext } = this.parseFileName(fileName);
				let counter = 1;
				let newFileName = fileName;

				while (true) {
					try {
						await fs.promises.stat(newFilePath);
						// Still exists, try next number
						newFileName = `${baseName} (${counter})${ext}`;
						newFilePath = `${DOCUMENTS_ROOT}${normalizedTargetPath}/${newFileName}`;
						counter++;
					} catch {
						// File doesn't exist, we can use this name
						break;
					}
				}
			} catch {
				// File doesn't exist at destination, we can use original name
			}

			// Ensure target directory exists
			await this.ensureDirectory(`${DOCUMENTS_ROOT}${normalizedTargetPath}`);

			// Read file content
			const content = await fs.promises.readFile(filePath);

			// Write to new location
			await fs.promises.writeFile(newFilePath, content);

			// Delete old file
			await fs.promises.unlink(filePath);

			// Get new file stats
			const newStats = await fs.promises.stat(newFilePath);
			const newFileName = newFilePath.split("/").pop() || "";
			const newId = newFilePath.replace(DOCUMENTS_ROOT, "");

			// Detect MIME type from file extension
			const mimeType = this.getMimeTypeFromExtension(newFileName);

			logInfo(`✅ Moved file from ${fileId} to ${newId}`);

			// Notify other contexts about the filesystem change
			this.notifyFilesystemChanged();

			return {
				id: newId,
				name: newFileName,
				type: this.getDocumentType(mimeType, newFileName),
				path: newId,
				size: newStats.size,
				mimeType,
				createdAt: newStats.birthtime,
				modifiedAt: newStats.mtime,
			};
		} catch (error) {
			logError(`Failed to move file ${fileId}:`, error);
			throw error;
		}
	}

	/**
	 * Move a folder to a new location
	 */
	async moveFolder(
		folderId: string,
		targetFolderPath: string,
	): Promise<DocumentFolder> {
		await this.initialize();

		const normalizedTargetPath = this.normalizePath(targetFolderPath);
		const folderPath = `${DOCUMENTS_ROOT}${folderId}`;
		const targetFullPath = `${DOCUMENTS_ROOT}${normalizedTargetPath}`;

		try {
			// Validate source folder exists and is a directory
			const stats = await fs.promises.stat(folderPath);
			if (!stats.isDirectory()) {
				throw new Error("Path is not a folder");
			}

			// Prevent moving a folder into itself or its subdirectories
			if (targetFullPath.startsWith(folderPath)) {
				throw new Error(
					"Cannot move a folder into itself or its subdirectories",
				);
			}

			// Get folder name from path
			const folderName = folderPath.split("/").filter(Boolean).pop() || "";
			let newFolderPath = `${targetFullPath}/${folderName}`;

			// Check if folder already exists at destination
			try {
				await fs.promises.stat(newFolderPath);
				// Folder exists, generate unique name
				let counter = 1;
				let newFolderName = folderName;

				while (true) {
					try {
						await fs.promises.stat(newFolderPath);
						// Still exists, try next number
						newFolderName = `${folderName} (${counter})`;
						newFolderPath = `${targetFullPath}/${newFolderName}`;
						counter++;
					} catch {
						// Folder doesn't exist, we can use this name
						break;
					}
				}
			} catch {
				// Folder doesn't exist at destination
			}

			// Ensure target directory exists
			await this.ensureDirectory(targetFullPath);

			// Recursively copy folder
			await this.copyDirectory(folderPath, newFolderPath);

			// Delete old folder
			await this.deleteDirectoryRecursive(folderPath);

			// Get new folder stats
			const newStats = await fs.promises.stat(newFolderPath);
			const newFolderName =
				newFolderPath.split("/").filter(Boolean).pop() || "";
			const newId = newFolderPath.replace(DOCUMENTS_ROOT, "");

			// Count children
			const entries = await fs.promises.readdir(newFolderPath);

			logInfo(`✅ Moved folder from ${folderId} to ${newId}`);

			// Notify other contexts about the filesystem change
			this.notifyFilesystemChanged();

			return {
				id: newId,
				name: newFolderName,
				path: newId,
				parentPath: normalizedTargetPath === "/" ? null : normalizedTargetPath,
				childCount: entries.length,
				createdAt: newStats.birthtime,
				modifiedAt: newStats.mtime,
			};
		} catch (error) {
			logError(`Failed to move folder ${folderId}:`, error);
			throw error;
		}
	}

	/**
	 * Recursively copy a directory
	 */
	private async copyDirectory(
		source: string,
		destination: string,
	): Promise<void> {
		await fs.promises.mkdir(destination, { recursive: true });
		const entries = await fs.promises.readdir(source, { withFileTypes: true });

		for (const entry of entries) {
			const sourcePath = `${source}/${entry.name}`;
			const destPath = `${destination}/${entry.name}`;

			if (entry.isDirectory()) {
				await this.copyDirectory(sourcePath, destPath);
			} else {
				const content = await fs.promises.readFile(sourcePath);
				await fs.promises.writeFile(destPath, content);
			}
		}
	}

	/**
	 * Recursively delete a directory
	 */
	private async deleteDirectoryRecursive(path: string): Promise<void> {
		const entries = await fs.promises.readdir(path, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = `${path}/${entry.name}`;
			if (entry.isDirectory()) {
				await this.deleteDirectoryRecursive(fullPath);
			} else {
				await fs.promises.unlink(fullPath);
			}
		}

		await fs.promises.rmdir(path);
	}
}

export const documentStorageService = DocumentStorageService.getInstance();
