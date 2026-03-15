import {
	WORKSPACES_MOUNT_ROOT,
	vfsBoolState,
	mountedWorkspaceDirectories,
	normalizePath,
	dirname,
	isWorkspacePath,
} from "../core/sandbox-vfs.js";
import {
	FRAMEWORK_TEMPLATES,
	TEMPLATE_INSTALL_SPECS,
} from "../core/sandbox-templates.js";
import {
	ensureContainer,
	ensureServerBridgeReady,
	loadAlmostNodeLib,
	normalizeServerPath,
	pushRuntimeLog,
	rememberInstalledPackages,
	resolveResponseType,
	resolveServerBaseUrl,
	runtimeState,
	stopServerState,
	toServerInfo,
	waitForExpressStartup,
} from "./shared.js";

const unregisterBridgeServer = (bridge, port) => {
	if (bridge && typeof bridge.unregisterServer === "function") {
		bridge.unregisterServer(port);
	}
};

const closeTrackedExpressServer = async (containerInstance, port) => {
	const trackedServer =
		containerInstance?.trackedExpressServers?.get?.(port) ??
		containerInstance?.expressServers?.get?.(port) ??
		containerInstance?.servers?.get?.(port);
	if (!trackedServer || typeof trackedServer.close !== "function") {
		return;
	}
	await new Promise((resolve) => trackedServer.close(resolve));
};

const scaffoldTemplate = (containerInstance, templateName, rootDir) => {
	const files = FRAMEWORK_TEMPLATES[templateName];
	if (!files) {
		throw new Error(`Unknown template: ${templateName}`);
	}
	const root = normalizePath(rootDir || "/");

	if (isWorkspacePath(root) && !vfsBoolState.workspaceMountLoaded) {
		vfsBoolState.workspaceMountLoaded = true;
		mountedWorkspaceDirectories.add(WORKSPACES_MOUNT_ROOT);
	}

	const createdFiles = [];
	for (const [relPath, content] of Object.entries(files)) {
		const rel = relPath.startsWith("/") ? relPath.slice(1) : relPath;
		const fullPath = normalizePath(`${root}/${rel}`);
		try {
			if (containerInstance.vfs.existsSync(fullPath)) continue;
		} catch (error) {
			console.warn("[template] existsSync failed, continuing with write", error);
		}

		const parentDir = dirname(fullPath);
		try {
			containerInstance.vfs.mkdirSync(parentDir, { recursive: true });
		} catch (error) {
			console.warn("[template] mkdirSync failed, continuing", error);
		}

		containerInstance.vfs.writeFileSync(fullPath, content);
		createdFiles.push(fullPath);
	}

	pushRuntimeLog(
		"info",
		`Scaffolded template "${templateName}" into ${root}: ${createdFiles.length} files`,
	);
	return createdFiles;
};

const installTemplatePackages = async (containerInstance, templateName) => {
	const packageSpecs = TEMPLATE_INSTALL_SPECS[templateName];
	if (!Array.isArray(packageSpecs)) return;
	for (const packageSpec of packageSpecs) {
		const installed = await containerInstance.npm.install(packageSpec, {});
		rememberInstalledPackages(installed);
	}
};

const isFolderEmpty = (containerInstance, rootDir) => {
	try {
		const entries = containerInstance.vfs.readdirSync(rootDir);
		return !entries || entries.length === 0;
	} catch {
		return true;
	}
};

const detectServerKind = (containerInstance, rootDir, requestedKind) => {
	let kind = requestedKind === "auto" ? undefined : requestedKind;
	if (kind) {
		return kind;
	}

	const hasFile = (name) => {
		try {
			return containerInstance.vfs.existsSync(normalizePath(`${rootDir}/${name}`));
		} catch {
			return false;
		}
	};

	if (
		hasFile("next.config.js") ||
		hasFile("next.config.ts") ||
		hasFile("next.config.mjs")
	) {
		kind = "next";
	} else if (
		hasFile("vite.config.js") ||
		hasFile("vite.config.ts") ||
		hasFile("vite.config.mjs")
	) {
		kind = "vite";
	} else {
		kind = "express";
	}

	pushRuntimeLog("info", `Auto-detected server kind: ${kind} for ${rootDir}`);
	return kind;
};

const getServerOrThrow = (port) => {
	const server = runtimeState.servers.get(port);
	if (!server) {
		throw new Error(`Server not found on port ${port}`);
	}
	if (typeof server.handleRequest !== "function") {
		throw new Error(`No request handler for server on port ${port}`);
	}
	return server;
};

const createViteServerState = async ({
	containerInstance,
	bridge,
	port,
	hostname,
	rootDir,
}) => {
	const almostNodeLib = await loadAlmostNodeLib();
	if (typeof almostNodeLib.ViteDevServer !== "function") {
		throw new Error("ViteDevServer is not available in runtime bundle");
	}
	const viteServer = new almostNodeLib.ViteDevServer(containerInstance.vfs, {
		port,
		hostname,
		root: rootDir,
	});
	await viteServer.start();
	return {
		stop: async () => {
			await viteServer.stop();
			unregisterBridgeServer(bridge, port);
		},
		handleRequest: (method, path, headers, body) =>
			viteServer.handleRequest(method, path, headers, body),
		notifyFileChange: async (path) => {
			if (typeof viteServer.handleFileChange === "function") {
				await viteServer.handleFileChange(path);
			}
		},
	};
};

const createNextServerState = async ({
	containerInstance,
	bridge,
	port,
	hostname,
	rootDir,
}) => {
	const almostNodeLib = await loadAlmostNodeLib();
	if (typeof almostNodeLib.NextDevServer !== "function") {
		throw new Error("NextDevServer is not available in runtime bundle");
	}
	const nextServer = new almostNodeLib.NextDevServer(containerInstance.vfs, {
		port,
		hostname,
		root: rootDir,
	});
	await nextServer.start();
	return {
		stop: async () => {
			await nextServer.stop();
			unregisterBridgeServer(bridge, port);
		},
		handleRequest: (method, path, headers, body) =>
			nextServer.handleRequest(method, path, headers, body),
		notifyFileChange: async (path) => {
			if (typeof nextServer.handleFileChange === "function") {
				await nextServer.handleFileChange(path);
			}
		},
	};
};

const createExpressServerState = async ({
	containerInstance,
	bridge,
	port,
	rootDir,
	entryPath,
}) => {
	if (!bridge || typeof bridge.handleRequest !== "function") {
		throw new Error("Server bridge is not ready for express requests");
	}
	const normalizedEntryPath = normalizePath(entryPath || `${rootDir}/server.js`);
	await containerInstance.runFile(normalizedEntryPath);
	const started = await waitForExpressStartup(bridge, port, 3_000);
	if (!started) {
		pushRuntimeLog(
			"warn",
			`Express startup probe did not confirm readiness for port ${port}; continuing with optimistic server state`,
		);
	}
	return {
		stop: async () => {
			await closeTrackedExpressServer(containerInstance, port);
			unregisterBridgeServer(bridge, port);
		},
		handleRequest: (method, path, headers, body) =>
			bridge.handleRequest(port, method, path, headers, body),
	};
};

const getHeaderCaseInsensitive = (headers, name) => {
	if (!headers || typeof headers !== "object") return undefined;
	const target = String(name).toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (String(key).toLowerCase() === target) {
			return value;
		}
	}
	return undefined;
};

const decodeResponseBodyPreview = (body, maxChars = 300) => {
	try {
		if (typeof body === "string") {
			return body.slice(0, maxChars);
		}
		if (body instanceof ArrayBuffer) {
			return new TextDecoder().decode(body).slice(0, maxChars);
		}
		if (ArrayBuffer.isView(body)) {
			return new TextDecoder().decode(body).slice(0, maxChars);
		}
	} catch {}
	return "";
};

const logSwResponseDiagnostics = (normalizedPath, responseData) => {
	const body = responseData.body;
	const bodyType = typeof body;
	const isArrayBuffer = body instanceof ArrayBuffer;
	const isView = ArrayBuffer.isView(body);
	const isString = bodyType === "string";
	const byteLength = isArrayBuffer
		? body.byteLength
		: isView
			? body.byteLength
			: isString
				? body.length
				: body == null
					? 0
					: -1;
	const preview = decodeResponseBodyPreview(body);
	console.log(`[server.handleSwRequest] handleRequest ${normalizedPath}`, responseData);
	console.log(
		`[server.handleSwRequest] responseData statusCode=${responseData.statusCode} body typeof=${bodyType} isArrayBuffer=${isArrayBuffer} isView=${isView} isString=${isString} byteLen=${byteLength}`,
		preview ? `body preview: ${preview}` : "(no preview)",
	);
};

const logResponseFailure = (method, normalizedPath, responseData) => {
	const errorBody = decodeResponseBodyPreview(responseData.body, 2000);
	const transformError =
		getHeaderCaseInsensitive(responseData.headers, "x-transform-error") ===
		"true";
	const isRecoverableWorkspaceMiss =
		transformError &&
		errorBody.includes("Workspace file not materialized:");
	const level = isRecoverableWorkspaceMiss ? "warn" : "error";
	const consoleFn = isRecoverableWorkspaceMiss ? console.warn : console.error;
	consoleFn(
		`[server.handleSwRequest] ${method} ${normalizedPath} → ${responseData.statusCode ?? 200} ${responseData.statusMessage ?? ""}`,
		errorBody || "(no body)",
	);
	pushRuntimeLog(
		level,
		`Server ${level}: ${method} ${normalizedPath} → ${responseData.statusCode ?? 200}: ${errorBody.slice(0, 500) || "(no body)"}`,
	);
};

const toBodyBytes = (rawBody) => {
	if (!rawBody) {
		return new Uint8Array(0);
	}
	if (rawBody instanceof ArrayBuffer) {
		return new Uint8Array(rawBody);
	}
	if (ArrayBuffer.isView(rawBody)) {
		return new Uint8Array(
			rawBody.buffer,
			rawBody.byteOffset,
			rawBody.byteLength,
		);
	}
	if (typeof rawBody === "string") {
		return new TextEncoder().encode(rawBody);
	}
	console.warn(
		"[server.handleSwRequest] unknown body type, body will be empty:",
		typeof rawBody,
		rawBody,
	);
	return new Uint8Array(0);
};

const encodeBodyBase64 = (rawBody) => {
	const bodyBytes = toBodyBytes(rawBody);
	if (bodyBytes.length === 0) return "";
	const chunkSize = 8192;
	let binary = "";
	for (let i = 0; i < bodyBytes.length; i += chunkSize) {
		binary += String.fromCharCode(
			...bodyBytes.subarray(i, Math.min(i + chunkSize, bodyBytes.length)),
		);
	}
	return btoa(binary);
};

const isPathWithinRoot = (rootDir, path) => {
	const normalizedRoot = normalizePath(rootDir || "/");
	const normalizedPath = normalizePath(path);
	return (
		normalizedRoot === "/" ||
		normalizedPath === normalizedRoot ||
		normalizedPath.startsWith(`${normalizedRoot}/`)
	);
};

export const notifyWorkspaceFileChanges = async (paths = []) => {
	const uniquePaths = Array.from(
		new Set(
			paths
				.filter((path) => typeof path === "string" && path.length > 0)
				.map((path) => normalizePath(path)),
		),
	);
	if (uniquePaths.length === 0) {
		return;
	}

	for (const server of runtimeState.servers.values()) {
		if (typeof server.notifyFileChange !== "function") {
			continue;
		}
		for (const path of uniquePaths) {
			if (!isPathWithinRoot(server.rootDir, path)) {
				continue;
			}
			try {
				await server.notifyFileChange(path);
			} catch (error) {
				pushRuntimeLog(
					"warn",
					`Hot reload notify failed for server :${server.port} (${path}): ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}
};

export const startServerOperation = async (payload) => {
	const containerInstance = await ensureContainer();
	const port = payload.port;
	const hostname = payload.hostname;
	const rootDir = normalizePath(payload.rootDir || "/workspaces/app");

	let createdFiles = [];
	if (isFolderEmpty(containerInstance, rootDir) && payload.template) {
		createdFiles = scaffoldTemplate(containerInstance, payload.template, rootDir);
		if (payload.autoInstall !== false) {
			await installTemplatePackages(containerInstance, payload.template);
		}
	}

	const kind = detectServerKind(containerInstance, rootDir, payload.kind);
	await stopServerState(port);

	const bridge = await ensureServerBridgeReady(containerInstance);
	const serverFactoryParams = {
		containerInstance,
		bridge,
		port,
		hostname,
		rootDir,
		entryPath: payload.entryPath,
	};
	const serverImpl =
		kind === "vite"
			? await createViteServerState(serverFactoryParams)
			: kind === "next"
				? await createNextServerState(serverFactoryParams)
				: await createExpressServerState(serverFactoryParams);

	const url = resolveServerBaseUrl(bridge, port);
	const state = {
		kind,
		port,
		url,
		renderUrl: url,
		rootDir,
		stop: serverImpl.stop,
		handleRequest: serverImpl.handleRequest,
		notifyFileChange: serverImpl.notifyFileChange,
	};
	runtimeState.servers.set(port, state);
	return { ...toServerInfo(state), createdFiles };
};

export const stopServerOperation = async (payload) => {
	await stopServerState(payload.port);
	return { port: payload.port };
};

export const listServersOperation = async () => ({
	servers: Array.from(runtimeState.servers.values()).map(toServerInfo),
});

export const renderServerUrlOperation = async (payload) => {
	const server = getServerOrThrow(payload.port);
	const url =
		server.url.replace(/\/?$/, "") + normalizeServerPath(payload.path || "/");
	return { port: payload.port, url };
};

export const requestServerOperation = async (payload) => {
	const server = getServerOrThrow(payload.port);
	const path = normalizeServerPath(payload.path || "/");
	const url = server.url.replace(/\/?$/, "") + path;
	const bodyBuffer = payload.body
		? new TextEncoder().encode(payload.body).buffer
		: null;
	const responseData = await server.handleRequest(
		payload.method ?? "GET",
		path,
		payload.headers ?? {},
		bodyBuffer,
	);
	const contentType =
		responseData.headers?.["content-type"] ??
		responseData.headers?.["Content-Type"] ??
		"";
	const responseType = resolveResponseType(
		contentType,
		payload.responseType ?? "auto",
	);
	const bodyText = responseData.body
		? new TextDecoder().decode(responseData.body)
		: "";
	const body =
		responseType === "json"
			? JSON.stringify(JSON.parse(bodyText), null, 2)
			: bodyText;
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
};

export const handleSwRequestOperation = async (payload) => {
	const { id, port, method, path, headers, body } = payload;
	console.log(
		`[server.handleSwRequest] id=${id} port=${port} method=${method} path=${path}`,
	);
	const server = getServerOrThrow(port);
	const normalizedPath = normalizeServerPath(path || "/");
	const responseData = await server.handleRequest(
		method ?? "GET",
		normalizedPath,
		headers ?? {},
		body ?? null,
	);

	logSwResponseDiagnostics(normalizedPath, responseData);

	const isTransformError =
		getHeaderCaseInsensitive(responseData.headers, "x-transform-error") ===
		"true";
	if ((responseData.statusCode ?? 200) >= 400 || isTransformError) {
		logResponseFailure(method, normalizedPath, responseData);
	}

	return {
		statusCode: responseData.statusCode ?? 200,
		statusMessage: responseData.statusMessage ?? "OK",
		headers: responseData.headers ?? {},
		bodyBase64: encodeBodyBase64(responseData.body),
	};
};
