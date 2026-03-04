// ---------------------------------------------------------------------------
// sandbox-vfs.js — Virtual filesystem overlay for the sandbox container
// Handles /documents (read-only) and /workspaces (read-write) mount points.
// ---------------------------------------------------------------------------

export const DOCUMENTS_MOUNT_ROOT = "/documents";
export const WORKSPACES_MOUNT_ROOT = "/workspaces";
export const WORKSPACE_LEGACY_MOUNT_ROOT = "/workspace";
export const VFS_DOCUMENTS_OVERLAY_FLAG = "__documentsOverlayInstalled";

// Boolean mount state — exported as an object so callers can assign across
// the ES module boundary (primitive re-assignment doesn't propagate in ESM).
export const vfsBoolState = {
	documentsMountLoaded: false,
	workspaceMountLoaded: false,
};

// Reference-type state (Sets / Maps / Arrays) — exported directly; callers
// mutate their contents freely.
export const mountedDocumentFiles = new Set();
export const mountedDocumentDirectories = new Set();
export const materializedMountedFiles = new Map();
export const mountedWorkspaceFiles = new Set();
export const mountedWorkspaceDirectories = new Set();
export const materializedWorkspaceFiles = new Map();
export const pendingWorkspaceOps = [];

// ---------------------------------------------------------------------------
// Path utilities
// ---------------------------------------------------------------------------

export const normalizePath = (inputPath) => {
	if (typeof inputPath !== "string" || inputPath.length === 0) {
		throw new Error("Path must be a non-empty string");
	}
	const raw = inputPath.trim().replace(/\\/g, "/");
	if (!raw) throw new Error("Path must be a non-empty string");
	const candidate = (raw.startsWith("/") ? raw : `/${raw}`).replace(/\/+/g, "/");
	const parts = candidate.split("/").filter(Boolean);
	const resolved = [];
	for (const part of parts) {
		if (part === ".") continue;
		if (part === "..") {
			resolved.pop();
			continue;
		}
		resolved.push(part);
	}
	return resolved.length ? `/${resolved.join("/")}` : "/";
};

export const dirname = (inputPath) => {
	const normalized = normalizePath(inputPath);
	const idx = normalized.lastIndexOf("/");
	if (idx <= 0) return "/";
	return normalized.slice(0, idx);
};

export const toCanonicalWorkspacePath = (inputPath) => {
	const path = normalizePath(inputPath);
	if (path === WORKSPACE_LEGACY_MOUNT_ROOT) return WORKSPACES_MOUNT_ROOT;
	if (path.startsWith(`${WORKSPACE_LEGACY_MOUNT_ROOT}/`)) {
		return `${WORKSPACES_MOUNT_ROOT}${path.slice(WORKSPACE_LEGACY_MOUNT_ROOT.length)}`;
	}
	return path;
};

export const toCanonicalMountedPath = (inputPath) => toCanonicalWorkspacePath(normalizePath(inputPath));

export const isDocumentsPath = (path) =>
	path === DOCUMENTS_MOUNT_ROOT || path.startsWith(`${DOCUMENTS_MOUNT_ROOT}/`);

export const isWorkspacePath = (path) =>
	path === WORKSPACES_MOUNT_ROOT ||
	path.startsWith(`${WORKSPACES_MOUNT_ROOT}/`) ||
	path === WORKSPACE_LEGACY_MOUNT_ROOT ||
	path.startsWith(`${WORKSPACE_LEGACY_MOUNT_ROOT}/`);

export const assertDocumentsMountLoaded = () => {
	if (!vfsBoolState.documentsMountLoaded) {
		throw new Error("Documents mount is not loaded in sandbox runtime");
	}
};

export const assertWorkspaceMountLoaded = () => {
	if (!vfsBoolState.workspaceMountLoaded) {
		throw new Error("Workspace mount is not loaded in sandbox runtime");
	}
};

// ---------------------------------------------------------------------------
// FS helpers
// ---------------------------------------------------------------------------

export const createFsError = (code, syscall, path) => {
	const messageByCode = {
		ENOENT: "no such file or directory",
		ENOTDIR: "not a directory",
		EISDIR: "illegal operation on a directory",
	};
	const message = messageByCode[code] || "filesystem error";
	const err = new Error(`${code}: ${message}, ${syscall} '${path}'`);
	err.code = code;
	err.syscall = syscall;
	err.path = path;
	return err;
};

export const listMountedDir = (path, directories, files) => {
	const normalized = normalizePath(path);
	const prefix = normalized === "/" ? "/" : `${normalized}/`;
	const entries = new Set();

	for (const dir of directories) {
		if (!dir.startsWith(prefix) || dir === normalized) continue;
		const rest = dir.slice(prefix.length);
		if (!rest || rest.includes("/")) continue;
		entries.add(rest);
	}

	for (const filePath of files) {
		if (!filePath.startsWith(prefix)) continue;
		const rest = filePath.slice(prefix.length);
		if (!rest || rest.includes("/")) continue;
		entries.add(rest);
	}

	return Array.from(entries).sort();
};

export const createMountedStat = (path, isDirectory, size = 0) => {
	const mtime = new Date();
	return {
		size,
		mtime,
		isFile: () => !isDirectory,
		isDirectory: () => isDirectory,
		isSymbolicLink: () => false,
		path,
	};
};

// ---------------------------------------------------------------------------
// VFS overlay — patches vfs.readFileSync / writeFileSync / etc. to intercept
// /documents and /workspaces paths.
// ---------------------------------------------------------------------------

export const installDocumentsVfsOverlay = (vfs) => {
	if (!vfs || vfs[VFS_DOCUMENTS_OVERLAY_FLAG]) return;

	const original = {
		readdirSync: typeof vfs.readdirSync === "function" ? vfs.readdirSync.bind(vfs) : null,
		readFileSync: typeof vfs.readFileSync === "function" ? vfs.readFileSync.bind(vfs) : null,
		existsSync: typeof vfs.existsSync === "function" ? vfs.existsSync.bind(vfs) : null,
		statSync: typeof vfs.statSync === "function" ? vfs.statSync.bind(vfs) : null,
		lstatSync: typeof vfs.lstatSync === "function" ? vfs.lstatSync.bind(vfs) : null,
		accessSync: typeof vfs.accessSync === "function" ? vfs.accessSync.bind(vfs) : null,
		writeFileSync: typeof vfs.writeFileSync === "function" ? vfs.writeFileSync.bind(vfs) : null,
		mkdirSync: typeof vfs.mkdirSync === "function" ? vfs.mkdirSync.bind(vfs) : null,
		unlinkSync: typeof vfs.unlinkSync === "function" ? vfs.unlinkSync.bind(vfs) : null,
		renameSync: typeof vfs.renameSync === "function" ? vfs.renameSync.bind(vfs) : null,
	};

	const ensureParentDirectories = (path, directories) => {
		const segments = path.split("/").filter(Boolean);
		let current = "";
		for (let i = 0; i < segments.length - 1; i++) {
			current += `/${segments[i]}`;
			directories.add(current);
		}
	};

	const removeWorkspacePath = (path) => {
		if (mountedWorkspaceFiles.has(path)) {
			mountedWorkspaceFiles.delete(path);
			materializedWorkspaceFiles.delete(path);
			return;
		}
		if (mountedWorkspaceDirectories.has(path)) {
			const prefix = `${path}/`;
			for (const file of Array.from(mountedWorkspaceFiles)) {
				if (file.startsWith(prefix)) {
					mountedWorkspaceFiles.delete(file);
					materializedWorkspaceFiles.delete(file);
				}
			}
			for (const dir of Array.from(mountedWorkspaceDirectories)) {
				if (dir !== WORKSPACES_MOUNT_ROOT && dir.startsWith(prefix)) {
					mountedWorkspaceDirectories.delete(dir);
				}
			}
			if (path !== WORKSPACES_MOUNT_ROOT) {
				mountedWorkspaceDirectories.delete(path);
			}
		}
	};

	const readTextContent = (content) => {
		if (typeof content === "string") return content;
		if (content instanceof Uint8Array) return new TextDecoder().decode(content);
		if (ArrayBuffer.isView(content)) {
			return new TextDecoder().decode(new Uint8Array(content.buffer, content.byteOffset, content.byteLength));
		}
		if (content instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(content));
		try { return JSON.stringify(content); } catch { return String(content); }
	};

	vfs.readdirSync = (inputPath, ...rest) => {
		const path = toCanonicalMountedPath(String(inputPath));
		if (isDocumentsPath(path)) {
			assertDocumentsMountLoaded();
			if (!mountedDocumentDirectories.has(path)) {
				throw createFsError("ENOENT", "scandir", path);
			}
			return listMountedDir(path, mountedDocumentDirectories, mountedDocumentFiles);
		}
		if (isWorkspacePath(path)) {
			assertWorkspaceMountLoaded();
			if (!mountedWorkspaceDirectories.has(path)) {
				throw createFsError("ENOENT", "scandir", path);
			}
			return listMountedDir(path, mountedWorkspaceDirectories, mountedWorkspaceFiles);
		}
		if (!original.readdirSync) {
			throw new Error("vfs.readdirSync is not available");
		}
		return original.readdirSync(path, ...rest);
	};

	vfs.existsSync = (inputPath, ...rest) => {
		const path = toCanonicalMountedPath(String(inputPath));
		if (isDocumentsPath(path)) {
			if (!vfsBoolState.documentsMountLoaded) return false;
			return mountedDocumentFiles.has(path) || mountedDocumentDirectories.has(path);
		}
		if (isWorkspacePath(path)) {
			if (!vfsBoolState.workspaceMountLoaded) return false;
			return mountedWorkspaceFiles.has(path) || mountedWorkspaceDirectories.has(path);
		}
		if (!original.existsSync) return false;
		return original.existsSync(path, ...rest);
	};

	vfs.readFileSync = (inputPath, encoding, ...rest) => {
		const path = toCanonicalMountedPath(String(inputPath));
		if (isDocumentsPath(path)) {
			assertDocumentsMountLoaded();
			if (!mountedDocumentFiles.has(path)) {
				throw createFsError("ENOENT", "open", path);
			}
			if (!materializedMountedFiles.has(path)) {
				throw new Error(`Mounted file is not materialized in sandbox runtime: ${path}`);
			}
			const content = materializedMountedFiles.get(path) || "";
			if (!encoding || encoding === "utf8" || encoding === "utf-8") {
				return content;
			}
			return new TextEncoder().encode(content);
		}
		if (isWorkspacePath(path)) {
			assertWorkspaceMountLoaded();
			if (!mountedWorkspaceFiles.has(path)) {
				throw createFsError("ENOENT", "open", path);
			}
			if (!materializedWorkspaceFiles.has(path)) {
				throw new Error(`Workspace file not materialized: ${path}`);
			}
			const content = materializedWorkspaceFiles.get(path) || "";
			if (!encoding || encoding === "utf8" || encoding === "utf-8") {
				return content;
			}
			return new TextEncoder().encode(content);
		}
		if (!original.readFileSync) {
			throw new Error("vfs.readFileSync is not available");
		}
		return original.readFileSync(path, encoding, ...rest);
	};

	const statLike = (inputPath, ...rest) => {
		const path = toCanonicalMountedPath(String(inputPath));
		if (isDocumentsPath(path)) {
			assertDocumentsMountLoaded();
			if (mountedDocumentDirectories.has(path)) {
				return createMountedStat(path, true, 0);
			}
			if (mountedDocumentFiles.has(path)) {
				const content = materializedMountedFiles.get(path) || "";
				return createMountedStat(path, false, content.length);
			}
			throw createFsError("ENOENT", "stat", path);
		}
		if (isWorkspacePath(path)) {
			assertWorkspaceMountLoaded();
			if (mountedWorkspaceDirectories.has(path)) {
				return createMountedStat(path, true, 0);
			}
			if (mountedWorkspaceFiles.has(path)) {
				const content = materializedWorkspaceFiles.get(path) || "";
				return createMountedStat(path, false, content.length);
			}
			throw createFsError("ENOENT", "stat", path);
		}
		if (!original.statSync) {
			throw new Error("vfs.statSync is not available");
		}
		return original.statSync(path, ...rest);
	};
	vfs.statSync = statLike;
	vfs.lstatSync = (...args) => statLike(...args);

	vfs.accessSync = (inputPath, ...rest) => {
		const path = toCanonicalMountedPath(String(inputPath));
		if (isDocumentsPath(path)) {
			assertDocumentsMountLoaded();
			if (!mountedDocumentFiles.has(path) && !mountedDocumentDirectories.has(path)) {
				throw createFsError("ENOENT", "access", path);
			}
			return;
		}
		if (isWorkspacePath(path)) {
			assertWorkspaceMountLoaded();
			if (!mountedWorkspaceFiles.has(path) && !mountedWorkspaceDirectories.has(path)) {
				throw createFsError("ENOENT", "access", path);
			}
			return;
		}
		if (original.accessSync) {
			return original.accessSync(path, ...rest);
		}
	};

	vfs.writeFileSync = (inputPath, content, ...rest) => {
		const path = toCanonicalMountedPath(String(inputPath));
		if (isDocumentsPath(path)) {
			throw new Error(`Path is read-only: ${path}`);
		}
		if (isWorkspacePath(path)) {
			assertWorkspaceMountLoaded();
		}
		if (!original.writeFileSync) {
			throw new Error("vfs.writeFileSync is not available");
		}
		original.writeFileSync(path, content, ...rest);
		if (isWorkspacePath(path)) {
			mountedWorkspaceFiles.add(path);
			ensureParentDirectories(path, mountedWorkspaceDirectories);
			materializedWorkspaceFiles.set(path, readTextContent(content));
			pendingWorkspaceOps.push({ op: "write", path, content: materializedWorkspaceFiles.get(path) || "" });
		}
	};

	vfs.mkdirSync = (inputPath, options, ...rest) => {
		const path = toCanonicalMountedPath(String(inputPath));
		if (isDocumentsPath(path)) {
			throw new Error(`Path is read-only: ${path}`);
		}
		if (isWorkspacePath(path)) {
			assertWorkspaceMountLoaded();
		}
		if (!original.mkdirSync) {
			throw new Error("vfs.mkdirSync is not available");
		}
		original.mkdirSync(path, options, ...rest);
		if (isWorkspacePath(path)) {
			ensureParentDirectories(path, mountedWorkspaceDirectories);
			mountedWorkspaceDirectories.add(path);
		}
	};

	vfs.unlinkSync = (inputPath, ...rest) => {
		const path = toCanonicalMountedPath(String(inputPath));
		if (isDocumentsPath(path)) {
			throw new Error(`Path is read-only: ${path}`);
		}
		if (isWorkspacePath(path)) {
			assertWorkspaceMountLoaded();
		}
		if (!original.unlinkSync) {
			throw new Error("vfs.unlinkSync is not available");
		}
		original.unlinkSync(path, ...rest);
		if (isWorkspacePath(path)) {
			removeWorkspacePath(path);
			pendingWorkspaceOps.push({ op: "delete", path });
		}
	};

	vfs.renameSync = (oldInputPath, newInputPath, ...rest) => {
		const oldPath = toCanonicalMountedPath(String(oldInputPath));
		const newPath = toCanonicalMountedPath(String(newInputPath));
		if (isDocumentsPath(oldPath) || isDocumentsPath(newPath)) {
			throw new Error(`Mounted documents path is read-only: ${oldPath} -> ${newPath}`);
		}
		if (isWorkspacePath(oldPath) || isWorkspacePath(newPath)) {
			assertWorkspaceMountLoaded();
			if (!isWorkspacePath(oldPath) || !isWorkspacePath(newPath)) {
				throw new Error(`Workspace rename must stay within workspace mount: ${oldPath} -> ${newPath}`);
			}
		}
		if (!original.renameSync) {
			throw new Error("vfs.renameSync is not available");
		}
		original.renameSync(oldPath, newPath, ...rest);
		if (isWorkspacePath(oldPath) || isWorkspacePath(newPath)) {
			if (mountedWorkspaceFiles.has(oldPath)) {
				mountedWorkspaceFiles.delete(oldPath);
				mountedWorkspaceFiles.add(newPath);
				const content = materializedWorkspaceFiles.get(oldPath);
				materializedWorkspaceFiles.delete(oldPath);
				if (typeof content === "string") {
					materializedWorkspaceFiles.set(newPath, content);
				}
			} else if (mountedWorkspaceDirectories.has(oldPath)) {
				const oldPrefix = `${oldPath}/`;
				const newPrefix = `${newPath}/`;
				const dirsToMove = Array.from(mountedWorkspaceDirectories).filter((dir) => dir === oldPath || dir.startsWith(oldPrefix));
				const filesToMove = Array.from(mountedWorkspaceFiles).filter((file) => file.startsWith(oldPrefix));
				const fileContents = new Map();
				for (const file of filesToMove) {
					if (materializedWorkspaceFiles.has(file)) {
						fileContents.set(file, materializedWorkspaceFiles.get(file));
					}
				}
				for (const dir of dirsToMove) mountedWorkspaceDirectories.delete(dir);
				for (const file of filesToMove) mountedWorkspaceFiles.delete(file);
				for (const file of filesToMove) materializedWorkspaceFiles.delete(file);
				for (const dir of dirsToMove) {
					const moved = dir === oldPath ? newPath : `${newPrefix}${dir.slice(oldPrefix.length)}`;
					mountedWorkspaceDirectories.add(moved);
				}
				for (const file of filesToMove) {
					const moved = `${newPrefix}${file.slice(oldPrefix.length)}`;
					mountedWorkspaceFiles.add(moved);
					if (fileContents.has(file)) {
						materializedWorkspaceFiles.set(moved, fileContents.get(file) || "");
					}
				}
			}
			pendingWorkspaceOps.push({ op: "rename", oldPath, newPath });
		}
	};

	vfs[VFS_DOCUMENTS_OVERLAY_FLAG] = true;
};
