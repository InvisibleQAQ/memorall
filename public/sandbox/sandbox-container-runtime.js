import * as AlmostNodeLib from "./vendors/almostnode.bundle.js";
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
	installDocumentsVfsOverlay,
} from "./sandbox-vfs.js";
import { FRAMEWORK_TEMPLATES, TEMPLATE_INSTALL_SPECS } from "./sandbox-templates.js";

const SANDBOX_CHANNEL = "memorall-sandbox-container";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_LOG_ENTRIES = 20;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const MAX_RUNTIME_LOG_ENTRIES = 500;

const initializedAt = Date.now();
const runtimeLogs = [];
const repls = new Map();
const installedPackages = new Map();
const servers = new Map();
let serverBridgeReady = false;

let container = null;
let currentExecutionContext = null;

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
		// Resolve fallback relative to the sandbox document root so the service
		// worker scope (chrome-extension://[id]/sandbox/) is always correct.
		const sandboxBase = self.location
			? new URL(".", self.location.href).pathname
			: "/sandbox/";
		return `${sandboxBase}__virtual__/${port}/`;
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

/**
 * Write template files into the VFS for the given rootDir.
 * Skips files that already exist so re-runs are safe.
 */
const scaffoldTemplate = (c, templateName, rootDir) => {
	const files = FRAMEWORK_TEMPLATES[templateName];
	if (!files) {
		throw new Error(`Unknown template: ${templateName}`);
	}
	const root = normalizePath(rootDir || "/");

	// vfs.writeFileSync / mkdirSync on /workspaces/ paths require the workspace
	// mount to be marked as loaded.  If the caller hasn't synced from the DB
	// yet we bootstrap an empty mount so template writes are permitted.
	if (isWorkspacePath(root) && !vfsBoolState.workspaceMountLoaded) {
		vfsBoolState.workspaceMountLoaded = true;
		mountedWorkspaceDirectories.add(WORKSPACES_MOUNT_ROOT);
	}
	for (const [relPath, content] of Object.entries(files)) {
		const fullPath = normalizePath(`${root}/${relPath}`);
		try {
			if (c.vfs.existsSync(fullPath)) continue;
		} catch {
			// existsSync not available — proceed with write
		}
		const parentDir = dirname(fullPath);
		try {
			c.vfs.mkdirSync(parentDir, { recursive: true });
		} catch {
			// Already exists or not needed
		}
		c.vfs.writeFileSync(fullPath, content);
	}
	pushRuntimeLog("info", `Scaffolded template "${templateName}" into ${root}`);
};

// ---------------------------------------------------------------------------
// Runtime helpers
// ---------------------------------------------------------------------------

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
	vfsBoolState.documentsMountLoaded = false;
	mountedWorkspaceFiles.clear();
	mountedWorkspaceDirectories.clear();
	materializedWorkspaceFiles.clear();
	pendingWorkspaceOps.length = 0;
	vfsBoolState.workspaceMountLoaded = false;
	installedPackages.clear();
	servers.clear();
	serverBridgeReady = false;
	runtimeLogs.length = 0;
	pushRuntimeLog("info", "Sandbox runtime reset");
};

// ---------------------------------------------------------------------------
// Operation handler
// ---------------------------------------------------------------------------

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

			if (payload.template) {
				scaffoldTemplate(c, payload.template, payload.rootDir || "/");
				if (payload.autoInstall !== false) {
					const pkgList = TEMPLATE_INSTALL_SPECS[payload.template];
					if (Array.isArray(pkgList)) {
						for (const pkg of pkgList) {
							const installed = await c.npm.install(pkg, {});
							if (installed && typeof installed === "object") {
								for (const [name, version] of Object.entries(installed)) {
									installedPackages.set(name, String(version));
								}
							}
						}
					}
				}
			}

			await stopServerState(port);

			const bridge = await ensureServerBridgeReady(c);
			let stop = async () => {
				if (bridge && typeof bridge.unregisterServer === "function") {
					bridge.unregisterServer(port);
				}
			};

			if (kind === "express") {
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
			const localBase = `http://127.0.0.1:${server.port}`;
			const url = resolveServerRequestUrl(localBase, payload.path || "/");
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

// ---------------------------------------------------------------------------
// Message bus
// ---------------------------------------------------------------------------

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
