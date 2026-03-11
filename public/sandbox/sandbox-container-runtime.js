import * as AlmostNodeLib from "./vendors/almostnode.bundle.js";
import {
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
	installDocumentsVfsOverlay,
} from "./sandbox-vfs.js";
import { FRAMEWORK_TEMPLATES, TEMPLATE_INSTALL_SPECS } from "./sandbox-templates.js";
import { handleFsOperation } from "./sandbox-fs-handlers.js";

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

const normalizeClientUrl = (rawUrl) => {
	try {
		return new URL(rawUrl).toString();
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

const toServerInfo = (serverState) => ({
	kind: serverState.kind,
	port: serverState.port,
	url: serverState.url,
	renderUrl: serverState.renderUrl,
	rootDir: serverState.rootDir,
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
	// The SW is registered by the outer page (sandbox-container-service.iframe.ts)
	// because manifest sandbox pages cannot register service workers themselves.
	// This function just resolves the bridge without touching the SW.
	const bridge = getServerBridge(containerInstance);
	console.log(`[bridge] getServerBridge result: ${bridge ? "present" : "null"}, keys=${bridge ? Object.keys(bridge).join(",") : "n/a"}`);
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

const waitForExpressStartup = async (bridge, port, timeoutMs = 3_000) => {
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

const resolveServerBaseUrl = (bridge, port) => {
	if (bridge && typeof bridge.getServerUrl === "function") {
		const bridged = bridge.getServerUrl(port);
		if (typeof bridged === "string" && bridged) {
			return normalizeClientUrl(bridged);
		}
	}
	// Fallback: virtual path via AlmostNode service worker. No real TCP socket exists.
	const sandboxBase = new URL(".", self.location.href).href;
	return new URL(`__virtual__/${port}/`, sandboxBase).toString();
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
	const createdFiles = [];
	for (const [relPath, content] of Object.entries(files)) {
		// Strip leading slash from relPath so it's always joined relative to root.
		const rel = relPath.startsWith("/") ? relPath.slice(1) : relPath;
		const fullPath = normalizePath(`${root}/${rel}`);
		try {
			if (c.vfs.existsSync(fullPath)) continue;
		} catch (error) {
			console.error(`[CHECK_FILE_EXIST] Error`, error)
			// existsSync not available — proceed with write
		}
		const parentDir = dirname(fullPath);
		try {
			c.vfs.mkdirSync(parentDir, { recursive: true });
		} catch (error) {
			console.error(`[MKDIR] Error`, error)
			// Already exists or not needed
		}
		c.vfs.writeFileSync(fullPath, content);
		createdFiles.push(fullPath);
	}
	pushRuntimeLog("info", `Scaffolded template "${templateName}" into ${root}: ${createdFiles.length} files`);
	return createdFiles;
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
	runtimeLogs.length = 0;
	pushRuntimeLog("info", "Sandbox runtime reset");
};


// ---------------------------------------------------------------------------
// Operation handler
// ---------------------------------------------------------------------------

const handleOperation = async (request) => {
	const payload = request.payload;

	// Respond to health immediately — before container init — so the
	// 10 s health-check timeout in the host service does not fire while
	// AlmostNode is still booting up.
	if (request.operation === "health") {
		return { ready: true, initializedAt };
	}

	const c = await ensureContainer();

	switch (request.operation) {
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
			const bindHostname = payload.hostname;
			const port = payload.port;
			const resolvedRootDir = normalizePath(payload.rootDir || "/workspaces/app");

			// Check whether the folder already has files so we only scaffold into empty dirs.
			let folderIsEmpty = true;
			try {
				const entries = c.vfs.readdirSync(resolvedRootDir);
				folderIsEmpty = !entries || entries.length === 0;
			} catch {
				folderIsEmpty = true;
			}

			// Scaffold template only when folder is empty.
			let createdFiles = [];
			if (folderIsEmpty && payload.template) {
				createdFiles = scaffoldTemplate(c, payload.template, resolvedRootDir);
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

			// Auto-detect server kind from config files when not explicitly given (or "auto").
			let kind = payload.kind === "auto" ? undefined : payload.kind;
			if (!kind) {
				const hasFile = (name) => {
					try {
						return c.vfs.existsSync(normalizePath(`${resolvedRootDir}/${name}`));
					} catch {
						return false;
					}
				};
				if (hasFile("next.config.js") || hasFile("next.config.ts") || hasFile("next.config.mjs")) {
					kind = "next";
				} else if (hasFile("vite.config.js") || hasFile("vite.config.ts") || hasFile("vite.config.mjs")) {
					kind = "vite";
				} else {
					kind = "express";
				}
				pushRuntimeLog("info", `Auto-detected server kind: ${kind} for ${resolvedRootDir}`);
			}

			await stopServerState(port);

			const bridge = await ensureServerBridgeReady(c);
			let stop = async () => {
				if (bridge && typeof bridge.unregisterServer === "function") {
					bridge.unregisterServer(port);
				}
			};

			let handleRequest = null;

			if (kind === "vite") {
				if (typeof AlmostNodeLib.ViteDevServer !== "function") {
					throw new Error("ViteDevServer is not available in runtime bundle");
				}
				const viteServer = new AlmostNodeLib.ViteDevServer(c.vfs, {
					port,
					hostname: bindHostname,
					root: resolvedRootDir,
				});
				await viteServer.start();
				handleRequest = (method, path, headers, body) => viteServer.handleRequest(method, path, headers, body);
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
				const nextServer = new AlmostNodeLib.NextDevServer(c.vfs, {
					port,
					hostname: bindHostname,
					root: resolvedRootDir,
				});
				await nextServer.start();
				handleRequest = (method, path, headers, body) => nextServer.handleRequest(method, path, headers, body);
				stop = async () => {
					await nextServer.stop();
					if (bridge && typeof bridge.unregisterServer === "function") {
						bridge.unregisterServer(port);
					}
				};
			} else {
				// express — entryPath is the server entry file inside rootDir
				const entryPath = normalizePath(payload.entryPath || `${resolvedRootDir}/server.js`);
				await c.runFile(entryPath);
				const started = await waitForExpressStartup(bridge, port, 3_000);
				if (!started) {
					pushRuntimeLog(
						"warn",
						`Express startup probe did not confirm readiness for port ${port}; continuing with optimistic server state`,
					);
				}
				handleRequest = (method, path, headers, body) => bridge.handleRequest(port, method, path, headers, body);
				stop = async () => {
					await closeTrackedExpressServer(c, port);
					if (bridge && typeof bridge.unregisterServer === "function") {
						bridge.unregisterServer(port);
					}
				};
			}

			const url = resolveServerBaseUrl(bridge, port);
			const state = { kind, port, url, renderUrl: url, stop, handleRequest, rootDir: resolvedRootDir };
			servers.set(port, state);
			return { ...toServerInfo(state), createdFiles };
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
			const url = server.url.replace(/\/?$/, "") + normalizeServerPath(payload.path || "/");
			return { port: payload.port, url };
		}
		case "server.request": {
			const server = servers.get(payload.port);
			if (!server) {
				throw new Error(`Server not found on port ${payload.port}`);
			}
			if (typeof server.handleRequest !== "function") {
				throw new Error(`No request handler for server on port ${payload.port}`);
			}
			const path = normalizeServerPath(payload.path || "/");
			const url = server.url.replace(/\/?$/, "") + path;
			const bodyBuf = payload.body ? new TextEncoder().encode(payload.body).buffer : null;
			const responseData = await server.handleRequest(
				payload.method ?? "GET",
				path,
				payload.headers ?? {},
				bodyBuf,
			);
			const contentType = responseData.headers?.["content-type"] ?? responseData.headers?.["Content-Type"] ?? "";
			const responseType = resolveResponseType(contentType, payload.responseType ?? "auto");
			const bodyText = responseData.body ? new TextDecoder().decode(responseData.body) : "";
			const body = responseType === "json" ? JSON.stringify(JSON.parse(bodyText), null, 2) : bodyText;
			return {
				port: payload.port,
				url,
				status: responseData.statusCode ?? 200,
				ok: (responseData.statusCode ?? 200) < 400,
				contentType,
				responseType,
				headers: responseData.headers ?? {},
				body,
			};
		}
		case "server.handleSwRequest": {
		// The SW (registered in the outer offscreen page) intercepts /__virtual__/<port>/* fetches
		// and relays them here. We serve them directly via the server's handleRequest closure,
		// then base64-encode the body for transport back to the SW.
		const { id, port: swPort, method, path, headers: reqHeaders, body } = payload;
		console.log(`[server.handleSwRequest] id=${id} port=${swPort} method=${method} path=${path}`);
		const server = servers.get(swPort);
		if (!server) {
			throw new Error(`Server not found on port ${swPort}`);
		}
		if (typeof server.handleRequest !== "function") {
			throw new Error(`No request handler for server on port ${swPort}`);
		}
		const normalizedPath = normalizeServerPath(path || "/");
		const responseData = await server.handleRequest(method ?? "GET", normalizedPath, reqHeaders ?? {}, body ?? null);

		console.log(`[server.handleSwRequest] handleRequest ${normalizedPath}`, responseData)
		// Detailed responseData diagnostics
		{
			const bd = responseData.body;
			const bdType = typeof bd;
			const isAB = bd instanceof ArrayBuffer;
			const isView = ArrayBuffer.isView(bd);
			const isStr = bdType === "string";
			const byteLen = isAB ? bd.byteLength : isView ? bd.byteLength : isStr ? bd.length : (bd == null ? 0 : -1);
			let preview = "";
			try {
				if (isStr) preview = bd.slice(0, 300);
				else if (isAB) preview = new TextDecoder().decode(bd).slice(0, 300);
				else if (isView) preview = new TextDecoder().decode(bd).slice(0, 300);
			} catch (_) {}
			console.log(`[server.handleSwRequest] responseData statusCode=${responseData.statusCode} body typeof=${bdType} isArrayBuffer=${isAB} isView=${isView} isString=${isStr} byteLen=${byteLen}`, preview ? `body preview: ${preview}` : "(no preview)");
		}
		// Log error responses so Vite/Next/Express errors are visible in devtools.
		if ((responseData.statusCode ?? 200) >= 400) {
			let errorBody = "";
			try {
				if (responseData.body) {
					const raw = responseData.body instanceof ArrayBuffer
						? responseData.body
						: ArrayBuffer.isView(responseData.body)
							? responseData.body.buffer
							: null;
					if (raw) errorBody = new TextDecoder().decode(raw).slice(0, 2000);
					else if (typeof responseData.body === "string") errorBody = responseData.body.slice(0, 2000);
				}
			} catch (_) {}
			console.error(`[server.handleSwRequest] ${method} ${normalizedPath} → ${responseData.statusCode} ${responseData.statusMessage ?? ""}`, errorBody || "(no body)");
			pushRuntimeLog("error", `Server error: ${method} ${normalizedPath} → ${responseData.statusCode}: ${errorBody.slice(0, 500) || "(no body)"}`);
		}
		// Base64-encode body for SW transport
		const rawBody = responseData.body;
		let bodyBytes;
		if (!rawBody) {
			bodyBytes = new Uint8Array(0);
		} else if (rawBody instanceof ArrayBuffer) {
			bodyBytes = new Uint8Array(rawBody);
		} else if (ArrayBuffer.isView(rawBody)) {
			bodyBytes = new Uint8Array(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength);
		} else if (typeof rawBody === "string") {
			bodyBytes = new TextEncoder().encode(rawBody);
		} else {
			console.warn("[server.handleSwRequest] unknown body type, body will be empty:", typeof rawBody, rawBody);
			bodyBytes = new Uint8Array(0);
		}
		let bodyBase64 = "";
		if (bodyBytes.length > 0) {
			const chunkSize = 8192;
			let binary = "";
			for (let i = 0; i < bodyBytes.length; i += chunkSize) {
				binary += String.fromCharCode(...bodyBytes.subarray(i, Math.min(i + chunkSize, bodyBytes.length)));
			}
			bodyBase64 = btoa(binary);
		}
		return {
			statusCode: responseData.statusCode ?? 200,
			statusMessage: responseData.statusMessage ?? "OK",
			headers: responseData.headers ?? {},
			bodyBase64,
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
			if (request.operation.startsWith("fs.")) {
				return handleFsOperation(request.operation, payload, c);
			}
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
