import {
	DOCUMENTS_MOUNT_ROOT,
	WORKSPACES_MOUNT_ROOT,
	vfsBoolState,
	mountedDocumentFiles,
	mountedDocumentDirectories,
	materializedMountedFiles,
	mountedWorkspaceFiles,
	mountedWorkspaceDirectories,
	materializedWorkspaceFiles,
	pendingWorkspaceOps,
	normalizePath,
	dirname,
	toCanonicalMountedPath,
	isDocumentsPath,
	isWorkspacePath,
	assertDocumentsMountLoaded,
	assertWorkspaceMountLoaded,
	listMountedDir,
} from "./sandbox-vfs.js";

/**
 * Handle all fs.* operations.
 * Returns the result object or throws on error.
 * Throws an "unsupported" error for unknown fs operations.
 */
export const handleFsOperation = async (operation, payload, c) => {
	switch (operation) {
		case "fs.writeFile": {
			const p = toCanonicalMountedPath(payload.path);
			if (isDocumentsPath(p)) throw new Error(`Path is read-only: ${p}`);
			c.vfs.writeFileSync(p, payload.content);
			return { path: p };
		}
		case "fs.readFile": {
			const p = toCanonicalMountedPath(payload.path);
			if (mountedDocumentFiles.has(p)) {
				if (!materializedMountedFiles.has(p)) {
					throw new Error(`Mounted file is not materialized in sandbox runtime: ${p}`);
				}
				return { path: p, content: materializedMountedFiles.get(p) || "" };
			}
			if (mountedWorkspaceFiles.has(p)) {
				if (!materializedWorkspaceFiles.has(p)) {
					throw new Error(`Workspace file not materialized: ${p}`);
				}
				return { path: p, content: materializedWorkspaceFiles.get(p) || "" };
			}
			if (isDocumentsPath(p)) {
				assertDocumentsMountLoaded();
			}
			if (isWorkspacePath(p)) {
				assertWorkspaceMountLoaded();
			}
			if (!c.vfs.existsSync(p)) throw new Error(`File not found: ${p}`);
			return { path: p, content: c.vfs.readFileSync(p, "utf8") };
		}
		case "fs.mkdir": {
			const p = toCanonicalMountedPath(payload.path);
			if (isDocumentsPath(p)) throw new Error(`Path is read-only: ${p}`);
			c.vfs.mkdirSync(p, { recursive: payload.recursive !== false });
			return { path: p };
		}
		case "fs.readdir": {
			const p = toCanonicalMountedPath(payload.path);
			if (isDocumentsPath(p)) {
				assertDocumentsMountLoaded();
				if (!mountedDocumentDirectories.has(p)) throw new Error(`Directory not found: ${p}`);
				return {
					path: p,
					entries: listMountedDir(p, mountedDocumentDirectories, mountedDocumentFiles),
				};
			}
			if (isWorkspacePath(p)) {
				assertWorkspaceMountLoaded();
				if (!mountedWorkspaceDirectories.has(p)) throw new Error(`Directory not found: ${p}`);
				return {
					path: p,
					entries: listMountedDir(p, mountedWorkspaceDirectories, mountedWorkspaceFiles),
				};
			}
			return { path: p, entries: c.vfs.readdirSync(p) };
		}
		case "fs.unlink": {
			const p = toCanonicalMountedPath(payload.path);
			if (isDocumentsPath(p)) throw new Error(`Path is read-only: ${p}`);
			c.vfs.unlinkSync(p);
			return { path: p };
		}
		case "fs.rename": {
			const oldPath = toCanonicalMountedPath(payload.oldPath);
			const newPath = toCanonicalMountedPath(payload.newPath);
			if (isDocumentsPath(oldPath) || isDocumentsPath(newPath)) {
				throw new Error(`Mounted documents path is read-only: ${oldPath} -> ${newPath}`);
			}
			c.vfs.renameSync(oldPath, newPath);
			return { oldPath, newPath };
		}
		case "fs.exists": {
			const p = toCanonicalMountedPath(payload.path);
			if (isDocumentsPath(p) && !vfsBoolState.documentsMountLoaded) {
				return { path: p, exists: false };
			}
			if (isWorkspacePath(p) && !vfsBoolState.workspaceMountLoaded) {
				return { path: p, exists: false };
			}
			return {
				path: p,
				exists:
					c.vfs.existsSync(p) ||
					mountedDocumentFiles.has(p) ||
					mountedDocumentDirectories.has(p) ||
					mountedWorkspaceFiles.has(p) ||
					mountedWorkspaceDirectories.has(p),
			};
		}
		case "fs.mountDocuments": {
			mountedDocumentFiles.clear();
			mountedDocumentDirectories.clear();
			mountedDocumentDirectories.add(DOCUMENTS_MOUNT_ROOT);
			materializedMountedFiles.clear();
			vfsBoolState.documentsMountLoaded = true;

			for (const dirPath of payload.directories ?? []) {
				const p = normalizePath(dirPath);
				if (isDocumentsPath(p)) mountedDocumentDirectories.add(p);
			}
			for (const filePath of payload.files ?? []) {
				const p = normalizePath(filePath);
				if (!isDocumentsPath(p)) continue;
				mountedDocumentFiles.add(p);
				mountedDocumentDirectories.add(dirname(p));
			}
			return {
				mounted: true,
				directoryCount: mountedDocumentDirectories.size,
				fileCount: mountedDocumentFiles.size,
			};
		}
		case "fs.mountWorkspace": {
			mountedWorkspaceFiles.clear();
			mountedWorkspaceDirectories.clear();
			mountedWorkspaceDirectories.add(WORKSPACES_MOUNT_ROOT);
			materializedWorkspaceFiles.clear();
			pendingWorkspaceOps.length = 0;
			vfsBoolState.workspaceMountLoaded = true;

			for (const dirPath of payload.directories ?? []) {
				const p = toCanonicalMountedPath(dirPath);
				if (isWorkspacePath(p)) mountedWorkspaceDirectories.add(p);
			}
			for (const filePath of payload.files ?? []) {
				const p = toCanonicalMountedPath(filePath);
				if (!isWorkspacePath(p)) continue;
				mountedWorkspaceFiles.add(p);
				mountedWorkspaceDirectories.add(dirname(p));
			}
			return {
				mounted: true,
				directoryCount: mountedWorkspaceDirectories.size,
				fileCount: mountedWorkspaceFiles.size,
			};
		}
		case "fs.materializeDocumentFile": {
			const p = normalizePath(payload.path);
			if (!mountedDocumentFiles.has(p)) throw new Error(`Mounted file not found: ${p}`);
			materializedMountedFiles.set(p, payload.content);
			return { path: p, materialized: true };
		}
		case "fs.materializeWorkspaceFile": {
			const p = toCanonicalMountedPath(payload.path);
			if (!mountedWorkspaceFiles.has(p)) throw new Error(`Mounted file not found: ${p}`);
			materializedWorkspaceFiles.set(p, payload.content);
			return { path: p, materialized: true };
		}
		case "fs.flushWorkspaceWrites": {
			const ops = pendingWorkspaceOps.splice(0, pendingWorkspaceOps.length);
			return { ops };
		}
		default:
			throw new Error(`Unsupported fs operation: ${operation}`);
	}
};
