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
	SandboxNetworkFetchRequest,
	SandboxNetworkFetchResult,
	SandboxNpmInstallFromPackageJsonRequest,
	SandboxNpmInstallRequest,
	SandboxNpmInstallResult,
	SandboxNpmListResult,
	SandboxRestoreSnapshotRequest,
	SandboxRunFileRequest,
	SandboxRunFileResult,
	SandboxServerRequest,
	SandboxServerRequestResult,
	SandboxServerRenderUrlRequest,
	SandboxServerRenderUrlResult,
	SandboxSnapshotResult,
	SandboxStartServerRequest,
	SandboxStartServerResult,
	SandboxStopServerRequest,
} from "./types";

export interface ISandboxContainerService {
	isReady(): boolean;
	getInitializedAt(): number | null;
	initialize(): Promise<void>;
	dispose(): Promise<void>;

	// Runtime
	health(): Promise<SandboxHealthResult>;
	resetRuntime(): Promise<void>;
	executeCode(request: SandboxExecutionRequest): Promise<SandboxExecutionResult>;
	runFile(request: SandboxRunFileRequest): Promise<SandboxRunFileResult>;
	createRepl(): Promise<{ replId: string }>;
	replEval(
		request: { replId: string; code: string; timeoutMs?: number },
	): Promise<SandboxExecutionResult>;
	getLogs(request?: SandboxGetLogsRequest): Promise<SandboxGetLogsResult>;
	clearLogs(): Promise<{ cleared: true }>;

	// Network
	fetchResource(
		request: SandboxNetworkFetchRequest,
	): Promise<SandboxNetworkFetchResult>;

	// File system
	writeFile(request: SandboxFsWriteFileRequest): Promise<{ path: string }>;
	readFile(request: SandboxFsReadFileRequest): Promise<SandboxFsReadFileResult>;
	mkdir(request: SandboxFsMkdirRequest): Promise<{ path: string }>;
	readdir(
		request: SandboxFsReaddirRequest,
	): Promise<SandboxFsReaddirResult>;
	unlink(request: SandboxFsUnlinkRequest): Promise<{ path: string }>;
	rename(
		request: SandboxFsRenameRequest,
	): Promise<{ oldPath: string; newPath: string }>;
	exists(request: SandboxFsExistsRequest): Promise<SandboxFsExistsResult>;

	// NPM
	installPackage(
		request: SandboxNpmInstallRequest,
	): Promise<SandboxNpmInstallResult>;
	installFromPackageJson(
		request?: SandboxNpmInstallFromPackageJsonRequest,
	): Promise<SandboxNpmInstallResult>;
	listInstalledPackages(): Promise<SandboxNpmListResult>;

	// Servers
	startServer(
		request: SandboxStartServerRequest,
	): Promise<SandboxStartServerResult>;
	stopServer(request: SandboxStopServerRequest): Promise<{ port: number }>;
	listServers(): Promise<SandboxListServersResult>;
	requestServer(
		request: SandboxServerRequest,
	): Promise<SandboxServerRequestResult>;
	getServerRenderUrl(
		request: SandboxServerRenderUrlRequest,
	): Promise<SandboxServerRenderUrlResult>;

	// Snapshot
	getSnapshot(): Promise<SandboxSnapshotResult>;
	restoreSnapshot(
		request: SandboxRestoreSnapshotRequest,
	): Promise<{ restored: true }>;
}
