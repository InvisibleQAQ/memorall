import { backgroundJob } from "@/services/background-jobs/background-job";
import { logInfo, logWarn } from "@/utils/logger";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import type { ISandboxContainerService } from "./interfaces/sandbox-container-service.interface";
import {
	decodeSwResponseBodyPreview,
	hasSwTransformErrorHeader,
} from "./sw-response-utils";
import type {
	SandboxCommandResult,
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
	SandboxListCommandsResult,
	SandboxListServersResult,
	SandboxListenCommandRequest,
	SandboxNetworkFetchRequest,
	SandboxNetworkFetchResult,
	SandboxNpmInstallFromPackageJsonRequest,
	SandboxNpmInstallRequest,
	SandboxNpmInstallResult,
	SandboxNpmListResult,
	SandboxOperation,
	SandboxOperationPayloadMap,
	SandboxOperationResultMap,
	SandboxRestoreSnapshotRequest,
	SandboxRunFileRequest,
	SandboxRunFileResult,
	SandboxSendCommandInputRequest,
	SandboxServerRequest,
	SandboxServerRequestResult,
	SandboxServerRenderUrlRequest,
	SandboxServerRenderUrlResult,
	SandboxSnapshotResult,
	SandboxStartServerRequest,
	SandboxStartServerResult,
	SandboxExecuteCommandRequest,
	SandboxStopCommandRequest,
	SandboxStopServerRequest,
	SandboxHandleSwRequestPayload,
	SandboxHandleSwRequestResult,
} from "./types";

const SANDBOX_OPERATION_JOB_NAME = "sandbox-operation" as const;

interface SandboxOperationJobResult {
	operation: SandboxOperation;
	result: unknown;
}

export class SandboxContainerServiceProxy implements ISandboxContainerService {
	private static instance: SandboxContainerServiceProxy;

	private initialized = false;
	private initializedAt: number | null = null;

	static getInstance(): SandboxContainerServiceProxy {
		if (!SandboxContainerServiceProxy.instance) {
			SandboxContainerServiceProxy.instance =
				new SandboxContainerServiceProxy();
		}
		return SandboxContainerServiceProxy.instance;
	}

	isReady(): boolean {
		return this.initialized;
	}

	getInitializedAt(): number | null {
		return this.initializedAt;
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		this.initialized = true;
		this.initializedAt = Date.now();
		logInfo(
			"✅ SandboxContainerServiceProxy initialized - operations delegated to offscreen",
		);
	}

	async dispose(): Promise<void> {
		this.initialized = false;
		this.initializedAt = null;
	}

	private async executeOperation<T extends SandboxOperation>(
		operation: T,
		payload: SandboxOperationPayloadMap[T],
	): Promise<SandboxOperationResultMap[T]> {
		const executeResult = await backgroundJob.execute(
			SANDBOX_OPERATION_JOB_NAME,
			{
				operation,
				payload,
			},
			{ stream: false },
		);

		if (!("promise" in executeResult)) {
			throw new Error("Expected promise result from non-streaming execute");
		}

		const result = await executeResult.promise;
		if (result.status !== "completed") {
			throw new Error(result.error || `Sandbox operation failed: ${operation}`);
		}

		const jobResult = result.result as SandboxOperationJobResult | undefined;
		if (!jobResult || jobResult.operation !== operation) {
			throw new Error(`Sandbox operation response mismatch: ${operation}`);
		}

		return jobResult.result as SandboxOperationResultMap[T];
	}

	async request<T extends SandboxOperation>(
		operation: T,
		payload: SandboxOperationPayloadMap[T],
		_timeoutMs?: number,
	): Promise<SandboxOperationResultMap[T]> {
		await this.initialize();
		return this.executeOperation(operation, payload);
	}

	async health(): Promise<SandboxHealthResult> {
		return this.request("health", undefined);
	}

	async resetRuntime(): Promise<void> {
		await this.request("runtime.reset", undefined);
	}

	async executeCode(
		request: SandboxExecutionRequest,
	): Promise<SandboxExecutionResult> {
		return this.request("runtime.executeCode", request);
	}

	async runFile(request: SandboxRunFileRequest): Promise<SandboxRunFileResult> {
		return this.request("runtime.runFile", request);
	}

	async executeCommand(
		request: SandboxExecuteCommandRequest,
	): Promise<SandboxCommandResult> {
		return this.request("runtime.executeCommand", request);
	}

	async listenCommand(
		request: SandboxListenCommandRequest,
	): Promise<SandboxCommandResult> {
		return this.request("runtime.listenCommand", request);
	}

	async sendCommandInput(
		request: SandboxSendCommandInputRequest,
	): Promise<{ commandId: string; sent: true }> {
		return this.request("runtime.sendCommandInput", request);
	}

	async stopCommand(
		request: SandboxStopCommandRequest,
	): Promise<{ commandId: string; stopped: true }> {
		return this.request("runtime.stopCommand", request);
	}

	async listCommands(): Promise<SandboxListCommandsResult> {
		return this.request("runtime.listCommands", undefined);
	}

	async createRepl(): Promise<{ replId: string }> {
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
		return this.request("server.start", request);
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
		return this.request("server.request", request);
	}

	async getServerRenderUrl(
		request: SandboxServerRenderUrlRequest,
	): Promise<SandboxServerRenderUrlResult> {
		return this.request("server.renderUrl", request);
	}

	async getSnapshot(): Promise<SandboxSnapshotResult> {
		return this.request("snapshot.get", undefined);
	}

	async restoreSnapshot(
		request: SandboxRestoreSnapshotRequest,
	): Promise<{ restored: true }> {
		return this.request("snapshot.restore", request);
	}

	async handleSwRequestWithRetry(
		params: SandboxHandleSwRequestPayload,
	): Promise<SandboxHandleSwRequestResult> {
		const makeRequest = () =>
			this.request("server.handleSwRequest", params, 120_000);

		let result = await makeRequest();
		const shouldInspectBody =
			(result.statusCode ?? 200) >= 400 || hasSwTransformErrorHeader(result);

		if (shouldInspectBody) {
			const bodyText = decodeSwResponseBodyPreview(result, 1200);

			const match = bodyText.match(
				/Workspace file not materialized: (\/workspaces\/[^\s]+|\/workspace\/[^\s]+)/,
			);
			const missingPath = match?.[1] ?? null;

			if (missingPath) {
				try {
					const bytes =
						await documentFileSystemService.getWorkspaceFileContent(
							missingPath,
						);
					const content = new TextDecoder().decode(bytes);
					await this.request("fs.materializeWorkspaceFile", {
						path: missingPath,
						content,
					});
					result = await makeRequest();
				} catch (err) {
					logWarn(
						"[SW relay proxy] Failed to materialize workspace file for retry",
						{ missingPath, err },
					);
				}
			}
		}

		return result;
	}
}

export const sandboxContainerServiceProxy =
	SandboxContainerServiceProxy.getInstance();
