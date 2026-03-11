import { handleFsOperation } from "../core/sandbox-fs-handlers.js";
import {
	DEFAULT_FETCH_TIMEOUT_MS,
	DEFAULT_MAX_LOG_ENTRIES,
	DEFAULT_TIMEOUT_MS,
	MAX_RUNTIME_LOG_ENTRIES,
	ensureContainer,
	executeCode,
	fetchWithTimeout,
	normalizeClientUrl,
	rememberInstalledPackages,
	resetRuntime,
	resolveResponseType,
	runFile,
	runtimeState,
	safeSerialize,
	toServerInfo,
	withTimeout,
} from "./shared.js";
import {
	handleSwRequestOperation,
	listServersOperation,
	renderServerUrlOperation,
	requestServerOperation,
	startServerOperation,
	stopServerOperation,
} from "./server-ops.js";

const handleHealthOperation = () => ({
	ready: true,
	initializedAt: runtimeState.initializedAt,
});

const handleCreateReplOperation = (containerInstance) => {
	const replId = crypto.randomUUID();
	runtimeState.repls.set(replId, containerInstance.createREPL());
	return { replId };
};

const handleReplEvalOperation = async (payload) => {
	const repl = runtimeState.repls.get(payload.replId);
	if (!repl) {
		throw new Error(`REPL not found: ${payload.replId}`);
	}

	const startedAt = Date.now();
	const { timedOut, value } = await withTimeout(
		Promise.resolve(repl.eval(String(payload.code))),
		payload.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);
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
};

const handleGetLogsOperation = (payload) => {
	const limit = Math.max(
		1,
		Math.min(payload?.limit ?? 100, MAX_RUNTIME_LOG_ENTRIES),
	);
	const filtered = payload?.level
		? runtimeState.runtimeLogs.filter((entry) => entry.level === payload.level)
		: runtimeState.runtimeLogs;
	return { logs: filtered.slice(-limit) };
};

const handleNetworkFetchOperation = async (payload) => {
	const timeoutMs = payload.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
	const url = normalizeClientUrl(payload.url);
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
	const responseType = resolveResponseType(
		contentType,
		payload.responseType ?? "auto",
	);
	const text = await response.text();
	const body =
		responseType === "json"
			? JSON.stringify(JSON.parse(text), null, 2)
			: text;
	return {
		url,
		status: response.status,
		ok: response.ok,
		contentType,
		responseType,
		body,
	};
};

const handleNpmInstallOperation = async (containerInstance, payload) => {
	const installed = await containerInstance.npm.install(payload.packageSpec, {
		save: payload.save,
		saveDev: payload.saveDev,
	});
	rememberInstalledPackages(installed);
	return { success: true, installed };
};

const handleNpmInstallFromPackageJsonOperation = async (
	containerInstance,
	payload,
) => {
	const installed = await containerInstance.npm.installFromPackageJson({
		save: payload.save,
		saveDev: payload.saveDev,
	});
	rememberInstalledPackages(installed);
	return { success: true, installed };
};

const handleNpmListOperation = async (containerInstance) => {
	const packages =
		typeof containerInstance.npm.listInstalled === "function"
			? await containerInstance.npm.listInstalled()
			: Object.fromEntries(runtimeState.installedPackages);
	return { packages };
};

const handleSnapshotGetOperation = (containerInstance) => {
	const snapshot =
		typeof containerInstance.vfs.toSnapshot === "function"
			? containerInstance.vfs.toSnapshot()
			: { files: [] };
	return {
		snapshot: {
			...snapshot,
			servers: Array.from(runtimeState.servers.values()).map(toServerInfo),
			installedPackages: Object.fromEntries(runtimeState.installedPackages),
		},
	};
};

export const handleOperation = async (request) => {
	if (request.operation === "health") {
		return handleHealthOperation();
	}

	const containerInstance = await ensureContainer();
	const payload = request.payload;

	switch (request.operation) {
		case "runtime.executeCode":
			return executeCode(
				payload.code,
				payload.timeoutMs ?? DEFAULT_TIMEOUT_MS,
				payload.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES,
				payload.filename,
			);
		case "runtime.runFile":
			return runFile(
				payload.path,
				payload.timeoutMs ?? DEFAULT_TIMEOUT_MS,
				payload.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES,
			);
		case "runtime.createRepl":
			return handleCreateReplOperation(containerInstance);
		case "runtime.replEval":
			return handleReplEvalOperation(payload);
		case "runtime.getLogs":
			return handleGetLogsOperation(payload);
		case "runtime.clearLogs":
			runtimeState.runtimeLogs.length = 0;
			return { cleared: true };
		case "network.fetch":
			return handleNetworkFetchOperation(payload);
		case "npm.install":
			return handleNpmInstallOperation(containerInstance, payload);
		case "npm.installFromPackageJson":
			return handleNpmInstallFromPackageJsonOperation(
				containerInstance,
				payload,
			);
		case "npm.list":
			return handleNpmListOperation(containerInstance);
		case "server.start":
			return startServerOperation(payload);
		case "server.stop":
			return stopServerOperation(payload);
		case "server.list":
			return listServersOperation();
		case "server.renderUrl":
			return renderServerUrlOperation(payload);
		case "server.request":
			return requestServerOperation(payload);
		case "server.handleSwRequest":
			return handleSwRequestOperation(payload);
		case "snapshot.get":
			return handleSnapshotGetOperation(containerInstance);
		case "snapshot.restore":
			await resetRuntime();
			return { restored: true };
		case "runtime.reset":
			await resetRuntime();
			return { reset: true };
		default:
			if (request.operation.startsWith("fs.")) {
				return handleFsOperation(request.operation, payload, containerInstance);
			}
			throw new Error(`Unsupported sandbox operation: ${request.operation}`);
	}
};
