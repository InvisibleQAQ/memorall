import { logError, logInfo, logWarn } from "@/utils/logger";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import type { ISandboxContainerService } from "./interfaces/sandbox-container-service.interface";
import {
	decodeSwResponseBodyPreview,
	hasSwTransformErrorHeader,
} from "./sw-response-utils";
import type {
	SandboxErrorEnvelope,
	SandboxExecutionRequest,
	SandboxExecutionResult,
	SandboxFsExistsRequest,
	SandboxFsExistsResult,
	SandboxFsMkdirRequest,
	SandboxFsReadFileRequest,
	SandboxFsReadFileResult,
	SandboxFsReaddirRequest,
	SandboxFsReaddirResult,
	SandboxFsRenameRequest,
	SandboxFsUnlinkRequest,
	SandboxFsWriteFileRequest,
	SandboxListServersResult,
	SandboxNpmInstallFromPackageJsonRequest,
	SandboxNpmInstallRequest,
	SandboxNpmInstallResult,
	SandboxNpmListResult,
	SandboxOperation,
	SandboxOperationPayloadMap,
	SandboxOperationResultMap,
	SandboxRequestEnvelope,
	SandboxRestoreSnapshotRequest,
	SandboxRunFileRequest,
	SandboxRunFileResult,
	SandboxStartServerRequest,
	SandboxStartServerResult,
	SandboxStopServerRequest,
	SandboxGetLogsRequest,
	SandboxGetLogsResult,
	SandboxNetworkFetchRequest,
	SandboxNetworkFetchResult,
	SandboxServerRequest,
	SandboxServerRequestResult,
	SandboxServerRenderUrlRequest,
	SandboxServerRenderUrlResult,
	SandboxHandleSwRequestResult,
	SandboxResponseMessage,
} from "./types";

interface PendingRequest {
	timeoutId: number;
	resolve: (value: unknown) => void;
	reject: (reason?: unknown) => void;
	operation: SandboxOperation;
}

interface RendererPreviewConfig {
	path: string;
	virtualUrl: string;
	rendererUrl: string;
	importMap: Record<string, string>;
}

export interface SandboxContainerInitOptions {
	frameUrl?: string;
	loadTimeoutMs?: number;
	requestTimeoutMs?: number;
}

const SANDBOX_CHANNEL = "memorall-sandbox-container" as const;
const DEFAULT_FRAME_URL = "sandbox/pages/sandbox-container-runtime.html";
const DEFAULT_LOAD_TIMEOUT_MS = 20_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const WORKSPACES_ROOT = "/workspaces";
const WORKSPACE_LEGACY_ROOT = "/workspace";

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isSandboxResponseMessage = (
	value: unknown,
): value is SandboxResponseMessage<SandboxOperation> => {
	if (!isObject(value)) {
		return false;
	}
	return (
		value.channel === SANDBOX_CHANNEL &&
		value.direction === "response" &&
		typeof value.requestId === "string" &&
		typeof value.operation === "string"
	);
};

const isSandboxErrorEnvelope = (
	value: SandboxResponseMessage<SandboxOperation>,
): value is SandboxErrorEnvelope<SandboxOperation> => value.ok === false;

export class SandboxContainerServiceMain implements ISandboxContainerService {
	private static instance: SandboxContainerServiceMain;

	private iframe: HTMLIFrameElement | null = null;
	private initialized = false;
	private initializing: Promise<void> | null = null;
	private initializedAt: number | null = null;
	private readonly pending = new Map<string, PendingRequest>();
	private readonly options: Required<SandboxContainerInitOptions>;
	private mountDocumentsSyncPromise: Promise<void> | null = null;
	private mountWorkspaceSyncPromise: Promise<void> | null = null;
	/** Relay channel: port1 stays here, port2 is transferred to the SW as mainPort. */
	private swRelayChannel: MessageChannel | null = null;
	/** Last known active service worker — used to re-init relay if SW restarts. */
	private swInstance: ServiceWorker | null = null;
	/** Keepalive timer — sends a periodic ping to prevent Chrome from killing the SW. */
	private swKeepaliveTimer: ReturnType<typeof setInterval> | null = null;

	private constructor(options: SandboxContainerInitOptions = {}) {
		this.options = {
			frameUrl: options.frameUrl ?? DEFAULT_FRAME_URL,
			loadTimeoutMs: options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS,
			requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
		};
	}

	static getInstance(
		options?: SandboxContainerInitOptions,
	): SandboxContainerServiceMain {
		if (!SandboxContainerServiceMain.instance) {
			SandboxContainerServiceMain.instance = new SandboxContainerServiceMain(
				options,
			);
		}
		return SandboxContainerServiceMain.instance;
	}

	isReady(): boolean {
		return this.initialized && this.iframe !== null;
	}

	getInitializedAt(): number | null {
		return this.initializedAt;
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}
		if (this.initializing) {
			return this.initializing;
		}

		this.initializing = this.initializeInternal();
		try {
			await this.initializing;
		} finally {
			this.initializing = null;
		}
	}

	private async initializeInternal(): Promise<void> {
		if (typeof window === "undefined" || typeof document === "undefined") {
			throw new Error("SandboxContainerService requires DOM APIs.");
		}
		if (typeof chrome === "undefined" || !chrome.runtime?.getURL) {
			throw new Error(
				"SandboxContainerService requires chrome.runtime.getURL.",
			);
		}

		// Register the AlmostNode service worker from this outer (non-sandboxed)
		// page so it can control the sandbox iframe context. Manifest sandbox pages
		// have null origin and cannot register service workers themselves.
		await this.registerSandboxServiceWorker();

		window.addEventListener("message", this.onMessage);
		window.addEventListener("message", this.onFsMessage);

		const iframe = document.createElement("iframe");
		iframe.style.display = "none";
		iframe.src = chrome.runtime.getURL(this.options.frameUrl);

		const loaded = new Promise<void>((resolve, reject) => {
			const timeoutId = window.setTimeout(() => {
				reject(
					new Error(
						`Sandbox iframe load timeout after ${this.options.loadTimeoutMs}ms`,
					),
				);
			}, this.options.loadTimeoutMs);

			iframe.addEventListener(
				"load",
				() => {
					window.clearTimeout(timeoutId);
					resolve();
				},
				{ once: true },
			);

			iframe.addEventListener(
				"error",
				() => {
					window.clearTimeout(timeoutId);
					reject(new Error("Sandbox iframe failed to load."));
				},
				{ once: true },
			);
		});

		try {
			document.body.appendChild(iframe);
			await loaded;

			this.iframe = iframe;
			this.initialized = true;
			this.initializedAt = Date.now();

			await this.request("health", undefined, 10_000);
			logInfo("✅ SandboxContainerService initialized");
		} catch (error) {
			iframe.remove();
			this.iframe = null;
			this.initialized = false;
			this.initializedAt = null;
			window.removeEventListener("message", this.onMessage);
			throw error;
		}
	}

	/**
	 * Register the AlmostNode service worker from this outer (non-sandboxed) page
	 * and set up a relay channel so the SW can route /__virtual__/<port>/ requests
	 * through the sandbox iframe's AlmostNode bridge.
	 *
	 * Manifest sandbox pages (pages/sandbox-container-runtime.html) have a sandboxed
	 * browsing context and can never register service workers themselves, so
	 * registration must happen here in the extension popup context.
	 */
	private async registerSandboxServiceWorker(): Promise<void> {
		if (!("serviceWorker" in navigator)) {
			logWarn("[SW] navigator.serviceWorker not available");
			return;
		}
		try {
			const swUrl = chrome.runtime.getURL("sandbox/__sw__.js");
			const reg = await navigator.serviceWorker.register(swUrl);
			logInfo(
				"[SW] Registered sandbox service worker, scope:",
				reg.scope,
				swUrl,
			);

			// Wait for the SW to become active.
			await navigator.serviceWorker.ready;

			const sw =
				navigator.serviceWorker.controller ??
				reg.active ??
				reg.installing ??
				reg.waiting;
			if (!sw) {
				logWarn(
					"[SW] No active SW found after ready — page reload may be needed",
				);
				return;
			}

			this.initSwRelay(sw);

			// Re-init relay if the SW updates or regains control.
			navigator.serviceWorker.addEventListener("controllerchange", () => {
				const newSw = navigator.serviceWorker.controller;
				if (newSw) {
					logInfo("[SW] Controller changed — re-initialising relay");
					this.initSwRelay(newSw);
				}
			});

			// SW asks clients to re-send init when it loses its mainPort.
			// NOTE: offscreen documents are NOT in the SW scope (/sandbox/),
			// so navigator.serviceWorker.controller is always null here.
			// We must use this.swInstance (stored during registration).
			navigator.serviceWorker.addEventListener(
				"message",
				(event: MessageEvent) => {
					if (event.data?.type === "sw-needs-init") {
						const activeSw =
							this.swInstance ?? navigator.serviceWorker.controller;
						if (activeSw) this.initSwRelay(activeSw);
					}
				},
			);
		} catch (err) {
			logWarn("[SW] Service worker registration failed:", err);
		}
	}

	private initSwRelay(sw: ServiceWorker): void {
		this.swInstance = sw;
		// Close any previous relay channel.
		if (this.swRelayChannel) {
			this.swRelayChannel.port1.close();
		}
		this.swRelayChannel = new MessageChannel();

		// Send port2 to SW — it becomes mainPort inside __sw__.js.
		sw.postMessage({ type: "init" }, [this.swRelayChannel.port2]);

		// Relay SW request messages to the sandbox iframe.
		this.swRelayChannel.port1.onmessage = (event: MessageEvent) => {
			void this.relaySwMessage(event.data);
		};
		this.swRelayChannel.port1.start();
		logInfo("[SW] Relay channel initialised");

		// Keep the SW alive with a periodic ping so Chrome doesn't kill it and
		// lose mainPort. The SW ignores the message type; receiving any message
		// resets Chrome's idle-kill timer (~30 s). We ping every 20 s.
		if (this.swKeepaliveTimer) clearInterval(this.swKeepaliveTimer);
		this.swKeepaliveTimer = setInterval(() => {
			sw.postMessage({ type: "keepalive" });
		}, 20_000);
	}

	/**
	 * Call server.handleSwRequest and retry once if a workspace file needs
	 * materialization. This covers both explicit HTTP failures and Vite/Next
	 * transform errors, which come back as 200 + X-Transform-Error.
	 * Used by both relaySwMessage (SW mainPort path) and renderViaIframe messageHandler.
	 */
	async handleSwRequestWithRetry(params: {
		id: number;
		port: number;
		method: string;
		path: string;
		headers: Record<string, string>;
		body: ArrayBuffer | null;
	}): Promise<SandboxHandleSwRequestResult> {
		const makeRequest = () =>
			this.request(
				"server.handleSwRequest",
				{
					id: params.id,
					port: params.port,
					method: params.method,
					path: params.path,
					headers: params.headers,
					body: params.body,
				},
				120_000,
			);

		let result = await makeRequest();
		const shouldInspectBody =
			(result.statusCode ?? 200) >= 400 || hasSwTransformErrorHeader(result);

		if (shouldInspectBody) {
			const bodyText = decodeSwResponseBodyPreview(result, 1200);
			const transformError = hasSwTransformErrorHeader(result);

			logInfo(
				`[SW relay] ${params.method} ${params.path} → ${result.statusCode ?? 200} | transformError=${transformError} | bodyBase64 length=${result.bodyBase64?.length ?? 0} | bodyText=${bodyText || "(empty)"}`,
			);

			const missingPath = this.extractUnmaterializedWorkspacePath(bodyText);
			if (missingPath) {
				logInfo(
					`[SW relay] materializing ${missingPath} and retrying ${params.method} ${params.path}`,
				);
				await this.materializeMountedWorkspaceFile(missingPath);
				result = await makeRequest();
			} else if ((result.statusCode ?? 200) >= 400 || transformError) {
				logError(
					`[SW relay] ${params.method} ${params.path} → ${result.statusCode ?? 200} no retry match`,
					bodyText || "(no body)",
				);
			}
		}

		return result;
	}

	private async relaySwMessage(msg: {
		type: string;
		id: number;
		data: {
			port: number;
			method: string;
			url: string;
			headers: Record<string, string>;
			body: ArrayBuffer | null;
		};
	}): Promise<void> {
		if (msg.type !== "request" || !this.swRelayChannel) return;
		const { id, data } = msg;
		try {
			const result = await this.handleSwRequestWithRetry({
				id,
				port: data.port,
				method: data.method,
				path: data.url,
				headers: data.headers ?? {},
				body: data.body ?? null,
			});
			this.swRelayChannel.port1.postMessage({
				type: "response",
				id,
				data: result,
			});
		} catch (err) {
			logError(`[SW relay] ${data.method} ${data.url} → error`, err);
			this.swRelayChannel.port1.postMessage({
				type: "response",
				id,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	// ── VFS bridge ───────────────────────────────────────────────────────────
	// The sandbox VFS posts memorall-sandbox-fs-req / memorall-sandbox-fs-notify
	// messages so workspace writes/reads go through documentFileSystemService
	// for persistence rather than staying in-memory only.

	private onFsMessage = (event: MessageEvent<unknown>): void => {
		if (event.source !== this.iframe?.contentWindow) return;
		const data = event.data as Record<string, unknown> | null;
		if (!data || typeof data !== "object") return;

		if (data["channel"] === "memorall-sandbox-fs-req") {
			void this.handleFsAsyncRequest(
				data as {
					requestId: string;
					operation: string;
					payload: Record<string, unknown>;
				},
			);
			return;
		}
		if (data["channel"] === "memorall-sandbox-fs-notify") {
			this.handleFsNotify(
				data as { operation: string; payload: Record<string, unknown> },
			);
		}
	};

	private async handleFsAsyncRequest(req: {
		requestId: string;
		operation: string;
		payload: Record<string, unknown>;
	}): Promise<void> {
		if (!this.iframe?.contentWindow) return;
		try {
			const result = await this.dispatchFsToDocumentService(
				req.operation,
				req.payload,
			);
			this.iframe.contentWindow.postMessage(
				{
					channel: "memorall-sandbox-fs-res",
					requestId: req.requestId,
					ok: true,
					result,
				},
				"*",
			);
		} catch (err) {
			this.iframe.contentWindow.postMessage(
				{
					channel: "memorall-sandbox-fs-res",
					requestId: req.requestId,
					ok: false,
					error: err instanceof Error ? err.message : String(err),
				},
				"*",
			);
		}
	}

	private handleFsNotify(msg: {
		operation: string;
		payload: Record<string, unknown>;
	}): void {
		void this.dispatchFsToDocumentService(msg.operation, msg.payload).catch(
			(err) => {
				logWarn("[sandbox-fs-notify] failed", {
					operation: msg.operation,
					err,
				});
			},
		);
	}

	private async dispatchFsToDocumentService(
		operation: string,
		payload: Record<string, unknown>,
	): Promise<unknown> {
		const path = this.toWorkspaceCanonicalPath(
			this.normalizeVirtualPath(String(payload["path"] ?? "")),
		);
		switch (operation) {
			case "fs.readFile": {
				if (this.isWorkspacePath(path)) {
					await this.syncWorkspaceMount();
					const bytes =
						await documentFileSystemService.getWorkspaceFileContent(path);
					return { content: new TextDecoder().decode(bytes) };
				}
				if (this.isDocumentsPath(path)) {
					await this.syncDocumentsMount();
					const logicalPath = this.toDocumentsLogicalPath(path) ?? "/";
					const bytes =
						await documentFileSystemService.getFileContent(logicalPath);
					return { content: new TextDecoder().decode(bytes) };
				}
				throw new Error(`Path not in workspace or documents: ${path}`);
			}
			case "fs.writeFile": {
				if (this.isWorkspacePath(path)) {
					await this.syncWorkspaceMount();
					await documentFileSystemService.writeWorkspaceFile(
						path,
						String(payload["content"] ?? ""),
					);
				}
				return { path };
			}
			case "fs.mkdir": {
				if (this.isWorkspacePath(path)) {
					await this.syncWorkspaceMount();
					await documentFileSystemService.mkdirWorkspace(path);
				}
				return { path };
			}
			case "fs.unlink": {
				if (this.isWorkspacePath(path)) {
					await this.syncWorkspaceMount();
					await documentFileSystemService.deleteWorkspaceFile(path);
				}
				return { path };
			}
			case "fs.rename": {
				const newPath = this.toWorkspaceCanonicalPath(
					this.normalizeVirtualPath(String(payload["newPath"] ?? "")),
				);
				if (this.isWorkspacePath(path)) {
					await this.syncWorkspaceMount();
					const newName = newPath.split("/").pop()!;
					await documentFileSystemService.renameWorkspaceFile(path, newName);
				}
				return { oldPath: path, newPath };
			}
			default:
				throw new Error(`Unknown fs bridge operation: ${operation}`);
		}
	}

	// ── End VFS bridge ────────────────────────────────────────────────────────

	private onMessage = (event: MessageEvent<unknown>): void => {
		if (!this.iframe?.contentWindow) {
			return;
		}
		if (event.source !== this.iframe.contentWindow) {
			return;
		}
		if (!isSandboxResponseMessage(event.data)) {
			return;
		}

		const envelope = event.data;
		const pending = this.pending.get(envelope.requestId);
		if (!pending) {
			return;
		}

		window.clearTimeout(pending.timeoutId);
		this.pending.delete(envelope.requestId);

		if (isSandboxErrorEnvelope(envelope)) {
			pending.reject(
				new Error(
					`Sandbox operation failed (${envelope.operation}): ${envelope.error.message}`,
				),
			);
			return;
		}

		pending.resolve(envelope.result);
	};

	private buildRequest<T extends SandboxOperation>(
		operation: T,
		payload: SandboxOperationPayloadMap[T],
	): SandboxRequestEnvelope<T> {
		return {
			channel: SANDBOX_CHANNEL,
			direction: "request",
			requestId: crypto.randomUUID(),
			operation,
			payload,
		};
	}

	async request<T extends SandboxOperation>(
		operation: T,
		payload: SandboxOperationPayloadMap[T],
		timeoutMs: number = this.options.requestTimeoutMs,
	): Promise<SandboxOperationResultMap[T]> {
		await this.initialize();
		if (!this.iframe?.contentWindow) {
			throw new Error("Sandbox iframe is not available.");
		}

		const request = this.buildRequest(operation, payload);

		return new Promise<SandboxOperationResultMap[T]>((resolve, reject) => {
			const timeoutId = window.setTimeout(() => {
				this.pending.delete(request.requestId);
				reject(
					new Error(
						`Sandbox request timed out (${operation}) after ${timeoutMs}ms`,
					),
				);
			}, timeoutMs);

			this.pending.set(request.requestId, {
				timeoutId,
				resolve: (value) => resolve(value as SandboxOperationResultMap[T]),
				reject,
				operation,
			});

			this.iframe?.contentWindow?.postMessage(request, "*");
		});
	}

	async dispose(): Promise<void> {
		for (const [, pending] of this.pending) {
			window.clearTimeout(pending.timeoutId);
			pending.reject(new Error("Sandbox service disposed."));
		}
		this.pending.clear();

		if (typeof window !== "undefined") {
			window.removeEventListener("message", this.onMessage);
			window.removeEventListener("message", this.onFsMessage);
		}

		if (this.iframe) {
			this.iframe.remove();
			this.iframe = null;
		}

		this.initialized = false;
		this.initializedAt = null;
		logInfo("🧹 SandboxContainerService disposed");
	}

	async resetRuntime(): Promise<void> {
		try {
			await this.request("runtime.reset", undefined);
		} catch (error) {
			logWarn("Sandbox runtime reset request failed", error);
		}
	}

	async executeCode(
		request: SandboxExecutionRequest,
	): Promise<SandboxExecutionResult> {
		return this.executeWithLazyDocumentsSupport("runtime.executeCode", request);
	}

	async health(): Promise<SandboxOperationResultMap["health"]> {
		return this.request("health", undefined);
	}

	async runFile(request: SandboxRunFileRequest): Promise<SandboxRunFileResult> {
		return this.executeWithLazyDocumentsSupport("runtime.runFile", {
			...request,
			path: this.normalizeVirtualPath(request.path),
		});
	}

	async createRepl(): Promise<SandboxOperationResultMap["runtime.createRepl"]> {
		return this.request("runtime.createRepl", undefined);
	}

	async replEval(
		request: SandboxOperationPayloadMap["runtime.replEval"],
	): Promise<SandboxExecutionResult> {
		return this.request("runtime.replEval", request);
	}

	async getLogs(
		request: SandboxGetLogsRequest = {},
	): Promise<SandboxGetLogsResult> {
		return this.request("runtime.getLogs", request);
	}

	async clearLogs(): Promise<{ cleared: true }> {
		return this.request("runtime.clearLogs", undefined);
	}

	async fetchResource(
		request: SandboxNetworkFetchRequest,
	): Promise<SandboxNetworkFetchResult> {
		return this.request("network.fetch", request);
	}

	async writeFile(
		request: SandboxFsWriteFileRequest,
	): Promise<{ path: string }> {
		const normalizedPath = this.normalizeVirtualPath(request.path);
		const workspacePath = this.toWorkspaceCanonicalPath(normalizedPath);
		if (this.isWorkspacePath(normalizedPath)) {
			await this.syncWorkspaceMount();
			await documentFileSystemService.writeWorkspaceFile(
				workspacePath,
				request.content,
			);
		}
		return this.request("fs.writeFile", {
			...request,
			path: workspacePath,
		});
	}

	async readFile(
		request: SandboxFsReadFileRequest,
	): Promise<SandboxFsReadFileResult> {
		const normalizedPath = this.normalizeVirtualPath(request.path);
		const workspacePath = this.toWorkspaceCanonicalPath(normalizedPath);
		if (this.isDocumentsPath(normalizedPath)) {
			await this.syncDocumentsMount();
			const logicalPath = this.toDocumentsLogicalPath(normalizedPath);
			if (logicalPath) {
				const bytes =
					await documentFileSystemService.getFileContent(logicalPath);
				const content = new TextDecoder().decode(bytes);
				await this.request("fs.materializeDocumentFile", {
					path: normalizedPath,
					content,
				});
				return this.request("fs.readFile", { path: normalizedPath });
			}
		}
		if (this.isWorkspacePath(normalizedPath)) {
			await this.syncWorkspaceMount();
			const bytes =
				await documentFileSystemService.getWorkspaceFileContent(workspacePath);
			const content = new TextDecoder().decode(bytes);
			await this.request("fs.materializeWorkspaceFile", {
				path: workspacePath,
				content,
			});
			return this.request("fs.readFile", { path: workspacePath });
		}
		return this.request("fs.readFile", { path: workspacePath });
	}

	async mkdir(request: SandboxFsMkdirRequest): Promise<{ path: string }> {
		const normalizedPath = this.normalizeVirtualPath(request.path);
		const workspacePath = this.toWorkspaceCanonicalPath(normalizedPath);
		if (this.isWorkspacePath(normalizedPath)) {
			await this.syncWorkspaceMount();
			await documentFileSystemService.mkdirWorkspace(workspacePath);
		}
		return this.request("fs.mkdir", { ...request, path: workspacePath });
	}

	async readdir(
		request: SandboxFsReaddirRequest,
	): Promise<SandboxFsReaddirResult> {
		const normalizedPath = this.normalizeVirtualPath(request.path);
		const workspacePath = this.toWorkspaceCanonicalPath(normalizedPath);
		if (this.isDocumentsPath(normalizedPath)) {
			await this.syncDocumentsMount();
		} else if (this.isWorkspacePath(normalizedPath)) {
			await this.syncWorkspaceMount();
		}
		return this.request("fs.readdir", { path: workspacePath });
	}

	async unlink(request: SandboxFsUnlinkRequest): Promise<{ path: string }> {
		const normalizedPath = this.normalizeVirtualPath(request.path);
		const workspacePath = this.toWorkspaceCanonicalPath(normalizedPath);
		if (this.isWorkspacePath(normalizedPath)) {
			await this.syncWorkspaceMount();
			await documentFileSystemService.deleteWorkspaceFile(workspacePath);
		}
		return this.request("fs.unlink", { ...request, path: workspacePath });
	}

	async rename(
		request: SandboxFsRenameRequest,
	): Promise<{ oldPath: string; newPath: string }> {
		const oldPath = this.toWorkspaceCanonicalPath(
			this.normalizeVirtualPath(request.oldPath),
		);
		const newPath = this.toWorkspaceCanonicalPath(
			this.normalizeVirtualPath(request.newPath),
		);
		if (this.isWorkspacePath(oldPath)) {
			await this.syncWorkspaceMount();
			const newName = newPath.split("/").pop()!;
			await documentFileSystemService.renameWorkspaceFile(oldPath, newName);
		}
		return this.request("fs.rename", { oldPath, newPath });
	}

	async exists(
		request: SandboxFsExistsRequest,
	): Promise<SandboxFsExistsResult> {
		const normalizedPath = this.normalizeVirtualPath(request.path);
		const workspacePath = this.toWorkspaceCanonicalPath(normalizedPath);
		if (this.isDocumentsPath(normalizedPath)) {
			await this.syncDocumentsMount();
		} else if (this.isWorkspacePath(normalizedPath)) {
			await this.syncWorkspaceMount();
		}
		return this.request("fs.exists", { path: workspacePath });
	}

	private isDocumentsPath(path: string): boolean {
		return path === "/documents" || path.startsWith("/documents/");
	}

	private toDocumentsLogicalPath(normalizedPath: string): string | null {
		if (normalizedPath === "/documents") return "/";
		if (normalizedPath.startsWith("/documents/")) {
			return normalizedPath.slice("/documents".length) || "/";
		}
		return null;
	}

	private normalizeVirtualPath(inputPath: string): string {
		const raw = inputPath.trim().replace(/\\/g, "/");
		if (!raw) return "/";
		const candidate = raw.startsWith("/") ? raw : `/${raw}`;
		const parts = candidate.split("/").filter(Boolean);
		const resolved: string[] = [];
		for (const part of parts) {
			if (part === ".") continue;
			if (part === "..") {
				resolved.pop();
				continue;
			}
			resolved.push(part);
		}
		return resolved.length ? `/${resolved.join("/")}` : "/";
	}

	private async syncDocumentsMount(): Promise<void> {
		if (this.mountDocumentsSyncPromise) {
			return this.mountDocumentsSyncPromise;
		}

		this.mountDocumentsSyncPromise = (async () => {
			const mountSnapshot =
				await documentFileSystemService.getSandboxMountSnapshot();
			await this.request("fs.mountDocuments", mountSnapshot);
		})().finally(() => {
			this.mountDocumentsSyncPromise = null;
		});

		return this.mountDocumentsSyncPromise;
	}

	private extractUnmaterializedMountedPath(
		errorMessage?: string,
	): string | null {
		if (!errorMessage) return null;
		const match = errorMessage.match(
			/Mounted file is not materialized in sandbox runtime: (\/documents\/[^\s]+)/,
		);
		return match?.[1] ?? null;
	}

	private isDocumentsMountNotLoadedError(errorMessage?: string): boolean {
		if (!errorMessage) return false;
		return errorMessage.includes(
			"Documents mount is not loaded in sandbox runtime",
		);
	}

	private async materializeMountedDocumentFile(
		sandboxPath: string,
	): Promise<boolean> {
		const logicalPath = this.toDocumentsLogicalPath(sandboxPath);
		if (!logicalPath || logicalPath === "/") {
			return false;
		}
		try {
			const bytes = await documentFileSystemService.getFileContent(logicalPath);
			const content = new TextDecoder().decode(bytes);
			await this.request("fs.materializeDocumentFile", {
				path: sandboxPath,
				content,
			});
			return true;
		} catch (error) {
			logWarn("Failed to lazily materialize mounted document file", {
				sandboxPath,
				logicalPath,
				error,
			});
			return false;
		}
	}

	// ── Workspace helpers ────────────────────────────────────────────────────

	private isWorkspacePath(path: string): boolean {
		return (
			path === WORKSPACES_ROOT ||
			path.startsWith(`${WORKSPACES_ROOT}/`) ||
			path === WORKSPACE_LEGACY_ROOT ||
			path.startsWith(`${WORKSPACE_LEGACY_ROOT}/`)
		);
	}

	private toWorkspaceCanonicalPath(path: string): string {
		if (path === WORKSPACE_LEGACY_ROOT) return WORKSPACES_ROOT;
		if (path.startsWith(`${WORKSPACE_LEGACY_ROOT}/`)) {
			return `${WORKSPACES_ROOT}${path.slice(WORKSPACE_LEGACY_ROOT.length)}`;
		}
		return path;
	}

	private async syncWorkspaceMount(): Promise<void> {
		if (this.mountWorkspaceSyncPromise) {
			return this.mountWorkspaceSyncPromise;
		}
		this.mountWorkspaceSyncPromise = (async () => {
			const snapshot =
				await documentFileSystemService.getSandboxWorkspaceMountSnapshot();
			await this.request("fs.mountWorkspace", snapshot);
		})().finally(() => {
			this.mountWorkspaceSyncPromise = null;
		});
		return this.mountWorkspaceSyncPromise;
	}

	private async materializeMountedWorkspaceFile(
		sandboxPath: string,
	): Promise<boolean> {
		try {
			const bytes =
				await documentFileSystemService.getWorkspaceFileContent(sandboxPath);
			const content = new TextDecoder().decode(bytes);
			await this.request("fs.materializeWorkspaceFile", {
				path: sandboxPath,
				content,
			});
			return true;
		} catch (error) {
			logWarn("Failed to lazily materialize workspace file", {
				sandboxPath,
				error,
			});
			return false;
		}
	}

	private extractUnmaterializedWorkspacePath(
		errorMessage?: string,
	): string | null {
		if (!errorMessage) return null;
		const match = errorMessage.match(
			/Workspace file not materialized: (\/workspaces\/[^\s]+|\/workspace\/[^\s]+)/,
		);
		return match?.[1] ? this.toWorkspaceCanonicalPath(match[1]) : null;
	}

	private isWorkspaceMountNotLoadedError(errorMessage?: string): boolean {
		if (!errorMessage) return false;
		return errorMessage.includes(
			"Workspace mount is not loaded in sandbox runtime",
		);
	}

	/** Drain pending workspace writes/deletes/renames and persist to ZenFS. */
	private async flushWorkspaceWrites(): Promise<void> {
		const { ops } = await this.request("fs.flushWorkspaceWrites", undefined);
		for (const op of ops) {
			try {
				if (op.op === "write") {
					await documentFileSystemService.writeWorkspaceFile(
						op.path,
						op.content,
					);
				} else if (op.op === "delete") {
					await documentFileSystemService.deleteWorkspaceFile(op.path);
				} else if (op.op === "rename") {
					const newName = op.newPath.split("/").pop()!;
					await documentFileSystemService.renameWorkspaceFile(
						op.oldPath,
						newName,
					);
				}
			} catch (error) {
				logWarn("Failed to flush workspace op", { op, error });
			}
		}
	}

	// ── End Workspace helpers ─────────────────────────────────────────────────

	private async executeWithLazyDocumentsSupport<
		T extends "runtime.executeCode" | "runtime.runFile",
	>(
		operation: T,
		payload: SandboxOperationPayloadMap[T],
	): Promise<SandboxOperationResultMap[T]> {
		const maxRetries = 5;
		const retriedPaths = new Set<string>();
		let hasMountedDocuments = false;
		let hasMountedWorkspace = false;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			const result = await this.request(operation, payload);
			if (result.status !== "error") {
				await this.flushWorkspaceWrites().catch((err) =>
					logWarn("Failed to flush workspace writes after execution", { err }),
				);
				return result;
			}

			if (this.isDocumentsMountNotLoadedError(result.error)) {
				if (hasMountedDocuments) return result;
				await this.syncDocumentsMount();
				hasMountedDocuments = true;
				continue;
			}

			if (this.isWorkspaceMountNotLoadedError(result.error)) {
				if (hasMountedWorkspace) return result;
				await this.syncWorkspaceMount();
				hasMountedWorkspace = true;
				continue;
			}

			const missingDocPath = this.extractUnmaterializedMountedPath(
				result.error,
			);
			if (missingDocPath && !retriedPaths.has(missingDocPath)) {
				retriedPaths.add(missingDocPath);
				const materialized =
					await this.materializeMountedDocumentFile(missingDocPath);
				if (materialized) continue;
				return result;
			}

			const missingWsPath = this.extractUnmaterializedWorkspacePath(
				result.error,
			);
			if (missingWsPath && !retriedPaths.has(missingWsPath)) {
				retriedPaths.add(missingWsPath);
				const materialized =
					await this.materializeMountedWorkspaceFile(missingWsPath);
				if (materialized) continue;
				return result;
			}

			return result;
		}

		return this.request(operation, payload);
	}

	async installPackage(
		request: SandboxNpmInstallRequest,
	): Promise<SandboxNpmInstallResult> {
		return this.request("npm.install", request);
	}

	async installFromPackageJson(
		request: SandboxNpmInstallFromPackageJsonRequest = {},
	): Promise<SandboxNpmInstallResult> {
		return this.request("npm.installFromPackageJson", request);
	}

	async listInstalledPackages(): Promise<SandboxNpmListResult> {
		return this.request("npm.list", undefined);
	}

	/**
	 * Resolve a relative renderUrl (e.g. "/sandbox/__virtual__/3000/") to a
	 * fully-qualified chrome-extension URL so popup iframes can navigate to it
	 * via the almostnode service worker.
	 */
	private resolveRenderUrl(rawUrl: string): string {
		if (
			rawUrl.startsWith("/") &&
			typeof chrome !== "undefined" &&
			typeof chrome.runtime?.getURL === "function"
		) {
			const base = chrome.runtime.getURL("").replace(/\/$/, "");
			return base + rawUrl;
		}
		return rawUrl;
	}

	private buildVirtualServerUrl(port: number, path: string): string {
		return (
			chrome.runtime.getURL("") +
			`__virtual__/${port}${path.startsWith("/") ? path : `/${path}`}`
		);
	}

	private async buildRendererImportMap(
		port: number,
	): Promise<Record<string, string>> {
		let rendererImportMap: Record<string, string> = {};

		try {
			const { servers } = await this.request("server.list", undefined);
			const serverInfo = servers.find((server) => server.port === port);
			logInfo(
				`[renderViaIframe] server rootDir=${serverInfo?.rootDir ?? "unknown"} for port=${port}`,
			);
			if (!serverInfo?.rootDir) {
				return rendererImportMap;
			}

			const pkgPath = `${serverInfo.rootDir.replace(/\/$/, "")}/package.json`;
			logInfo(`[renderViaIframe] reading package.json from ${pkgPath}`);

			try {
				const pkgResult = await this.request("fs.readFile", {
					path: pkgPath,
				});
				const pkg = JSON.parse(pkgResult.content) as {
					dependencies?: Record<string, string>;
					devDependencies?: Record<string, string>;
				};
				const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
				const imports: Record<string, string> = {};
				const virtualPrefix = `/__virtual__/${port}`;
				const toProxyModule = (url: string) =>
					`${virtualPrefix}/__npm_proxy__/${encodeURIComponent(url)}`;

				for (const [name, rawVer] of Object.entries(allDeps)) {
					const ver =
						String(rawVer)
							.replace(/^[\^~>=<*\s]+/, "")
							.split(/\s/)[0] || "latest";
					imports[name] = toProxyModule(`https://esm.sh/${name}@${ver}?bundle`);
					if (name === "react") {
						imports["react/jsx-runtime"] = toProxyModule(
							`https://esm.sh/react@${ver}/jsx-runtime?bundle`,
						);
						imports["react/jsx-dev-runtime"] = toProxyModule(
							`https://esm.sh/react@${ver}/jsx-dev-runtime?bundle`,
						);
					}
					if (name === "react-dom") {
						imports["react-dom/client"] = toProxyModule(
							`https://esm.sh/react-dom@${ver}/client?bundle`,
						);
						imports["react-dom/server"] = toProxyModule(
							`https://esm.sh/react-dom@${ver}/server?bundle`,
						);
					}
				}

				rendererImportMap = imports;
				logInfo(
					`[renderViaIframe] import map built for: [${Object.keys(imports).join(", ")}]`,
				);
			} catch (fsErr) {
				logWarn(`[renderViaIframe] could not read ${pkgPath}:`, fsErr);
			}
		} catch (listErr) {
			logWarn(
				"[renderViaIframe] could not fetch server list for import map:",
				listErr,
			);
		}

		return rendererImportMap;
	}

	private async buildRendererPreviewConfig(
		port: number,
		requestPath: string | undefined,
	): Promise<RendererPreviewConfig> {
		const path = requestPath ?? "/";
		const virtualUrl = this.buildVirtualServerUrl(port, path);
		const importMap = await this.buildRendererImportMap(port);
		const rendererUrl =
			chrome.runtime.getURL("sandbox/pages/renderer.html") +
			`?port=${port}&path=${encodeURIComponent(path)}&importMap=${encodeURIComponent(JSON.stringify(importMap))}`;

		return {
			path,
			virtualUrl,
			rendererUrl,
			importMap,
		};
	}

	private resolveServerEntryPath(
		rootDir: string | undefined,
		entryPath: string | undefined,
	): string | undefined {
		if (!entryPath) {
			return undefined;
		}

		const normalizedEntry = this.normalizeVirtualPath(entryPath);
		if (entryPath.startsWith("/")) {
			return normalizedEntry;
		}

		const normalizedRoot = rootDir
			? this.normalizeVirtualPath(rootDir)
			: undefined;
		if (!normalizedRoot || normalizedRoot === "/") {
			return normalizedEntry;
		}

		const relativeEntry = normalizedEntry.replace(/^\/+/, "");
		return this.normalizeVirtualPath(`${normalizedRoot}/${relativeEntry}`);
	}

	async startServer(
		request: SandboxStartServerRequest,
	): Promise<SandboxStartServerResult> {
		const resolvedEntryPath = this.resolveServerEntryPath(
			request.rootDir,
			request.entryPath,
		);

		if (request.rootDir && this.isWorkspacePath(request.rootDir)) {
			await this.syncWorkspaceMount();
		}

		if (resolvedEntryPath && this.isWorkspacePath(resolvedEntryPath)) {
			await this.materializeMountedWorkspaceFile(resolvedEntryPath);
		}

		// Allow extra time when a template will be scaffolded + npm-installed.
		const timeoutMs = request.template ? 300_000 : 60_000;
		const result = await this.request(
			"server.start",
			{
				...request,
				entryPath: resolvedEntryPath,
			},
			timeoutMs,
		);
		// Flush any sync writes (scaffolded template files) that queued via
		// pendingWorkspaceOps but weren't persisted by the async bridge yet.
		await this.flushWorkspaceWrites().catch((err) =>
			logWarn("Failed to flush workspace writes after server.start", { err }),
		);
		return { ...result, renderUrl: this.resolveRenderUrl(result.renderUrl) };
	}

	async stopServer(
		request: SandboxStopServerRequest,
	): Promise<{ port: number }> {
		return this.request("server.stop", request);
	}

	async listServers(): Promise<SandboxListServersResult> {
		return this.request("server.list", undefined);
	}

	async requestServer(
		request: SandboxServerRequest,
	): Promise<SandboxServerRequestResult> {
		if (request.useIframe) {
			return this.renderViaIframe(request);
		}
		return this.request(
			"server.request",
			request,
			request.timeoutMs ?? 120_000,
		);
	}

	/**
	 * Render a virtual server page and return the fully rendered HTML.
	 *
	 * We load /sandbox/pages/renderer.html (a normal extension page within the SW's
	 * /sandbox/ scope). The renderer fetches /__virtual__/<port>/* — the SW
	 * intercepts those fetches and relays them to the sandbox via
	 * server.handleSwRequest → handleRequest. Once React mounts, the renderer
	 * sends a postMessage back with the final outerHTML.
	 */
	private async renderViaIframe(
		request: SandboxServerRequest,
	): Promise<SandboxServerRequestResult> {
		// The SW is killed by Chrome when idle and restarts with mainPort=null.
		// Re-send the relay port before the renderer iframe makes any fetches.
		const sw =
			this.swInstance ??
			navigator.serviceWorker.controller ??
			(await navigator.serviceWorker.ready).active;
		if (sw) {
			this.initSwRelay(sw);
			// Wait for the SW to wake up, receive the port message, and set
			// mainPort before the renderer iframe makes its first fetch.
			await new Promise<void>((r) => setTimeout(r, 200));
		}

		const previewConfig = await this.buildRendererPreviewConfig(
			request.port,
			request.path,
		);
		const { virtualUrl, rendererUrl, importMap } = previewConfig;
		const timeoutMs = request.timeoutMs ?? 120_000;
		// Unique ID to match the postMessage from renderer-utils.js.
		// Passed via iframe.name (survives document.write inside the renderer).
		const renderId = Math.random().toString(36).slice(2, 10);

		if (Object.keys(importMap).length > 0) {
			sw?.postMessage({
				type: "set-import-map",
				data: { port: request.port, importMap },
			});
		}

		return new Promise<SandboxServerRequestResult>((resolve) => {
			const iframe = document.createElement("iframe");
			iframe.style.cssText =
				"position:fixed;top:-9999px;left:-9999px;width:1280px;height:800px;opacity:0;pointer-events:none;";
			// window.name in the renderer survives document.write; used by
			// renderer-utils.js to include the renderId in its postMessage.
			iframe.name = renderId;

			let settled = false;
			const settle = (html: string, keepIframe = false) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeoutId);
				window.removeEventListener("message", messageHandler);
				if (!keepIframe) iframe.remove();
				resolve({
					port: request.port,
					url: virtualUrl,
					status: 200,
					ok: true,
					contentType: "text/html",
					responseType: "html",
					headers: {},
					body: html,
				});
			};

			// renderer-utils.js postMessages once React has mounted.
			// renderer.js also relays SW fetch requests through this handler.
			const messageHandler = (event: MessageEvent) => {
				if (
					event.data?.type === "virtual-renderer-ready" &&
					event.data.renderId === renderId
				) {
					settle((event.data.html as string) ?? "");
					return;
				}

				if (
					event.data?.type === "sw-relay-request" &&
					event.source === iframe.contentWindow
				) {
					const {
						id,
						portNum,
						method,
						url: swUrl,
						headers,
						body,
					} = event.data as {
						id: number;
						portNum: number;
						method: string;
						url: string;
						headers: Record<string, string>;
						body: ArrayBuffer | null;
					};
					void this.handleSwRequestWithRetry({
						id,
						port: portNum,
						method,
						path: swUrl,
						headers: headers ?? {},
						body: body ?? null,
					})
						.then((result) => {
							iframe.contentWindow?.postMessage(
								{ type: "sw-relay-response", id, data: result },
								"*",
							);
						})
						.catch((err: unknown) => {
							iframe.contentWindow?.postMessage(
								{
									type: "sw-relay-response",
									id,
									error: err instanceof Error ? err.message : String(err),
								},
								"*",
							);
						});
				}
			};
			window.addEventListener("message", messageHandler);

			const timeoutId = window.setTimeout(() => {
				logWarn(
					"[renderViaIframe] Timeout — keeping iframe alive for inspection. Check devtools for the hidden iframe.",
				);
				// DEBUG: pass true so settle() does NOT remove the iframe.
				// Revert: change settle("", true) back to settle("") when done debugging.
				settle("", true);
			}, timeoutMs);

			document.body.appendChild(iframe);
			iframe.src = rendererUrl;
		});
	}

	async getServerRenderUrl(
		request: SandboxServerRenderUrlRequest,
	): Promise<SandboxServerRenderUrlResult> {
		const previewConfig = await this.buildRendererPreviewConfig(
			request.port,
			request.path,
		);
		return { port: request.port, url: previewConfig.rendererUrl };
	}

	async getSnapshot(): Promise<{ snapshot: unknown }> {
		return this.request("snapshot.get", undefined);
	}

	async restoreSnapshot(
		request: SandboxRestoreSnapshotRequest,
	): Promise<{ restored: true }> {
		return this.request("snapshot.restore", request, 60_000);
	}
}

export { SandboxContainerServiceMain as SandboxContainerService };

export const sandboxContainerMainService =
	SandboxContainerServiceMain.getInstance();

export const ensureSandboxContainerMainReady = async (): Promise<void> => {
	try {
		await sandboxContainerMainService.initialize();
	} catch (error) {
		logError("Failed to initialize SandboxContainerServiceMain", error);
		throw error;
	}
};
