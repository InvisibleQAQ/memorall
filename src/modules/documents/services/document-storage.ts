/**
 * Simple Document Storage Service
 * Direct filesystem operations without metadata
 */

import fs from "@/utils/fs";
import { nanoid } from "nanoid";
import { logInfo, logError } from "@/utils/logger";
import type {
	DocumentFile,
	DocumentFolder,
	DocumentLibraryItem,
	DocumentTreeNode,
	DocumentType,
} from "@/types/document-library";

const DOCUMENTS_ROOT = "/home/documents";

class DocumentStorageService {
	private static instance: DocumentStorageService;
	private initialized = false;

	private constructor() {}

	static getInstance(): DocumentStorageService {
		if (!DocumentStorageService.instance) {
			DocumentStorageService.instance = new DocumentStorageService();
		}
		return DocumentStorageService.instance;
	}

	/**
	 * Initialize the document storage system
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
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
		try {
			await fs.promises.stat(path);
		} catch {
			await fs.promises.mkdir(path, { recursive: true });
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

			// Ensure target directory exists
			await this.ensureDirectory(`${DOCUMENTS_ROOT}${normalizedPath}`);

			// Write file to filesystem
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
	 * Get tree structure by scanning filesystem
	 */
	async getTree(): Promise<DocumentTreeNode[]> {
		await this.initialize();
		return await this.scanDirectory(DOCUMENTS_ROOT, "/");
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
}

export const documentStorageService = DocumentStorageService.getInstance();
