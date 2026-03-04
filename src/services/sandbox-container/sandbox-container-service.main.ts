/**
 * SandboxContainerMainService
 *
 * Runs AlmostNode directly in the same JS thread (offscreen document) instead
 * of communicating with it via a sandboxed iframe + postMessage bridge.
 *
 * Benefits vs iframe version:
 *   - server.request works without a Service Worker — AlmostNode patches
 *     globalThis.fetch in this thread, so http://127.0.0.1:<port>/ requests
 *     are intercepted and handled in-memory.
 *   - No cross-origin messaging latency.
 *   - No manifest sandbox page restrictions.
 *
 * ⚠  CSP limitation:
 *   - runtime.executeCode / runtime.runFile call container.execute() which
 *     uses eval / Function() internally.  These will throw a CSP violation in
 *     extension_pages because 'unsafe-eval' is not allowed there.
 *   - server.start for "express" also calls c.runFile() → same limitation.
 *   - server.start for "vite" / "next" does NOT call eval directly; the
 *     template compilation is handled inside AlmostNode's pre-compiled WASM /
 *     bundled runtime.  Those operations should work fine.
 */

import { logError, logInfo, logWarn } from "@/utils/logger";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import type { ISandboxContainerService } from "./sandbox-container-service.interface";
import type {
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
	SandboxGetLogsRequest,
	SandboxGetLogsResult,
	SandboxHealthResult,
	SandboxListServersResult,
	SandboxLogEntry,
	SandboxNetworkFetchRequest,
	SandboxNetworkFetchResult,
	SandboxNpmInstallFromPackageJsonRequest,
	SandboxNpmInstallRequest,
	SandboxNpmInstallResult,
	SandboxNpmListResult,
	SandboxRestoreSnapshotRequest,
	SandboxRunFileRequest,
	SandboxRunFileResult,
	SandboxServerInfo,
	SandboxServerRequest,
	SandboxServerRequestResult,
	SandboxServerRenderUrlRequest,
	SandboxServerRenderUrlResult,
	SandboxSnapshotResult,
	SandboxStartServerRequest,
	SandboxStartServerResult,
	SandboxStopServerRequest,
} from "./types";

// ---------------------------------------------------------------------------
// AlmostNode module shape (inferred from sandbox-container-runtime.js usage)
// ---------------------------------------------------------------------------

interface AlmostNodeVfs {
	existsSync(path: string): boolean;
	readFileSync(path: string, encoding?: string): string | Uint8Array;
	writeFileSync(path: string, data: string | Uint8Array): void;
	mkdirSync(path: string, options?: { recursive?: boolean }): void;
	unlinkSync(path: string): void;
	renameSync(oldPath: string, newPath: string): void;
	readdirSync(path: string): string[];
	toSnapshot(): unknown;
}

interface AlmostNodeContainer {
	vfs: AlmostNodeVfs;
	runtime: unknown;
	execute(code: string, filename?: string): Promise<unknown>;
	runFile(path: string): Promise<unknown>;
	npm: {
		install(spec: string, opts: Record<string, unknown>): Promise<Record<string, string>>;
		installFromPackageJson(opts?: { save?: boolean; saveDev?: boolean }): Promise<Record<string, string>>;
		listInstalled?(): Promise<Record<string, string>>;
	};
}

interface AlmostNodeServerBridge {
	getServerUrl?(port: number): string | undefined;
	initServiceWorker?(): Promise<void>;
	unregisterServer?(port: number): void;
}

interface AlmostNodeViteDevServer {
	start(): Promise<void>;
	stop(): Promise<void>;
}

interface AlmostNodeNextServer {
	start(): Promise<void>;
	stop(): Promise<void>;
}

interface AlmostNodeModule {
	__tla?: Promise<void>;
	createContainer(options: {
		cwd: string;
		onConsole: (level: string, args: unknown[]) => void;
	}): AlmostNodeContainer;
	getServerBridge?(): AlmostNodeServerBridge | null;
	ViteDevServer?: new (
		runtime: unknown,
		vfs: AlmostNodeVfs,
		options: Record<string, unknown>,
	) => AlmostNodeViteDevServer;
	NextDevServer?: new (options: Record<string, unknown>) => AlmostNodeNextServer;
}

// ---------------------------------------------------------------------------
// Constants (mirrored from sandbox-container-runtime.js)
// ---------------------------------------------------------------------------

const WORKSPACES_ROOT = "/workspaces";
const WORKSPACE_LEGACY_ROOT = "/workspace";
const DOCUMENTS_MOUNT_ROOT = "/documents";
const MAX_RUNTIME_LOG_ENTRIES = 500;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

const TEMPLATE_INSTALL_SPECS: Record<string, string[] | null> = {
	express: null,
	"vite-react": ["react", "react-dom", "vite", "@vitejs/plugin-react"],
	"next-pages": ["next", "react", "react-dom"],
	"next-app": ["next", "react", "react-dom"],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizePath = (p: string): string => {
	const raw = (p ?? "").trim().replace(/\\/g, "/");
	if (!raw) return "/";
	const candidate = raw.startsWith("/") ? raw : `/${raw}`;
	const parts = candidate.split("/").filter(Boolean);
	const resolved: string[] = [];
	for (const part of parts) {
		if (part === ".") continue;
		if (part === "..") { resolved.pop(); continue; }
		resolved.push(part);
	}
	return resolved.length ? `/${resolved.join("/")}` : "/";
};

const dirname = (p: string): string => {
	const idx = p.lastIndexOf("/");
	return idx <= 0 ? "/" : p.slice(0, idx);
};

const isDocumentsPath = (p: string): boolean =>
	p === DOCUMENTS_MOUNT_ROOT || p.startsWith(`${DOCUMENTS_MOUNT_ROOT}/`);

const isWorkspacePath = (p: string): boolean =>
	p === WORKSPACES_ROOT ||
	p.startsWith(`${WORKSPACES_ROOT}/`) ||
	p === WORKSPACE_LEGACY_ROOT ||
	p.startsWith(`${WORKSPACE_LEGACY_ROOT}/`);

const toWorkspaceCanonical = (p: string): string => {
	if (p === WORKSPACE_LEGACY_ROOT) return WORKSPACES_ROOT;
	if (p.startsWith(`${WORKSPACE_LEGACY_ROOT}/`))
		return `${WORKSPACES_ROOT}${p.slice(WORKSPACE_LEGACY_ROOT.length)}`;
	return p;
};

const resolveResponseType = (
	contentType: string,
	requested: string,
): "json" | "text" | "html" => {
	if (requested !== "auto") return requested as "json" | "text" | "html";
	const ct = contentType.toLowerCase();
	if (ct.includes("application/json")) return "json";
	if (ct.includes("text/html")) return "html";
	return "text";
};

const fetchWithTimeout = async (
	url: string,
	init: RequestInit,
	timeoutMs: number,
): Promise<Response> => {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal, credentials: "omit" });
	} finally {
		clearTimeout(id);
	}
};

const safeSerialize = (value: unknown): string => {
	try {
		if (value instanceof Error) return value.message;
		if (typeof value === "string") return value;
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
};

// ---------------------------------------------------------------------------
// Server state
// ---------------------------------------------------------------------------

interface ServerState {
	kind: string;
	port: number;
	url: string;
	renderUrl: string;
	stop: () => Promise<void>;
}

const toServerInfo = (s: ServerState): SandboxServerInfo => ({
	kind: s.kind as SandboxServerInfo["kind"],
	port: s.port,
	url: s.url,
	renderUrl: s.renderUrl,
});

// ---------------------------------------------------------------------------
// Main service class
// ---------------------------------------------------------------------------

export class SandboxContainerMainService implements ISandboxContainerService {
	private static instance: SandboxContainerMainService;

	private lib: AlmostNodeModule | null = null;
	private container: AlmostNodeContainer | null = null;
	private initialized = false;
	private initializing: Promise<void> | null = null;
	private initializedAt: number | null = null;

	// Runtime state
	private readonly runtimeLogs: SandboxLogEntry[] = [];
	private readonly servers = new Map<number, ServerState>();
	private readonly installedPackages = new Map<string, string>();
	private readonly mountedDocumentFiles = new Set<string>();
	private readonly mountedDocumentDirectories = new Set<string>();
	private readonly mountedWorkspaceFiles = new Set<string>();
	private readonly mountedWorkspaceDirectories = new Set<string>();
	private readonly materializedDocFiles = new Map<string, string>();
	private readonly materializedWsFiles = new Map<string, string>();
	private readonly pendingWorkspaceOps: Array<{
		op: "write" | "delete" | "rename";
		path?: string;
		content?: string;
		oldPath?: string;
		newPath?: string;
	}> = [];
	private documentsMountLoaded = false;
	private workspaceMountLoaded = false;

	private mountDocumentsSyncPromise: Promise<void> | null = null;
	private mountWorkspaceSyncPromise: Promise<void> | null = null;

	static getInstance(): SandboxContainerMainService {
		if (!SandboxContainerMainService.instance) {
			SandboxContainerMainService.instance = new SandboxContainerMainService();
		}
		return SandboxContainerMainService.instance;
	}

	isReady(): boolean {
		return this.initialized && this.container !== null;
	}

	getInitializedAt(): number | null {
		return this.initializedAt;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		if (this.initializing) return this.initializing;
		this.initializing = this.initializeInternal();
		try {
			await this.initializing;
		} finally {
			this.initializing = null;
		}
	}

	private async initializeInternal(): Promise<void> {
		if (typeof chrome === "undefined" || !chrome.runtime?.getURL) {
			throw new Error("SandboxContainerMainService requires chrome.runtime.getURL.");
		}

		// Dynamic import — AlmostNode is a pre-built vendor bundle in /public/sandbox/
		const bundleUrl = chrome.runtime.getURL("sandbox/vendors/almostnode.bundle.js");
		this.lib = (await import(/* @vite-ignore */ bundleUrl)) as AlmostNodeModule;

		if (this.lib.__tla) await this.lib.__tla;

		if (typeof this.lib.createContainer !== "function") {
			throw new Error("almostnode.bundle.js did not export createContainer");
		}

		this.container = this.lib.createContainer({
			cwd: "/",
			onConsole: (level, args) => {
				const message = Array.isArray(args)
					? args.map(safeSerialize).join(" ")
					: safeSerialize(args);
				const entry: SandboxLogEntry = {
					level: level as SandboxLogEntry["level"],
					message,
					timestamp: Date.now(),
				};
				if (this.runtimeLogs.length >= MAX_RUNTIME_LOG_ENTRIES) {
					this.runtimeLogs.shift();
				}
				this.runtimeLogs.push(entry);
			},
		});

		this.initialized = true;
		this.initializedAt = Date.now();
		logInfo("✅ SandboxContainerMainService initialized (direct AlmostNode)");
	}

	async dispose(): Promise<void> {
		for (const state of this.servers.values()) {
			try { await state.stop(); } catch { /* ignore */ }
		}
		this.servers.clear();
		this.container = null;
		this.lib = null;
		this.initialized = false;
		this.initializedAt = null;
		logInfo("🧹 SandboxContainerMainService disposed");
	}

	private ensureContainer(): AlmostNodeContainer {
		if (!this.container) throw new Error("SandboxContainerMainService not initialized.");
		return this.container;
	}

	// ── Health ────────────────────────────────────────────────────────────────

	async health(): Promise<SandboxHealthResult> {
		await this.initialize();
		return { ready: this.isReady(), initializedAt: this.initializedAt };
	}

	async resetRuntime(): Promise<void> {
		try {
			for (const state of this.servers.values()) {
				try { await state.stop(); } catch { /* ignore */ }
			}
			this.servers.clear();
			this.installedPackages.clear();
			this.runtimeLogs.length = 0;
			this.documentsMountLoaded = false;
			this.workspaceMountLoaded = false;
			this.mountedDocumentFiles.clear();
			this.mountedDocumentDirectories.clear();
			this.mountedWorkspaceFiles.clear();
			this.mountedWorkspaceDirectories.clear();
			this.materializedDocFiles.clear();
			this.materializedWsFiles.clear();
			this.pendingWorkspaceOps.length = 0;

			// Re-create container to reset VFS state
			if (this.lib) {
				this.container = this.lib.createContainer({
					cwd: "/",
					onConsole: (level, args) => {
						const message = Array.isArray(args)
							? args.map(safeSerialize).join(" ")
							: safeSerialize(args);
						if (this.runtimeLogs.length >= MAX_RUNTIME_LOG_ENTRIES) {
							this.runtimeLogs.shift();
						}
						this.runtimeLogs.push({
							level: level as SandboxLogEntry["level"],
							message,
							timestamp: Date.now(),
						});
					},
				});
			}
		} catch (error) {
			logWarn("Sandbox runtime reset failed", error);
		}
	}

	// ── Runtime execution (⚠ needs unsafe-eval in CSP) ───────────────────────

	async executeCode(request: SandboxExecutionRequest): Promise<SandboxExecutionResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const startedAt = Date.now();
		const logs: SandboxLogEntry[] = [];
		try {
			// ⚠ c.execute() uses eval/Function() internally.
			// Will throw CSP violation in extension_pages (no 'unsafe-eval').
			const value = await c.execute(String(request.code), request.filename ?? "/index.js");
			const resultValue =
				value && typeof value === "object" && "exports" in value
					? (value as { exports: unknown }).exports
					: value;
			return {
				status: "ok",
				durationMs: Date.now() - startedAt,
				result: safeSerialize(resultValue),
				logs,
				truncatedLogs: 0,
			};
		} catch (error) {
			return {
				status: "error",
				durationMs: Date.now() - startedAt,
				error: error instanceof Error ? error.message : safeSerialize(error),
				stack: error instanceof Error ? error.stack : undefined,
				logs,
				truncatedLogs: 0,
			};
		}
	}

	async runFile(request: SandboxRunFileRequest): Promise<SandboxRunFileResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const path = normalizePath(request.path);
		const startedAt = Date.now();
		const logs: SandboxLogEntry[] = [];
		try {
			// ⚠ c.runFile() also uses eval internally.
			const value = await c.runFile(path);
			const resultValue =
				value && typeof value === "object" && "exports" in value
					? (value as { exports: unknown }).exports
					: value;
			return {
				status: "ok",
				durationMs: Date.now() - startedAt,
				result: safeSerialize(resultValue),
				logs,
				truncatedLogs: 0,
				path,
			};
		} catch (error) {
			return {
				status: "error",
				durationMs: Date.now() - startedAt,
				error: error instanceof Error ? error.message : safeSerialize(error),
				stack: error instanceof Error ? error.stack : undefined,
				logs,
				truncatedLogs: 0,
				path,
			};
		}
	}

	async createRepl(): Promise<{ replId: string }> {
		await this.initialize();
		return { replId: crypto.randomUUID() };
	}

	async replEval(request: {
		replId: string;
		code: string;
		timeoutMs?: number;
	}): Promise<SandboxExecutionResult> {
		return this.executeCode({ code: request.code, timeoutMs: request.timeoutMs });
	}

	// ── Logs ──────────────────────────────────────────────────────────────────

	async getLogs(request: SandboxGetLogsRequest = {}): Promise<SandboxGetLogsResult> {
		await this.initialize();
		const limit = Math.max(1, Math.min(request.limit ?? 100, MAX_RUNTIME_LOG_ENTRIES));
		const filtered = request.level
			? this.runtimeLogs.filter((e) => e.level === request.level)
			: this.runtimeLogs;
		return { logs: filtered.slice(-limit) };
	}

	async clearLogs(): Promise<{ cleared: true }> {
		await this.initialize();
		this.runtimeLogs.length = 0;
		return { cleared: true };
	}

	// ── Network ───────────────────────────────────────────────────────────────

	/**
	 * For /__virtual__/ URLs this still fails (no SW in direct mode).
	 * Use requestServer() with a port number for sandbox servers — AlmostNode
	 * patches globalThis.fetch so http://127.0.0.1:<port>/ is handled in-memory.
	 */
	async fetchResource(request: SandboxNetworkFetchRequest): Promise<SandboxNetworkFetchResult> {
		await this.initialize();
		const timeoutMs = request.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
		const response = await fetchWithTimeout(
			request.url,
			{ method: request.method ?? "GET", headers: request.headers, body: request.body },
			timeoutMs,
		);
		const contentType = response.headers.get("content-type") ?? "";
		const responseType = resolveResponseType(contentType, request.responseType ?? "auto");
		const text = await response.text();
		const body = responseType === "json" ? JSON.stringify(JSON.parse(text), null, 2) : text;
		return { url: request.url, status: response.status, ok: response.ok, contentType, responseType, body };
	}

	// ── File system ───────────────────────────────────────────────────────────

	async writeFile(request: SandboxFsWriteFileRequest): Promise<{ path: string }> {
		await this.initialize();
		const c = this.ensureContainer();
		const p = toWorkspaceCanonical(normalizePath(request.path));
		if (isWorkspacePath(p)) {
			await this.syncWorkspaceMount();
			await documentFileSystemService.writeWorkspaceFile(p, request.content);
		}
		c.vfs.writeFileSync(p, request.content);
		return { path: p };
	}

	async readFile(request: SandboxFsReadFileRequest): Promise<SandboxFsReadFileResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const p = normalizePath(request.path);
		const wp = toWorkspaceCanonical(p);

		if (isDocumentsPath(p)) {
			await this.syncDocumentsMount();
			const logicalPath = p === DOCUMENTS_MOUNT_ROOT ? "/" : p.slice(DOCUMENTS_MOUNT_ROOT.length) || "/";
			const bytes = await documentFileSystemService.getFileContent(logicalPath);
			const content = new TextDecoder().decode(bytes);
			c.vfs.writeFileSync(p, content);
		} else if (isWorkspacePath(p)) {
			await this.syncWorkspaceMount();
			const bytes = await documentFileSystemService.getWorkspaceFileContent(wp);
			const content = new TextDecoder().decode(bytes);
			c.vfs.writeFileSync(wp, content);
		}

		const raw = c.vfs.readFileSync(wp, "utf8");
		return { path: wp, content: typeof raw === "string" ? raw : new TextDecoder().decode(raw) };
	}

	async mkdir(request: SandboxFsMkdirRequest): Promise<{ path: string }> {
		await this.initialize();
		const c = this.ensureContainer();
		const p = toWorkspaceCanonical(normalizePath(request.path));
		if (isWorkspacePath(p)) {
			await this.syncWorkspaceMount();
			await documentFileSystemService.mkdirWorkspace(p);
		}
		c.vfs.mkdirSync(p, { recursive: request.recursive });
		return { path: p };
	}

	async readdir(request: SandboxFsReaddirRequest): Promise<SandboxFsReaddirResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const p = toWorkspaceCanonical(normalizePath(request.path));
		if (isDocumentsPath(p)) await this.syncDocumentsMount();
		else if (isWorkspacePath(p)) await this.syncWorkspaceMount();
		const entries = c.vfs.readdirSync(p);
		return { path: p, entries };
	}

	async unlink(request: SandboxFsUnlinkRequest): Promise<{ path: string }> {
		await this.initialize();
		const c = this.ensureContainer();
		const p = toWorkspaceCanonical(normalizePath(request.path));
		if (isWorkspacePath(p)) {
			await this.syncWorkspaceMount();
			await documentFileSystemService.deleteWorkspaceFile(p);
		}
		c.vfs.unlinkSync(p);
		return { path: p };
	}

	async rename(request: SandboxFsRenameRequest): Promise<{ oldPath: string; newPath: string }> {
		await this.initialize();
		const c = this.ensureContainer();
		const oldPath = toWorkspaceCanonical(normalizePath(request.oldPath));
		const newPath = toWorkspaceCanonical(normalizePath(request.newPath));
		if (isWorkspacePath(oldPath)) {
			await this.syncWorkspaceMount();
			const newName = newPath.split("/").pop()!;
			await documentFileSystemService.renameWorkspaceFile(oldPath, newName);
		}
		c.vfs.renameSync(oldPath, newPath);
		return { oldPath, newPath };
	}

	async exists(request: SandboxFsExistsRequest): Promise<SandboxFsExistsResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const p = toWorkspaceCanonical(normalizePath(request.path));
		if (isDocumentsPath(p) && !this.documentsMountLoaded) return { path: p, exists: false };
		if (isWorkspacePath(p) && !this.workspaceMountLoaded) return { path: p, exists: false };
		return {
			path: p,
			exists:
				c.vfs.existsSync(p) ||
				this.mountedDocumentFiles.has(p) ||
				this.mountedDocumentDirectories.has(p) ||
				this.mountedWorkspaceFiles.has(p) ||
				this.mountedWorkspaceDirectories.has(p),
		};
	}

	// ── NPM ───────────────────────────────────────────────────────────────────

	async installPackage(request: SandboxNpmInstallRequest): Promise<SandboxNpmInstallResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const installed = await c.npm.install(request.packageSpec, {
			save: request.save,
			saveDev: request.saveDev,
		});
		if (installed) {
			for (const [name, version] of Object.entries(installed)) {
				this.installedPackages.set(name, String(version));
			}
		}
		return { success: true, installed: installed ?? {} };
	}

	async installFromPackageJson(
		request: SandboxNpmInstallFromPackageJsonRequest = {},
	): Promise<SandboxNpmInstallResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const installed = await c.npm.installFromPackageJson({
			save: request.save,
			saveDev: request.saveDev,
		});
		if (installed) {
			for (const [name, version] of Object.entries(installed)) {
				this.installedPackages.set(name, String(version));
			}
		}
		return { success: true, installed: installed ?? {} };
	}

	async listInstalledPackages(): Promise<SandboxNpmListResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const list =
			typeof c.npm.listInstalled === "function"
				? await c.npm.listInstalled()
				: Object.fromEntries(this.installedPackages);
		return { packages: list };
	}

	// ── Servers ───────────────────────────────────────────────────────────────

	/**
	 * Resolve server URL for client-side requests.
	 * In direct mode AlmostNode patches globalThis.fetch, so http://127.0.0.1:<port>/
	 * is intercepted in-memory — no Service Worker needed.
	 */
	private resolveServerUrl(port: number, hostname: string): string {
		const h = hostname === "0.0.0.0" || hostname === "::" ? "127.0.0.1" : hostname || "127.0.0.1";
		return `http://${h}:${port}`;
	}

	async startServer(request: SandboxStartServerRequest): Promise<SandboxStartServerResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const lib = this.lib!;
		const port = request.port;
		const hostname = request.hostname ?? "127.0.0.1";
		const kind = request.kind;

		// Stop any existing server on this port
		const existing = this.servers.get(port);
		if (existing) {
			try { await existing.stop(); } catch { /* ignore */ }
			this.servers.delete(port);
		}

		// Scaffold template files if requested
		if (request.template) {
			this.scaffoldTemplate(c, request.template, request.rootDir ?? "/");
			if (request.autoInstall !== false) {
				const pkgs = TEMPLATE_INSTALL_SPECS[request.template];
				if (Array.isArray(pkgs)) {
					for (const pkg of pkgs) {
						const installed = await c.npm.install(pkg, {});
						if (installed) {
							for (const [name, version] of Object.entries(installed)) {
								this.installedPackages.set(name, String(version));
							}
						}
					}
				}
			}
		}

		const serverUrl = this.resolveServerUrl(port, hostname);
		let stop: () => Promise<void>;

		if (kind === "express") {
			// ⚠ Requires eval (c.runFile calls container.execute internally)
			const entryPath = normalizePath(request.entryPath ?? "/server.js");
			await c.runFile(entryPath);
			stop = async () => { /* Express stops with container reset */ };
		} else if (kind === "vite") {
			if (typeof lib.ViteDevServer !== "function") {
				throw new Error("ViteDevServer not available in almostnode bundle");
			}
			const viteServer = new lib.ViteDevServer(c.runtime, c.vfs, {
				port,
				hostname,
				rootDir: request.rootDir ?? "/",
				entryPath: request.entryPath ?? "/index.html",
			});
			await viteServer.start();
			stop = async () => { await viteServer.stop(); };
		} else if (kind === "next") {
			if (typeof lib.NextDevServer !== "function") {
				throw new Error("NextDevServer not available in almostnode bundle");
			}
			const nextServer = new lib.NextDevServer({
				port,
				hostname,
				rootDir: request.rootDir ?? "/",
			});
			await nextServer.start();
			stop = async () => { await nextServer.stop(); };
		} else {
			throw new Error(`Unsupported server kind: ${kind}`);
		}

		const state: ServerState = {
			kind,
			port,
			url: serverUrl,
			// In direct mode the server URL IS the render URL — AlmostNode's fetch
			// intercepts http://127.0.0.1:<port>/ directly, no SW virtual path needed.
			renderUrl: serverUrl,
			stop,
		};
		this.servers.set(port, state);

		return {
			kind: state.kind as SandboxStartServerResult["kind"],
			port: state.port,
			url: state.url,
			renderUrl: state.renderUrl,
		};
	}

	async stopServer(request: SandboxStopServerRequest): Promise<{ port: number }> {
		await this.initialize();
		const state = this.servers.get(request.port);
		if (state) {
			try { await state.stop(); } catch { /* ignore */ }
			this.servers.delete(request.port);
		}
		return { port: request.port };
	}

	async listServers(): Promise<SandboxListServersResult> {
		await this.initialize();
		return { servers: Array.from(this.servers.values()).map(toServerInfo) };
	}

	/**
	 * Direct server request — works because AlmostNode patches globalThis.fetch
	 * to intercept http://127.0.0.1:<port>/ in the same JS context.
	 * No Service Worker required.
	 */
	async requestServer(request: SandboxServerRequest): Promise<SandboxServerRequestResult> {
		await this.initialize();
		const state = this.servers.get(request.port);
		if (!state) throw new Error(`Server not found on port ${request.port}`);

		const path = request.path ?? "/";
		const url = `${state.url.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
		const timeoutMs = request.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

		const response = await fetchWithTimeout(
			url,
			{ method: request.method ?? "GET", headers: request.headers, body: request.body },
			timeoutMs,
		);
		const contentType = response.headers.get("content-type") ?? "";
		const responseType = resolveResponseType(contentType, request.responseType ?? "auto");
		const text = await response.text();
		const body = responseType === "json" ? JSON.stringify(JSON.parse(text), null, 2) : text;
		const headers = Object.fromEntries(response.headers.entries());

		return {
			port: request.port,
			url,
			status: response.status,
			ok: response.ok,
			contentType,
			responseType,
			headers,
			body,
		};
	}

	async getServerRenderUrl(
		request: SandboxServerRenderUrlRequest,
	): Promise<SandboxServerRenderUrlResult> {
		await this.initialize();
		const state = this.servers.get(request.port);
		if (!state) throw new Error(`Server not found on port ${request.port}`);
		const path = request.path ?? "/";
		const url = `${state.url.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
		return { port: request.port, url };
	}

	// ── Snapshot ──────────────────────────────────────────────────────────────

	async getSnapshot(): Promise<SandboxSnapshotResult> {
		await this.initialize();
		const c = this.ensureContainer();
		const snapshot = typeof c.vfs.toSnapshot === "function" ? c.vfs.toSnapshot() : { files: [] };
		return {
			snapshot: {
				...(snapshot as object),
				servers: Array.from(this.servers.values()).map(toServerInfo),
				installedPackages: Object.fromEntries(this.installedPackages),
			},
		};
	}

	async restoreSnapshot(request: SandboxRestoreSnapshotRequest): Promise<{ restored: true }> {
		await this.initialize();
		await this.resetRuntime();
		return { restored: true };
	}

	// ── Document / workspace mount helpers ───────────────────────────────────

	private async syncDocumentsMount(): Promise<void> {
		if (this.mountDocumentsSyncPromise) return this.mountDocumentsSyncPromise;
		this.mountDocumentsSyncPromise = (async () => {
			const snapshot = await documentFileSystemService.getSandboxMountSnapshot();
			this.mountedDocumentFiles.clear();
			this.mountedDocumentDirectories.clear();
			this.mountedDocumentDirectories.add(DOCUMENTS_MOUNT_ROOT);
			this.materializedDocFiles.clear();
			this.documentsMountLoaded = true;
			for (const d of snapshot.directories ?? []) {
				const p = normalizePath(d);
				if (isDocumentsPath(p)) this.mountedDocumentDirectories.add(p);
			}
			for (const f of snapshot.files ?? []) {
				const p = normalizePath(f);
				if (isDocumentsPath(p)) {
					this.mountedDocumentFiles.add(p);
					this.mountedDocumentDirectories.add(dirname(p));
				}
			}
		})().finally(() => { this.mountDocumentsSyncPromise = null; });
		return this.mountDocumentsSyncPromise;
	}

	private async syncWorkspaceMount(): Promise<void> {
		if (this.mountWorkspaceSyncPromise) return this.mountWorkspaceSyncPromise;
		this.mountWorkspaceSyncPromise = (async () => {
			const snapshot = await documentFileSystemService.getSandboxWorkspaceMountSnapshot();
			this.mountedWorkspaceFiles.clear();
			this.mountedWorkspaceDirectories.clear();
			this.mountedWorkspaceDirectories.add(WORKSPACES_ROOT);
			this.materializedWsFiles.clear();
			this.pendingWorkspaceOps.length = 0;
			this.workspaceMountLoaded = true;
			for (const d of snapshot.directories ?? []) {
				const p = toWorkspaceCanonical(normalizePath(d));
				if (isWorkspacePath(p)) this.mountedWorkspaceDirectories.add(p);
			}
			for (const f of snapshot.files ?? []) {
				const p = toWorkspaceCanonical(normalizePath(f));
				if (isWorkspacePath(p)) {
					this.mountedWorkspaceFiles.add(p);
					this.mountedWorkspaceDirectories.add(dirname(p));
				}
			}
		})().finally(() => { this.mountWorkspaceSyncPromise = null; });
		return this.mountWorkspaceSyncPromise;
	}

	// ── Template scaffolding (mirrors runtime FRAMEWORK_TEMPLATES) ───────────

	private scaffoldTemplate(
		c: AlmostNodeContainer,
		template: string,
		rootDir: string,
	): void {
		// Templates are defined in sandbox-container-runtime.js FRAMEWORK_TEMPLATES.
		// Here we replicate the structure to avoid depending on the runtime at import time.
		// Keep in sync with public/sandbox/sandbox-container-runtime.js FRAMEWORK_TEMPLATES.
		const root = normalizePath(rootDir);
		const write = (rel: string, content: string) => {
			const p = normalizePath(`${root}/${rel}`);
			c.vfs.mkdirSync(dirname(p), { recursive: true });
			c.vfs.writeFileSync(p, content);
		};

		if (template === "express") {
			write("server.js", EXPRESS_TEMPLATE);
		} else if (template === "vite-react") {
			for (const [rel, content] of Object.entries(VITE_REACT_TEMPLATE)) {
				write(rel, content);
			}
		} else if (template === "next-pages" || template === "next-app") {
			for (const [rel, content] of Object.entries(NEXT_TEMPLATE(template))) {
				write(rel, content);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Template content (kept in sync with sandbox-container-runtime.js)
// ---------------------------------------------------------------------------

const EXPRESS_TEMPLATE = `const express = require('express');
const app = express();
app.use(express.json());
app.get('/', (_req, res) => res.send('<h1>Hello from Express!</h1>'));
app.get('/api/hello', (_req, res) => res.json({ message: 'Hello World!' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
`;

const VITE_REACT_TEMPLATE: Record<string, string> = {
	"package.json": JSON.stringify(
		{
			name: "vite-react-app",
			private: true,
			version: "0.0.0",
			type: "module",
			scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
			dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
			devDependencies: { "@vitejs/plugin-react": "^4.0.0", vite: "^5.0.0" },
		},
		null,
		2,
	),
	"index.html": `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Vite + React</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
	"vite.config.js": `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });`,
	"src/main.jsx": `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
ReactDOM.createRoot(document.getElementById('root')).render(<App />);`,
	"src/App.jsx": `export default function App() { return <h1>Hello from Vite + React!</h1>; }`,
};

const NEXT_TEMPLATE = (variant: string): Record<string, string> => ({
	"package.json": JSON.stringify(
		{
			name: "next-app",
			version: "0.1.0",
			private: true,
			scripts: { dev: "next dev", build: "next build", start: "next start" },
			dependencies: { next: "^14.0.0", react: "^18.2.0", "react-dom": "^18.2.0" },
		},
		null,
		2,
	),
	...(variant === "next-pages"
		? {
				"pages/index.jsx": `export default function Home() { return <h1>Hello from Next.js!</h1>; }`,
			}
		: {
				"app/page.jsx": `export default function Page() { return <h1>Hello from Next.js App Router!</h1>; }`,
				"app/layout.jsx": `export default function RootLayout({ children }) { return (<html lang="en"><body>{children}</body></html>); }`,
			}),
});

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const sandboxContainerMainService = SandboxContainerMainService.getInstance();

export const ensureSandboxContainerMainReady = async (): Promise<void> => {
	try {
		await sandboxContainerMainService.initialize();
	} catch (error) {
		logError("Failed to initialize SandboxContainerMainService", error);
		throw error;
	}
};
