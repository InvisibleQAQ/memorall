const SANDBOX_CHANNEL = "memorall-sandbox-container";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_LOG_ENTRIES = 20;
const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const MAX_RUNTIME_LOG_ENTRIES = 500;

const initializedAt = Date.now();
const runtimeLogs = [];
const repls = new Map();
const files = new Map();
const directories = new Set(["/"]);
const installedPackages = new Map();
const packageCache = new Map();
const servers = new Map();

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

const appendLog = (logs, entry, maxEntries) => {
	if (logs.length < maxEntries) {
		logs.push(entry);
		return 0;
	}
	logs.shift();
	logs.push(entry);
	return 1;
};

const pushRuntimeLog = (level, message) => {
	appendLog(
		runtimeLogs,
		{
			level,
			message,
			timestamp: Date.now(),
		},
		MAX_RUNTIME_LOG_ENTRIES,
	);
};

const withTimeout = async (task, timeoutMs) =>
	Promise.race([
		task,
		new Promise((resolve) => setTimeout(() => resolve("__timeout__"), timeoutMs)),
	]);

const dirname = (inputPath) => {
	const normalized = inputPath.replace(/\/+/g, "/");
	const idx = normalized.lastIndexOf("/");
	if (idx <= 0) return "/";
	return normalized.slice(0, idx);
};

const ensureDir = (path) => {
	const normalized = path.replace(/\/+/g, "/");
	if (!normalized.startsWith("/")) {
		throw new Error(`Path must be absolute: ${path}`);
	}
	const parts = normalized.split("/").filter(Boolean);
	let current = "/";
	directories.add("/");
	for (const part of parts) {
		current = current === "/" ? `/${part}` : `${current}/${part}`;
		directories.add(current);
	}
};

const listDir = (path) => {
	const normalized = path.replace(/\/+/g, "/");
	const prefix = normalized === "/" ? "/" : `${normalized}/`;
	const entries = new Set();

	for (const dir of directories) {
		if (!dir.startsWith(prefix) || dir === normalized) continue;
		const rest = dir.slice(prefix.length);
		if (!rest || rest.includes("/")) continue;
		entries.add(rest);
	}
	for (const filePath of files.keys()) {
		if (!filePath.startsWith(prefix)) continue;
		const rest = filePath.slice(prefix.length);
		if (!rest || rest.includes("/")) continue;
		entries.add(rest);
	}
	return Array.from(entries).sort();
};

const parsePackageName = (spec) => {
	if (spec.startsWith("@")) {
		const rest = spec.slice(1);
		const slashIdx = rest.indexOf("/");
		if (slashIdx === -1) return spec;
		const afterSlash = rest.slice(slashIdx + 1);
		const atIdx = afterSlash.indexOf("@");
		return atIdx === -1 ? spec : `@${rest.slice(0, slashIdx + 1 + atIdx)}`;
	}
	const atIdx = spec.indexOf("@");
	return atIdx <= 0 ? spec : spec.slice(0, atIdx);
};

const loadPackageFromCDN = async (packageSpec) => {
	const name = parsePackageName(packageSpec);
	if (packageCache.has(name)) return packageCache.get(name);

	const url = `https://cdn.jsdelivr.net/npm/${packageSpec}`;
	const resp = await fetchWithTimeout(url, {}, DEFAULT_FETCH_TIMEOUT_MS);
	if (!resp.ok) {
		throw new Error(`Failed to fetch ${packageSpec} from CDN (${resp.status})`);
	}
	const code = await resp.text();

	const mod = { exports: {} };
	try {
		const fn = new Function("module", "exports", "require", code);
		fn(mod, mod.exports, (dep) => {
			if (packageCache.has(dep)) return packageCache.get(dep);
			throw new Error(
				`Nested dependency '${dep}' not installed. Use container_install_package first.`,
			);
		});
	} catch {
		try {
			const beforeKeys = new Set(Object.keys(globalThis));
			new Function(code)();
			const newKeys = Object.keys(globalThis).filter((k) => !beforeKeys.has(k));
			if (newKeys.length === 1) {
				mod.exports = globalThis[newKeys[0]];
			} else if (newKeys.length > 1) {
				mod.exports = {};
				for (const k of newKeys) mod.exports[k] = globalThis[k];
			}
		} catch (evalErr) {
			throw new Error(`Failed to load package '${name}': ${evalErr.message}`);
		}
	}

	packageCache.set(name, mod.exports);
	return mod.exports;
};

const createRequire = () => (specifier) => {
	if (packageCache.has(specifier)) return packageCache.get(specifier);

	const possiblePaths = [
		specifier,
		`/${specifier}`,
		`/${specifier}.js`,
		`/${specifier}/index.js`,
	];
	for (const p of possiblePaths) {
		if (files.has(p)) {
			const fileCode = files.get(p);
			const mod = { exports: {} };
			const fn = new Function("module", "exports", "require", fileCode);
			fn(mod, mod.exports, createRequire());
			return mod.exports;
		}
	}

	throw new Error(
		`Cannot find module '${specifier}'. Use container_install_package to install npm packages first.`,
	);
};

const executeCode = async (code, timeoutMs, maxLogEntries, filename) => {
	const startedAt = Date.now();
	const logs = [];
	let truncatedLogs = 0;

	const sandboxConsole = {
		log: (...args) => {
			const message = args.map(safeSerialize).join(" ");
			truncatedLogs += appendLog(
				logs,
				{ level: "log", message, timestamp: Date.now() },
				maxLogEntries,
			);
			pushRuntimeLog("log", message);
		},
		info: (...args) => {
			const message = args.map(safeSerialize).join(" ");
			truncatedLogs += appendLog(
				logs,
				{ level: "info", message, timestamp: Date.now() },
				maxLogEntries,
			);
			pushRuntimeLog("info", message);
		},
		warn: (...args) => {
			const message = args.map(safeSerialize).join(" ");
			truncatedLogs += appendLog(
				logs,
				{ level: "warn", message, timestamp: Date.now() },
				maxLogEntries,
			);
			pushRuntimeLog("warn", message);
		},
		error: (...args) => {
			const message = args.map(safeSerialize).join(" ");
			truncatedLogs += appendLog(
				logs,
				{ level: "error", message, timestamp: Date.now() },
				maxLogEntries,
			);
			pushRuntimeLog("error", message);
		},
		debug: (...args) => {
			const message = args.map(safeSerialize).join(" ");
			truncatedLogs += appendLog(
				logs,
				{ level: "debug", message, timestamp: Date.now() },
				maxLogEntries,
			);
			pushRuntimeLog("debug", message);
		},
	};

	try {
		const runner = new Function(
			"console",
			"require",
			`"use strict"; return (async () => { ${code}\n})();`,
		);

		const completed = await withTimeout(
			Promise.resolve(runner(sandboxConsole, createRequire())),
			timeoutMs,
		);
		const durationMs = Date.now() - startedAt;

		if (completed === "__timeout__") {
			return { status: "timeout", durationMs, logs, truncatedLogs };
		}

		return {
			status: "ok",
			durationMs,
			result: safeSerialize(completed),
			logs,
			truncatedLogs,
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
			truncatedLogs,
			filename,
		};
	}
};

const runFile = async (path, timeoutMs, maxLogEntries) => {
	if (!files.has(path)) {
		throw new Error(`File not found: ${path}`);
	}
	const code = files.get(path) || "";
	const result = await executeCode(code, timeoutMs, maxLogEntries, path);
	return { ...result, path };
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
	if (requestedType !== "auto") {
		return requestedType;
	}
	const normalized = String(contentType || "").toLowerCase();
	if (normalized.includes("application/json")) {
		return "json";
	}
	if (normalized.includes("text/html")) {
		return "html";
	}
	return "text";
};

const resetRuntime = () => {
	repls.clear();
	files.clear();
	directories.clear();
	directories.add("/");
	installedPackages.clear();
	packageCache.clear();
	servers.clear();
	runtimeLogs.length = 0;
	pushRuntimeLog("info", "Sandbox runtime reset");
};

const handleOperation = async (request) => {
	const payload = request.payload;

	switch (request.operation) {
		case "health":
			return { ready: true, initializedAt };
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
		case "runtime.createRepl": {
			const replId = crypto.randomUUID();
			repls.set(replId, []);
			return { replId };
		}
		case "runtime.replEval": {
			if (!repls.has(payload.replId)) {
				throw new Error(`REPL not found: ${payload.replId}`);
			}
			return executeCode(
				payload.code,
				payload.timeoutMs ?? DEFAULT_TIMEOUT_MS,
				DEFAULT_MAX_LOG_ENTRIES,
			);
		}
		case "runtime.getLogs": {
			const limit = Math.max(
				1,
				Math.min(payload?.limit ?? 100, MAX_RUNTIME_LOG_ENTRIES),
			);
			const filtered = payload?.level
				? runtimeLogs.filter((entry) => entry.level === payload.level)
				: runtimeLogs;
			return { logs: filtered.slice(-limit) };
		}
		case "runtime.clearLogs":
			runtimeLogs.length = 0;
			return { cleared: true };
		case "network.fetch": {
			const timeoutMs = payload.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
			const response = await fetchWithTimeout(
				payload.url,
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
				url: payload.url,
				status: response.status,
				ok: response.ok,
				contentType,
				responseType,
				body,
			};
		}
		case "fs.writeFile":
			ensureDir(dirname(payload.path));
			files.set(payload.path, payload.content);
			return { path: payload.path };
		case "fs.readFile":
			if (!files.has(payload.path)) {
				throw new Error(`File not found: ${payload.path}`);
			}
			return { path: payload.path, content: files.get(payload.path) || "" };
		case "fs.mkdir":
			ensureDir(payload.path);
			return { path: payload.path };
		case "fs.readdir":
			if (!directories.has(payload.path)) {
				throw new Error(`Directory not found: ${payload.path}`);
			}
			return { path: payload.path, entries: listDir(payload.path) };
		case "fs.unlink":
			files.delete(payload.path);
			directories.delete(payload.path);
			return { path: payload.path };
		case "fs.rename": {
			const content = files.get(payload.oldPath);
			if (content === undefined) {
				throw new Error(`File not found: ${payload.oldPath}`);
			}
			files.delete(payload.oldPath);
			ensureDir(dirname(payload.newPath));
			files.set(payload.newPath, content);
			return { oldPath: payload.oldPath, newPath: payload.newPath };
		}
		case "fs.exists":
			return {
				path: payload.path,
				exists: files.has(payload.path) || directories.has(payload.path),
			};
		case "npm.install": {
			const pkgName = parsePackageName(payload.packageSpec);
			try {
				await loadPackageFromCDN(payload.packageSpec);
				installedPackages.set(pkgName, "latest");
			} catch (err) {
				installedPackages.set(pkgName, "latest");
				pushRuntimeLog(
					"warn",
					`Package '${pkgName}' registered but CDN load failed: ${err.message}`,
				);
			}
			return {
				success: true,
				installed: Object.fromEntries(installedPackages.entries()),
			};
		}
		case "npm.installFromPackageJson":
			return {
				success: true,
				installed: Object.fromEntries(installedPackages.entries()),
			};
		case "npm.list":
			return { packages: Object.fromEntries(installedPackages.entries()) };
		case "server.start": {
			const url = `http://${payload.hostname || "127.0.0.1"}:${payload.port}`;
			servers.set(payload.port, {
				kind: payload.kind,
				port: payload.port,
				url,
			});
			return { kind: payload.kind, port: payload.port, url };
		}
		case "server.stop":
			servers.delete(payload.port);
			return { port: payload.port };
		case "server.list":
			return { servers: Array.from(servers.values()) };
		case "snapshot.get":
			return {
				snapshot: {
					files: Array.from(files.entries()),
					directories: Array.from(directories.values()),
					installedPackages: Array.from(installedPackages.entries()),
					servers: Array.from(servers.values()),
				},
			};
		case "snapshot.restore":
			resetRuntime();
			if (payload?.snapshot?.files && Array.isArray(payload.snapshot.files)) {
				for (const [path, content] of payload.snapshot.files) {
					files.set(path, content);
				}
			}
			if (
				payload?.snapshot?.directories &&
				Array.isArray(payload.snapshot.directories)
			) {
				for (const dirPath of payload.snapshot.directories) {
					directories.add(dirPath);
				}
			}
			if (
				payload?.snapshot?.installedPackages &&
				Array.isArray(payload.snapshot.installedPackages)
			) {
				for (const [name, version] of payload.snapshot.installedPackages) {
					installedPackages.set(name, version);
				}
			}
			return { restored: true };
		case "runtime.reset":
			resetRuntime();
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
	parent.postMessage(
		{
			channel: SANDBOX_CHANNEL,
			direction: "response",
			requestId: request.requestId,
			operation: request.operation,
			ok: true,
			result,
		},
		"*",
	);
};

const sendError = (request, error) => {
	parent.postMessage(
		{
			channel: SANDBOX_CHANNEL,
			direction: "response",
			requestId: request.requestId,
			operation: request.operation,
			ok: false,
			error: toError(error),
		},
		"*",
	);
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
