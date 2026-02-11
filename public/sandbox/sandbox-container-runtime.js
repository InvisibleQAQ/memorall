import * as AlmostNodeLib from "./vendors/almostnode.bundle.js";

const SANDBOX_CHANNEL = "memorall-sandbox-container";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_LOG_ENTRIES = 20;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const MAX_RUNTIME_LOG_ENTRIES = 500;
const DOCUMENTS_MOUNT_ROOT = "/documents";

const initializedAt = Date.now();
const runtimeLogs = [];
const repls = new Map();
const mountedDocumentFiles = new Set();
const mountedDocumentDirectories = new Set();
const materializedMountedFiles = new Map();
let documentsMountLoaded = false;
const installedPackages = new Map();
const servers = new Map();

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

const isDocumentsPath = (path) => path === DOCUMENTS_MOUNT_ROOT || path.startsWith(`${DOCUMENTS_MOUNT_ROOT}/`);
const assertDocumentsMountLoaded = () => {
	if (!documentsMountLoaded) {
		throw new Error("Documents mount is not loaded in sandbox runtime");
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

const listMountedDir = (path) => {
	const normalized = normalizePath(path);
	const prefix = normalized === "/" ? "/" : `${normalized}/`;
	const entries = new Set();

	for (const dir of mountedDocumentDirectories) {
		if (!dir.startsWith(prefix) || dir === normalized) continue;
		const rest = dir.slice(prefix.length);
		if (!rest || rest.includes("/")) continue;
		entries.add(rest);
	}

	for (const filePath of mountedDocumentFiles) {
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
	};

	vfs.readdirSync = (inputPath, ...rest) => {
		const path = normalizePath(String(inputPath));
		if (isDocumentsPath(path)) {
			assertDocumentsMountLoaded();
			if (!mountedDocumentDirectories.has(path)) {
				throw createFsError("ENOENT", "scandir", path);
			}
			return listMountedDir(path);
		}
		if (!original.readdirSync) {
			throw new Error("vfs.readdirSync is not available");
		}
		return original.readdirSync(inputPath, ...rest);
	};

	vfs.existsSync = (inputPath, ...rest) => {
		const path = normalizePath(String(inputPath));
		if (isDocumentsPath(path)) {
			if (!documentsMountLoaded) return false;
			return mountedDocumentFiles.has(path) || mountedDocumentDirectories.has(path);
		}
		if (!original.existsSync) return false;
		return original.existsSync(inputPath, ...rest);
	};

	vfs.readFileSync = (inputPath, encoding, ...rest) => {
		const path = normalizePath(String(inputPath));
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
		if (!original.readFileSync) {
			throw new Error("vfs.readFileSync is not available");
		}
		return original.readFileSync(inputPath, encoding, ...rest);
	};

	const statLike = (inputPath, ...rest) => {
		const path = normalizePath(String(inputPath));
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
		if (!original.statSync) {
			throw new Error("vfs.statSync is not available");
		}
		return original.statSync(inputPath, ...rest);
	};
	vfs.statSync = statLike;
	vfs.lstatSync = (...args) => statLike(...args);

	vfs.accessSync = (inputPath, ...rest) => {
		const path = normalizePath(String(inputPath));
		if (isDocumentsPath(path)) {
			assertDocumentsMountLoaded();
			if (!mountedDocumentFiles.has(path) && !mountedDocumentDirectories.has(path)) {
				throw createFsError("ENOENT", "access", path);
			}
			return;
		}
		if (original.accessSync) {
			return original.accessSync(inputPath, ...rest);
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
	const normalized = normalizePath(path);
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
	repls.clear();
	container = await createContainerInstance();
	mountedDocumentFiles.clear();
	mountedDocumentDirectories.clear();
	materializedMountedFiles.clear();
	documentsMountLoaded = false;
	installedPackages.clear();
	servers.clear();
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
			const p = normalizePath(payload.path);
			if (isDocumentsPath(p)) throw new Error(`Path is read-only: ${p}`);
			c.vfs.writeFileSync(p, payload.content);
			return { path: p };
		}
		case "fs.readFile": {
			const p = normalizePath(payload.path);
			if (mountedDocumentFiles.has(p)) {
				if (!materializedMountedFiles.has(p)) {
					throw new Error(`Mounted file is not materialized in sandbox runtime: ${p}`);
				}
				return { path: p, content: materializedMountedFiles.get(p) || "" };
			}
			if (isDocumentsPath(p)) {
				assertDocumentsMountLoaded();
			}
			if (!c.vfs.existsSync(p)) throw new Error(`File not found: ${p}`);
			return { path: p, content: c.vfs.readFileSync(p, "utf8") };
		}
		case "fs.mkdir": {
			const p = normalizePath(payload.path);
			if (isDocumentsPath(p)) throw new Error(`Path is read-only: ${p}`);
			c.vfs.mkdirSync(p, { recursive: payload.recursive !== false });
			return { path: p };
		}
		case "fs.readdir": {
			const p = normalizePath(payload.path);
			if (isDocumentsPath(p)) {
				assertDocumentsMountLoaded();
				if (!mountedDocumentDirectories.has(p)) throw new Error(`Directory not found: ${p}`);
				return { path: p, entries: listMountedDir(p) };
			}
			return { path: p, entries: c.vfs.readdirSync(p) };
		}
		case "fs.unlink": {
			const p = normalizePath(payload.path);
			if (isDocumentsPath(p)) throw new Error(`Path is read-only: ${p}`);
			c.vfs.unlinkSync(p);
			return { path: p };
		}
		case "fs.rename": {
			const oldPath = normalizePath(payload.oldPath);
			const newPath = normalizePath(payload.newPath);
			if (isDocumentsPath(oldPath) || isDocumentsPath(newPath)) {
				throw new Error(`Mounted documents path is read-only: ${oldPath} -> ${newPath}`);
			}
			c.vfs.renameSync(oldPath, newPath);
			return { oldPath, newPath };
		}
		case "fs.exists": {
			const p = normalizePath(payload.path);
			if (isDocumentsPath(p) && !documentsMountLoaded) {
				return { path: p, exists: false };
			}
			return {
				path: p,
				exists: c.vfs.existsSync(p) || mountedDocumentFiles.has(p) || mountedDocumentDirectories.has(p),
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
		case "fs.materializeDocumentFile": {
			const p = normalizePath(payload.path);
			if (!mountedDocumentFiles.has(p)) throw new Error(`Mounted file not found: ${p}`);
			materializedMountedFiles.set(p, payload.content);
			return { path: p, materialized: true };
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
			const url = `http://${normalizeClientHostname(bindHostname)}:${payload.port}`;
			servers.set(payload.port, { kind: payload.kind, port: payload.port, url });
			return { kind: payload.kind, port: payload.port, url };
		}
		case "server.stop":
			servers.delete(payload.port);
			return { port: payload.port };
		case "server.list":
			return { servers: Array.from(servers.values()) };
		case "snapshot.get": {
			const snapshot = typeof c.vfs.toSnapshot === "function" ? c.vfs.toSnapshot() : { files: [] };
			return {
				snapshot: {
					...snapshot,
					servers: Array.from(servers.values()),
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
