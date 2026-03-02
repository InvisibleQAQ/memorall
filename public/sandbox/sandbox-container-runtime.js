import * as AlmostNodeLib from "./vendors/almostnode.bundle.js";

const SANDBOX_CHANNEL = "memorall-sandbox-container";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_LOG_ENTRIES = 20;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const MAX_RUNTIME_LOG_ENTRIES = 500;
const DOCUMENTS_MOUNT_ROOT = "/documents";
const WORKSPACES_MOUNT_ROOT = "/workspaces";
const WORKSPACE_LEGACY_MOUNT_ROOT = "/workspace";

const initializedAt = Date.now();
const runtimeLogs = [];
const repls = new Map();
const mountedDocumentFiles = new Set();
const mountedDocumentDirectories = new Set();
const materializedMountedFiles = new Map();
let documentsMountLoaded = false;
const mountedWorkspaceFiles = new Set();
const mountedWorkspaceDirectories = new Set();
const materializedWorkspaceFiles = new Map();
const pendingWorkspaceOps = [];
let workspaceMountLoaded = false;
const installedPackages = new Map();
const servers = new Map();
let serverBridgeReady = false;

let container = null;
let currentExecutionContext = null;
const VFS_DOCUMENTS_OVERLAY_FLAG = "__documentsOverlayInstalled";

const safeSerialize = (value) => {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (value === null) return "null";
	if (value === undefined) return "undefined";
	try {
		return JSON.stringify(value);
	} catch {
		try {
			return String(value);
		} catch {
			return "[unserializable]";
		}
	}
};

const toError = (error) => {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}
	return { message: safeSerialize(error) };
};

const appendBounded = (list, value, limit) => {
	if (list.length < limit) {
		list.push(value);
		return 0;
	}
	list.shift();
	list.push(value);
	return 1;
};

const pushRuntimeLog = (level, message) => {
	appendBounded(runtimeLogs, { level, message, timestamp: Date.now() }, MAX_RUNTIME_LOG_ENTRIES);
};

const normalizePath = (inputPath) => {
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

const dirname = (inputPath) => {
	const normalized = normalizePath(inputPath);
	const idx = normalized.lastIndexOf("/");
	if (idx <= 0) return "/";
	return normalized.slice(0, idx);
};

const toCanonicalWorkspacePath = (inputPath) => {
	const path = normalizePath(inputPath);
	if (path === WORKSPACE_LEGACY_MOUNT_ROOT) return WORKSPACES_MOUNT_ROOT;
	if (path.startsWith(`${WORKSPACE_LEGACY_MOUNT_ROOT}/`)) {
		return `${WORKSPACES_MOUNT_ROOT}${path.slice(WORKSPACE_LEGACY_MOUNT_ROOT.length)}`;
	}
	return path;
};

const toCanonicalMountedPath = (inputPath) => toCanonicalWorkspacePath(normalizePath(inputPath));
const isDocumentsPath = (path) => path === DOCUMENTS_MOUNT_ROOT || path.startsWith(`${DOCUMENTS_MOUNT_ROOT}/`);
const isWorkspacePath = (path) =>
	path === WORKSPACES_MOUNT_ROOT ||
	path.startsWith(`${WORKSPACES_MOUNT_ROOT}/`) ||
	path === WORKSPACE_LEGACY_MOUNT_ROOT ||
	path.startsWith(`${WORKSPACE_LEGACY_MOUNT_ROOT}/`);
const assertDocumentsMountLoaded = () => {
	if (!documentsMountLoaded) {
		throw new Error("Documents mount is not loaded in sandbox runtime");
	}
};
const assertWorkspaceMountLoaded = () => {
	if (!workspaceMountLoaded) {
		throw new Error("Workspace mount is not loaded in sandbox runtime");
	}
};

const createFsError = (code, syscall, path) => {
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

const listMountedDir = (path, directories, files) => {
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

const createMountedStat = (path, isDirectory, size = 0) => {
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

const installDocumentsVfsOverlay = (vfs) => {
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
		return safeSerialize(content);
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
			if (!documentsMountLoaded) return false;
			return mountedDocumentFiles.has(path) || mountedDocumentDirectories.has(path);
		}
		if (isWorkspacePath(path)) {
			if (!workspaceMountLoaded) return false;
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

const normalizeClientHostname = (hostname) => {
	if (hostname === "0.0.0.0" || hostname === "::") return "127.0.0.1";
	return hostname || "127.0.0.1";
};

const normalizeClientUrl = (rawUrl) => {
	try {
		const parsed = new URL(rawUrl);
		if (parsed.hostname === "0.0.0.0" || parsed.hostname === "::") {
			parsed.hostname = "127.0.0.1";
		}
		return parsed.toString();
	} catch {
		return rawUrl;
	}
};

const normalizeServerPath = (inputPath) => {
	if (typeof inputPath !== "string" || !inputPath.trim()) {
		return "/";
	}
	const trimmed = inputPath.trim();
	if (trimmed.startsWith("?") || trimmed.startsWith("#")) {
		return `/${trimmed}`;
	}
	if (trimmed.startsWith("/")) {
		return trimmed;
	}
	return `/${trimmed}`;
};

const resolveServerRequestUrl = (baseUrl, path) => {
	const normalizedPath = normalizeServerPath(path);
	try {
		return new URL(normalizedPath, baseUrl).toString();
	} catch {
		return `${String(baseUrl || "").replace(/\/+$/, "")}${normalizedPath}`;
	}
};

const toRenderUrl = (url, port) => {
	try {
		const parsed = new URL(url, self.location?.origin || "http://localhost");
		if (self.location?.origin && parsed.origin === self.location.origin) {
			return `${parsed.pathname}${parsed.search}${parsed.hash}`;
		}
		return parsed.toString();
	} catch {
		return `/__virtual__/${port}/`;
	}
};

const toServerInfo = (serverState) => ({
	kind: serverState.kind,
	port: serverState.port,
	url: serverState.url,
	renderUrl: serverState.renderUrl,
});

const getServerBridge = (containerInstance) => {
	const fromContainer = containerInstance?.serverBridge;
	if (fromContainer && typeof fromContainer.getServerUrl === "function") {
		return fromContainer;
	}
	if (typeof AlmostNodeLib.getServerBridge === "function") {
		return AlmostNodeLib.getServerBridge();
	}
	return null;
};

const ensureServerBridgeReady = async (containerInstance) => {
	const bridge = getServerBridge(containerInstance);
	if (!bridge) return null;
	if (!serverBridgeReady && typeof bridge.initServiceWorker === "function") {
		try {
			await bridge.initServiceWorker();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : safeSerialize(error);
			pushRuntimeLog(
				"warn",
				`Server bridge service worker init failed; continuing without service worker: ${message}`,
			);
		}
		serverBridgeReady = true;
	}
	return bridge;
};

const installExpressLifecycleHooks = async (containerInstance) => {
	await containerInstance.execute(
		`
(() => {
	if (globalThis.__memorallExpressLifecycleInstalled) return;
	globalThis.__memorallExpressLifecycleInstalled = true;
	globalThis.__memorallExpressServers = globalThis.__memorallExpressServers || new Map();

	let express;
	try {
		express = require("express");
	} catch {
		return;
	}

	const appProto = express?.application;
	if (!appProto || appProto.__memorallListenPatched) return;

	const originalListen = appProto.listen;
	appProto.listen = function memorallPatchedListen(...args) {
		const server = originalListen.apply(this, args);

		let port = null;
		if (typeof args[0] === "number") {
			port = args[0];
		} else if (args[0] && typeof args[0] === "object" && typeof args[0].port === "number") {
			port = args[0].port;
		} else if (typeof args[1] === "number") {
			port = args[1];
		}

		if (typeof port === "number" && server) {
			globalThis.__memorallExpressServers.set(port, server);
			if (typeof server.on === "function") {
				server.on("close", () => {
					try {
						globalThis.__memorallExpressServers.delete(port);
					} catch {
						// ignore
					}
				});
			}
		}

		return server;
	};

	appProto.__memorallListenPatched = true;
})();
		`,
		"/__memorall_express_lifecycle_patch.js",
	);
};

const closeTrackedExpressServer = async (containerInstance, port) => {
	const escapedPort = Number(port) || 0;
	const result = await containerInstance.execute(
		`
(async () => {
	const store = globalThis.__memorallExpressServers;
	if (!store || typeof store.get !== "function") return false;
	const server = store.get(${escapedPort});
	if (!server || typeof server.close !== "function") return false;

	await new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			try {
				store.delete(${escapedPort});
			} catch {
				// ignore
			}
			resolve();
		};
		try {
			server.close(() => finish());
		} catch {
			finish();
			return;
		}
		setTimeout(() => finish(), 1500);
	});
	return true;
})()
		`,
		"/__memorall_express_close.js",
	);
	return Boolean(result);
};

const waitForServerPort = async (bridge, port, timeoutMs = 30_000) => {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const ports =
			typeof bridge?.listServerPorts === "function" ? bridge.listServerPorts() : [];
		if (Array.isArray(ports) && ports.includes(port)) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error(`Timed out waiting for server registration on port ${port}`);
};

const hasListeningLogForPort = (port) => {
	const token = `:${port}`;
	for (let i = runtimeLogs.length - 1; i >= 0; i--) {
		const entry = runtimeLogs[i];
		const message = String(entry?.message || "").toLowerCase();
		if (!message.includes(token)) continue;
		if (message.includes("listening") || message.includes("started") || message.includes("ready")) {
			return true;
		}
	}
	return false;
};

const waitForExpressStartup = async (bridge, baseUrl, port, timeoutMs = 3_000) => {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (hasListeningLogForPort(port)) {
			return true;
		}

		if (bridge && typeof bridge.listServerPorts === "function") {
			const ports = bridge.listServerPorts();
			if (Array.isArray(ports) && ports.includes(port)) {
				return true;
			}
		}

		try {
			const response = await fetchWithTimeout(
				baseUrl,
				{ method: "GET" },
				750,
			);
			if (response) {
				return true;
			}
		} catch {
			// Keep polling until grace timeout.
		}

		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return false;
};

const stopServerState = async (port) => {
	const state = servers.get(port);
	if (!state) return;
	try {
		if (typeof state.stop === "function") {
			await state.stop();
		}
	} finally {
		servers.delete(port);
	}
};

const stopAllServers = async () => {
	const ports = Array.from(servers.keys());
	for (const port of ports) {
		await stopServerState(port);
	}
};

const resolveServerBaseUrl = (bridge, port, hostname) => {
	if (bridge && typeof bridge.getServerUrl === "function") {
		const bridged = bridge.getServerUrl(port);
		if (typeof bridged === "string" && bridged) {
			return normalizeClientUrl(bridged);
		}
	}
	return `http://${normalizeClientHostname(hostname)}:${port}`;
};

const withTimeout = async (task, timeoutMs) => {
	const timeoutSymbol = Symbol("timeout");
	const value = await Promise.race([
		task,
		new Promise((resolve) => setTimeout(() => resolve(timeoutSymbol), timeoutMs)),
	]);
	return { timedOut: value === timeoutSymbol, value };
};

const ensureAlmostNodeReady = async () => {
	if (AlmostNodeLib && typeof AlmostNodeLib.__tla?.then === "function") {
		await AlmostNodeLib.__tla;
	}
	if (!AlmostNodeLib || typeof AlmostNodeLib.createContainer !== "function") {
		throw new Error("almostnode runtime bundle not loaded or invalid");
	}
};

const createContainerInstance = async () => {
	await ensureAlmostNodeReady();
	const c = AlmostNodeLib.createContainer({
		cwd: "/",
		onConsole: (level, args) => {
			const message = Array.isArray(args)
				? args.map((arg) => safeSerialize(arg)).join(" ")
				: safeSerialize(args);
			pushRuntimeLog(level, message);
			if (currentExecutionContext) {
				const dropped = appendBounded(
					currentExecutionContext.logs,
					{ level, message, timestamp: Date.now() },
					currentExecutionContext.maxEntries,
				);
				currentExecutionContext.truncated += dropped;
			}
		},
	});
	installDocumentsVfsOverlay(c.vfs);
	return c;
};

const ensureContainer = async () => {
	if (!container) {
		container = await createContainerInstance();
	}
	return container;
};

const executeCode = async (code, timeoutMs, maxLogEntries, filename) => {
	const c = await ensureContainer();
	const startedAt = Date.now();
	const logs = [];
	currentExecutionContext = {
		logs,
		maxEntries: maxLogEntries,
		truncated: 0,
	};

	try {
		const { timedOut, value } = await withTimeout(
			Promise.resolve(c.execute(String(code), filename || "/index.js")),
			timeoutMs,
		);
		const durationMs = Date.now() - startedAt;
		if (timedOut) {
			return {
				status: "timeout",
				durationMs,
				logs,
				truncatedLogs: currentExecutionContext.truncated,
			};
		}

		const resultValue = value && typeof value === "object" && "exports" in value ? value.exports : value;
		return {
			status: "ok",
			durationMs,
			result: safeSerialize(resultValue),
			logs,
			truncatedLogs: currentExecutionContext.truncated,
			filename,
		};
	} catch (error) {
		const durationMs = Date.now() - startedAt;
		return {
			status: "error",
			durationMs,
			error: safeSerialize(error instanceof Error ? error.message : error),
			stack: error instanceof Error ? error.stack : undefined,
			logs,
			truncatedLogs: currentExecutionContext.truncated,
			filename,
		};
	} finally {
		currentExecutionContext = null;
	}
};

const runFile = async (path, timeoutMs, maxLogEntries) => {
	const c = await ensureContainer();
	const normalized = toCanonicalMountedPath(path);
	if (isDocumentsPath(normalized)) {
		throw new Error(`Cannot execute mounted documents path: ${normalized}`);
	}
	if (!c.vfs.existsSync(normalized)) {
		throw new Error(`File not found: ${normalized}`);
	}

	const startedAt = Date.now();
	const logs = [];
	currentExecutionContext = {
		logs,
		maxEntries: maxLogEntries,
		truncated: 0,
	};

	try {
		const { timedOut, value } = await withTimeout(Promise.resolve(c.runFile(normalized)), timeoutMs);
		const durationMs = Date.now() - startedAt;
		if (timedOut) {
			return {
				status: "timeout",
				durationMs,
				logs,
				truncatedLogs: currentExecutionContext.truncated,
				path: normalized,
			};
		}
		const resultValue = value && typeof value === "object" && "exports" in value ? value.exports : value;
		return {
			status: "ok",
			durationMs,
			result: safeSerialize(resultValue),
			logs,
			truncatedLogs: currentExecutionContext.truncated,
			path: normalized,
		};
	} catch (error) {
		const durationMs = Date.now() - startedAt;
		return {
			status: "error",
			durationMs,
			error: safeSerialize(error instanceof Error ? error.message : error),
			stack: error instanceof Error ? error.stack : undefined,
			logs,
			truncatedLogs: currentExecutionContext.truncated,
			path: normalized,
		};
	} finally {
		currentExecutionContext = null;
	}
};

const fetchWithTimeout = async (input, init, timeoutMs) => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(input, {
			...init,
			signal: controller.signal,
			credentials: "omit",
		});
	} finally {
		clearTimeout(timeoutId);
	}
};

const resolveResponseType = (contentType, requestedType) => {
	if (requestedType !== "auto") return requestedType;
	const normalized = String(contentType || "").toLowerCase();
	if (normalized.includes("application/json")) return "json";
	if (normalized.includes("text/html")) return "html";
	return "text";
};

const resetRuntime = async () => {
	await stopAllServers();
	repls.clear();
	container = await createContainerInstance();
	mountedDocumentFiles.clear();
	mountedDocumentDirectories.clear();
	materializedMountedFiles.clear();
	documentsMountLoaded = false;
	mountedWorkspaceFiles.clear();
	mountedWorkspaceDirectories.clear();
	materializedWorkspaceFiles.clear();
	pendingWorkspaceOps.length = 0;
	workspaceMountLoaded = false;
	installedPackages.clear();
	servers.clear();
	serverBridgeReady = false;
	runtimeLogs.length = 0;
	pushRuntimeLog("info", "Sandbox runtime reset");
};

const handleOperation = async (request) => {
	const payload = request.payload;
	const c = await ensureContainer();

	switch (request.operation) {
		case "health":
			return { ready: true, initializedAt };
		case "runtime.executeCode":
			return executeCode(payload.code, payload.timeoutMs ?? DEFAULT_TIMEOUT_MS, payload.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES, payload.filename);
		case "runtime.runFile":
			return runFile(payload.path, payload.timeoutMs ?? DEFAULT_TIMEOUT_MS, payload.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES);
		case "runtime.createRepl": {
			const replId = crypto.randomUUID();
			repls.set(replId, c.createREPL());
			return { replId };
		}
		case "runtime.replEval": {
			const repl = repls.get(payload.replId);
			if (!repl) throw new Error(`REPL not found: ${payload.replId}`);
			const startedAt = Date.now();
			const { timedOut, value } = await withTimeout(Promise.resolve(repl.eval(String(payload.code))), payload.timeoutMs ?? DEFAULT_TIMEOUT_MS);
			if (timedOut) {
				return {
					status: "timeout",
					durationMs: Date.now() - startedAt,
					logs: [],
					truncatedLogs: 0,
				};
			}
			return {
				status: "ok",
				durationMs: Date.now() - startedAt,
				result: safeSerialize(value),
				logs: [],
				truncatedLogs: 0,
			};
		}
		case "runtime.getLogs": {
			const limit = Math.max(1, Math.min(payload?.limit ?? 100, MAX_RUNTIME_LOG_ENTRIES));
			const filtered = payload?.level ? runtimeLogs.filter((entry) => entry.level === payload.level) : runtimeLogs;
			return { logs: filtered.slice(-limit) };
		}
		case "runtime.clearLogs":
			runtimeLogs.length = 0;
			return { cleared: true };
		case "network.fetch": {
			const timeoutMs = payload.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
			const url = normalizeClientUrl(payload.url);
			const response = await fetchWithTimeout(
				url,
				{ method: payload.method ?? "GET", headers: payload.headers, body: payload.body },
				timeoutMs,
			);
			const contentType = response.headers.get("content-type") ?? "";
			const responseType = resolveResponseType(contentType, payload.responseType ?? "auto");
			const text = await response.text();
			const body = responseType === "json" ? JSON.stringify(JSON.parse(text), null, 2) : text;
			return { url, status: response.status, ok: response.ok, contentType, responseType, body };
		}
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
			if (isDocumentsPath(p) && !documentsMountLoaded) {
				return { path: p, exists: false };
			}
			if (isWorkspacePath(p) && !workspaceMountLoaded) {
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
			documentsMountLoaded = true;

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
			workspaceMountLoaded = true;

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
		case "npm.install": {
			const installed = await c.npm.install(payload.packageSpec, { save: payload.save, saveDev: payload.saveDev });
			if (installed && typeof installed === "object") {
				for (const [name, version] of Object.entries(installed)) {
					installedPackages.set(name, String(version));
				}
			}
			return { success: true, installed };
		}
		case "npm.installFromPackageJson": {
			const installed = await c.npm.installFromPackageJson({ save: payload.save, saveDev: payload.saveDev });
			if (installed && typeof installed === "object") {
				for (const [name, version] of Object.entries(installed)) {
					installedPackages.set(name, String(version));
				}
			}
			return { success: true, installed };
		}
		case "npm.list": {
			const list = typeof c.npm.listInstalled === "function" ? await c.npm.listInstalled() : Object.fromEntries(installedPackages);
			return { packages: list };
		}
		case "server.start": {
			const bindHostname = payload.hostname || "127.0.0.1";
			const kind = payload.kind;
			const port = payload.port;

			await stopServerState(port);

			const bridge = await ensureServerBridgeReady(c);
			let stop = async () => {
				if (bridge && typeof bridge.unregisterServer === "function") {
					bridge.unregisterServer(port);
				}
			};

			if (kind === "express") {
				await installExpressLifecycleHooks(c);
				await closeTrackedExpressServer(c, port);
				const entryPath = normalizePath(payload.entryPath || "/server.js");
				await c.runFile(entryPath);
				const probeUrl = `http://${normalizeClientHostname(bindHostname)}:${port}/`;
				const started = await waitForExpressStartup(bridge, probeUrl, port, 3_000);
				if (!started) {
					pushRuntimeLog(
						"warn",
						`Express startup probe did not confirm readiness for port ${port}; continuing with optimistic server state`,
					);
				}
				stop = async () => {
					await closeTrackedExpressServer(c, port);
					if (bridge && typeof bridge.unregisterServer === "function") {
						bridge.unregisterServer(port);
					}
				};
			} else if (kind === "vite") {
				if (typeof AlmostNodeLib.ViteDevServer !== "function") {
					throw new Error("ViteDevServer is not available in runtime bundle");
				}
				const viteServer = new AlmostNodeLib.ViteDevServer(c.runtime, c.vfs, {
					port,
					hostname: bindHostname,
					rootDir: payload.rootDir || "/",
				});
				await viteServer.start();
				stop = async () => {
					await viteServer.stop();
					if (bridge && typeof bridge.unregisterServer === "function") {
						bridge.unregisterServer(port);
					}
				};
			} else if (kind === "next") {
				if (typeof AlmostNodeLib.NextDevServer !== "function") {
					throw new Error("NextDevServer is not available in runtime bundle");
				}
				const nextServer = new AlmostNodeLib.NextDevServer(c.runtime, c.vfs, {
					port,
					hostname: bindHostname,
					rootDir: payload.rootDir || "/",
				});
				await nextServer.start();
				stop = async () => {
					await nextServer.stop();
					if (bridge && typeof bridge.unregisterServer === "function") {
						bridge.unregisterServer(port);
					}
				};
			} else {
				throw new Error(`Unsupported server kind: ${kind}`);
			}

			const url = resolveServerBaseUrl(bridge, port, bindHostname);
			const renderUrl = toRenderUrl(url, port);
			const state = { kind, port, url, renderUrl, stop };
			servers.set(port, state);
			return toServerInfo(state);
		}
		case "server.stop":
			await stopServerState(payload.port);
			return { port: payload.port };
		case "server.list":
			return { servers: Array.from(servers.values()).map(toServerInfo) };
		case "server.renderUrl": {
			const server = servers.get(payload.port);
			if (!server) {
				throw new Error(`Server not found on port ${payload.port}`);
			}
			const url = resolveServerRequestUrl(server.renderUrl, payload.path || "/");
			return { port: payload.port, url };
		}
		case "server.request": {
			const server = servers.get(payload.port);
			if (!server) {
				throw new Error(`Server not found on port ${payload.port}`);
			}
			const timeoutMs = payload.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
			const url = resolveServerRequestUrl(server.url, payload.path || "/");
			const response = await fetchWithTimeout(
				url,
				{
					method: payload.method ?? "GET",
					headers: payload.headers,
					body: payload.body,
				},
				timeoutMs,
			);
			const contentType = response.headers.get("content-type") ?? "";
			const responseType = resolveResponseType(contentType, payload.responseType ?? "auto");
			const text = await response.text();
			const headers = Object.fromEntries(response.headers.entries());
			const body = responseType === "json" ? JSON.stringify(JSON.parse(text), null, 2) : text;
			return {
				port: payload.port,
				url,
				status: response.status,
				ok: response.ok,
				contentType,
				responseType,
				headers,
				body,
			};
		}
		case "snapshot.get": {
			const snapshot = typeof c.vfs.toSnapshot === "function" ? c.vfs.toSnapshot() : { files: [] };
			return {
				snapshot: {
					...snapshot,
					servers: Array.from(servers.values()).map(toServerInfo),
					installedPackages: Object.fromEntries(installedPackages),
				},
			};
		}
		case "snapshot.restore":
			await resetRuntime();
			return { restored: true };
		case "runtime.reset":
			await resetRuntime();
			return { reset: true };
		default:
			throw new Error(`Unsupported sandbox operation: ${request.operation}`);
	}
};

const isObject = (value) => typeof value === "object" && value !== null;

const isSandboxRequest = (value) => {
	if (!isObject(value)) return false;
	return (
		value.channel === SANDBOX_CHANNEL &&
		value.direction === "request" &&
		typeof value.requestId === "string" &&
		typeof value.operation === "string"
	);
};

const sendSuccess = (request, result) => {
	parent.postMessage({
		channel: SANDBOX_CHANNEL,
		direction: "response",
		requestId: request.requestId,
		operation: request.operation,
		ok: true,
		result,
	}, "*");
};

const sendError = (request, error) => {
	parent.postMessage({
		channel: SANDBOX_CHANNEL,
		direction: "response",
		requestId: request.requestId,
		operation: request.operation,
		ok: false,
		error: toError(error),
	}, "*");
};

window.addEventListener("message", (event) => {
	if (!isSandboxRequest(event.data)) return;
	const request = event.data;
	void (async () => {
		try {
			const result = await handleOperation(request);
			sendSuccess(request, result);
		} catch (error) {
			sendError(request, error);
		}
	})();
});
