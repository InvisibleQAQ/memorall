import { logError, logInfo, logWarn } from "@/utils/logger";
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
	SandboxResponseMessage,
} from "./types";

interface PendingRequest {
	timeoutId: number;
	resolve: (value: unknown) => void;
	reject: (reason?: unknown) => void;
	operation: SandboxOperation;
}

export interface SandboxContainerInitOptions {
	frameUrl?: string;
	loadTimeoutMs?: number;
	requestTimeoutMs?: number;
}

const SANDBOX_CHANNEL = "memorall-sandbox-container" as const;
const DEFAULT_FRAME_URL = "sandbox/sandbox-container-runtime.html";
const DEFAULT_LOAD_TIMEOUT_MS = 20_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

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

export class SandboxContainerService {
	private static instance: SandboxContainerService;

	private iframe: HTMLIFrameElement | null = null;
	private initialized = false;
	private initializing: Promise<void> | null = null;
	private initializedAt: number | null = null;
	private readonly pending = new Map<string, PendingRequest>();
	private readonly options: Required<SandboxContainerInitOptions>;

	private constructor(options: SandboxContainerInitOptions = {}) {
		this.options = {
			frameUrl: options.frameUrl ?? DEFAULT_FRAME_URL,
			loadTimeoutMs: options.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS,
			requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
		};
	}

	static getInstance(
		options?: SandboxContainerInitOptions,
	): SandboxContainerService {
		if (!SandboxContainerService.instance) {
			SandboxContainerService.instance = new SandboxContainerService(options);
		}
		return SandboxContainerService.instance;
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
			throw new Error("SandboxContainerService requires chrome.runtime.getURL.");
		}

		window.addEventListener("message", this.onMessage);

		const iframe = document.createElement("iframe");
		iframe.style.display = "none";
		iframe.sandbox.add("allow-scripts");
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
		return this.request("runtime.executeCode", request);
	}

	async health(): Promise<SandboxOperationResultMap["health"]> {
		return this.request("health", undefined);
	}

	async runFile(request: SandboxRunFileRequest): Promise<SandboxRunFileResult> {
		return this.request("runtime.runFile", request);
	}

	async createRepl(): Promise<SandboxOperationResultMap["runtime.createRepl"]> {
		return this.request("runtime.createRepl", undefined);
	}

	async replEval(
		request: SandboxOperationPayloadMap["runtime.replEval"],
	): Promise<SandboxExecutionResult> {
		return this.request("runtime.replEval", request);
	}

	async getLogs(request: SandboxGetLogsRequest = {}): Promise<SandboxGetLogsResult> {
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
		return this.request("fs.writeFile", request);
	}

	async readFile(
		request: SandboxFsReadFileRequest,
	): Promise<SandboxFsReadFileResult> {
		return this.request("fs.readFile", request);
	}

	async mkdir(request: SandboxFsMkdirRequest): Promise<{ path: string }> {
		return this.request("fs.mkdir", request);
	}

	async readdir(
		request: SandboxFsReaddirRequest,
	): Promise<SandboxFsReaddirResult> {
		return this.request("fs.readdir", request);
	}

	async unlink(request: SandboxFsUnlinkRequest): Promise<{ path: string }> {
		return this.request("fs.unlink", request);
	}

	async rename(
		request: SandboxFsRenameRequest,
	): Promise<{ oldPath: string; newPath: string }> {
		return this.request("fs.rename", request);
	}

	async exists(
		request: SandboxFsExistsRequest,
	): Promise<SandboxFsExistsResult> {
		return this.request("fs.exists", request);
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

	async startServer(
		request: SandboxStartServerRequest,
	): Promise<SandboxStartServerResult> {
		return this.request("server.start", request, 60_000);
	}

	async stopServer(
		request: SandboxStopServerRequest,
	): Promise<{ port: number }> {
		return this.request("server.stop", request);
	}

	async listServers(): Promise<SandboxListServersResult> {
		return this.request("server.list", undefined);
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

export const sandboxContainerService = SandboxContainerService.getInstance();

export const ensureSandboxContainerReady = async (): Promise<void> => {
	try {
		await sandboxContainerService.initialize();
	} catch (error) {
		logError("Failed to initialize SandboxContainerService", error);
		throw error;
	}
};
