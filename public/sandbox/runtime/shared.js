import * as AlmostNodeLib from "../vendors/almostnode.bundle.js";
import {
	vfsBoolState,
	mountedDocumentFiles,
	mountedDocumentDirectories,
	materializedMountedFiles,
	mountedWorkspaceFiles,
	mountedWorkspaceDirectories,
	materializedWorkspaceFiles,
	pendingWorkspaceOps,
	toCanonicalMountedPath,
	isDocumentsPath,
	installDocumentsVfsOverlay,
} from "../core/sandbox-vfs.js";

export const SANDBOX_CHANNEL = "memorall-sandbox-container";
export const DEFAULT_TIMEOUT_MS = 5000;
export const DEFAULT_MAX_LOG_ENTRIES = 20;
export const DEFAULT_FETCH_TIMEOUT_MS = 15000;
export const MAX_RUNTIME_LOG_ENTRIES = 500;

export const runtimeState = {
	initializedAt: Date.now(),
	runtimeLogs: [],
	repls: new Map(),
	installedPackages: new Map(),
	servers: new Map(),
	container: null,
	currentExecutionContext: null,
};

export const safeSerialize = (value) => {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
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

export const toError = (error) => {
	if (error instanceof Error) {
		return { message: error.message, stack: error.stack };
	}
	return { message: safeSerialize(error) };
};

export const appendBounded = (list, value, limit) => {
	if (list.length < limit) {
		list.push(value);
		return 0;
	}
	list.shift();
	list.push(value);
	return 1;
};

export const pushRuntimeLog = (level, message) => {
	appendBounded(
		runtimeState.runtimeLogs,
		{ level, message, timestamp: Date.now() },
		MAX_RUNTIME_LOG_ENTRIES,
	);
};

export const rememberInstalledPackages = (installed) => {
	if (!installed || typeof installed !== "object") return;
	for (const [name, version] of Object.entries(installed)) {
		runtimeState.installedPackages.set(name, String(version));
	}
};

export const normalizeClientUrl = (rawUrl) => {
	try {
		return new URL(rawUrl).toString();
	} catch {
		return rawUrl;
	}
};

export const normalizeServerPath = (inputPath) => {
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

export const toServerInfo = (serverState) => ({
	kind: serverState.kind,
	port: serverState.port,
	url: serverState.url,
	renderUrl: serverState.renderUrl,
	rootDir: serverState.rootDir,
});

export const getServerBridge = (containerInstance) => {
	const fromContainer = containerInstance?.serverBridge;
	if (fromContainer && typeof fromContainer.getServerUrl === "function") {
		return fromContainer;
	}
	if (typeof AlmostNodeLib.getServerBridge === "function") {
		return AlmostNodeLib.getServerBridge();
	}
	return null;
};

export const ensureServerBridgeReady = async (containerInstance) => {
	const bridge = getServerBridge(containerInstance);
	console.log(
		`[bridge] getServerBridge result: ${bridge ? "present" : "null"}, keys=${bridge ? Object.keys(bridge).join(",") : "n/a"}`,
	);
	return bridge;
};

export const hasListeningLogForPort = (port) => {
	const token = `:${port}`;
	for (let i = runtimeState.runtimeLogs.length - 1; i >= 0; i--) {
		const entry = runtimeState.runtimeLogs[i];
		const message = String(entry?.message || "").toLowerCase();
		if (!message.includes(token)) continue;
		if (
			message.includes("listening") ||
			message.includes("started") ||
			message.includes("ready")
		) {
			return true;
		}
	}
	return false;
};

export const waitForExpressStartup = async (
	bridge,
	port,
	timeoutMs = 3_000,
) => {
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

export const stopServerState = async (port) => {
	const state = runtimeState.servers.get(port);
	if (!state) return;
	try {
		if (typeof state.stop === "function") {
			await state.stop();
		}
	} finally {
		runtimeState.servers.delete(port);
	}
};

export const stopAllServers = async () => {
	const ports = Array.from(runtimeState.servers.keys());
	for (const port of ports) {
		await stopServerState(port);
	}
};

export const resolveServerBaseUrl = (bridge, port) => {
	if (bridge && typeof bridge.getServerUrl === "function") {
		const bridged = bridge.getServerUrl(port);
		if (typeof bridged === "string" && bridged) {
			return normalizeClientUrl(bridged);
		}
	}
	const sandboxBase = new URL(".", self.location.href).href;
	return new URL(`__virtual__/${port}/`, sandboxBase).toString();
};

export const withTimeout = async (task, timeoutMs) => {
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

export const createContainerInstance = async () => {
	await ensureAlmostNodeReady();
	const containerInstance = AlmostNodeLib.createContainer({
		cwd: "/",
		onConsole: (level, args) => {
			const message = Array.isArray(args)
				? args.map((arg) => safeSerialize(arg)).join(" ")
				: safeSerialize(args);
			pushRuntimeLog(level, message);
			if (runtimeState.currentExecutionContext) {
				const dropped = appendBounded(
					runtimeState.currentExecutionContext.logs,
					{ level, message, timestamp: Date.now() },
					runtimeState.currentExecutionContext.maxEntries,
				);
				runtimeState.currentExecutionContext.truncated += dropped;
			}
		},
	});
	installDocumentsVfsOverlay(containerInstance.vfs);
	return containerInstance;
};

export const ensureContainer = async () => {
	if (!runtimeState.container) {
		runtimeState.container = await createContainerInstance();
	}
	return runtimeState.container;
};

const beginExecutionCapture = (maxLogEntries) => {
	const logs = [];
	runtimeState.currentExecutionContext = {
		logs,
		maxEntries: maxLogEntries,
		truncated: 0,
	};
	return logs;
};

const currentTruncatedLogCount = () =>
	runtimeState.currentExecutionContext?.truncated ?? 0;

const unwrapExecutionValue = (value) =>
	value && typeof value === "object" && "exports" in value ? value.exports : value;

const runTimedExecution = async ({
	task,
	timeoutMs,
	maxLogEntries,
	successMeta = {},
	timeoutMeta = {},
	errorMeta = {},
}) => {
	const startedAt = Date.now();
	const logs = beginExecutionCapture(maxLogEntries);
	try {
		const { timedOut, value } = await withTimeout(task, timeoutMs);
		const durationMs = Date.now() - startedAt;
		if (timedOut) {
			return {
				status: "timeout",
				durationMs,
				logs,
				truncatedLogs: currentTruncatedLogCount(),
				...timeoutMeta,
			};
		}
		return {
			status: "ok",
			durationMs,
			result: safeSerialize(unwrapExecutionValue(value)),
			logs,
			truncatedLogs: currentTruncatedLogCount(),
			...successMeta,
		};
	} catch (error) {
		const durationMs = Date.now() - startedAt;
		return {
			status: "error",
			durationMs,
			error: safeSerialize(error instanceof Error ? error.message : error),
			stack: error instanceof Error ? error.stack : undefined,
			logs,
			truncatedLogs: currentTruncatedLogCount(),
			...errorMeta,
		};
	} finally {
		runtimeState.currentExecutionContext = null;
	}
};

export const executeCode = async (
	code,
	timeoutMs,
	maxLogEntries,
	filename,
) => {
	const containerInstance = await ensureContainer();
	return runTimedExecution({
		task: Promise.resolve(
			containerInstance.execute(String(code), filename || "/index.js"),
		),
		timeoutMs,
		maxLogEntries,
		successMeta: { filename },
		timeoutMeta: { filename },
		errorMeta: { filename },
	});
};

export const runFile = async (path, timeoutMs, maxLogEntries) => {
	const containerInstance = await ensureContainer();
	const normalized = toCanonicalMountedPath(path);
	if (isDocumentsPath(normalized)) {
		throw new Error(`Cannot execute mounted documents path: ${normalized}`);
	}
	if (!containerInstance.vfs.existsSync(normalized)) {
		throw new Error(`File not found: ${normalized}`);
	}
	return runTimedExecution({
		task: Promise.resolve(containerInstance.runFile(normalized)),
		timeoutMs,
		maxLogEntries,
		successMeta: { path: normalized },
		timeoutMeta: { path: normalized },
		errorMeta: { path: normalized },
	});
};

export const fetchWithTimeout = async (input, init, timeoutMs) => {
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

export const resolveResponseType = (contentType, requestedType) => {
	if (requestedType !== "auto") return requestedType;
	const normalized = String(contentType || "").toLowerCase();
	if (normalized.includes("application/json")) return "json";
	if (normalized.includes("text/html")) return "html";
	return "text";
};

export const resetRuntime = async () => {
	await stopAllServers();
	runtimeState.repls.clear();
	runtimeState.container = await createContainerInstance();
	mountedDocumentFiles.clear();
	mountedDocumentDirectories.clear();
	materializedMountedFiles.clear();
	vfsBoolState.documentsMountLoaded = false;
	mountedWorkspaceFiles.clear();
	mountedWorkspaceDirectories.clear();
	materializedWorkspaceFiles.clear();
	pendingWorkspaceOps.length = 0;
	vfsBoolState.workspaceMountLoaded = false;
	runtimeState.installedPackages.clear();
	runtimeState.servers.clear();
	runtimeState.runtimeLogs.length = 0;
	pushRuntimeLog("info", "Sandbox runtime reset");
};
