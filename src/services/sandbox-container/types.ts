export type SandboxLogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface SandboxLogEntry {
	level: SandboxLogLevel;
	message: string;
	timestamp: number;
}

export interface SandboxExecutionRequest {
	code: string;
	filename?: string;
	timeoutMs?: number;
	maxLogEntries?: number;
}

export interface SandboxExecutionResult {
	status: "ok" | "error" | "timeout";
	durationMs: number;
	result?: string;
	error?: string;
	stack?: string;
	logs: SandboxLogEntry[];
	truncatedLogs: number;
}

export interface SandboxRunFileRequest {
	path: string;
	timeoutMs?: number;
	maxLogEntries?: number;
}

export interface SandboxRunFileResult extends SandboxExecutionResult {
	path: string;
}

export interface SandboxReplCreateResult {
	replId: string;
}

export interface SandboxReplEvalRequest {
	replId: string;
	code: string;
	timeoutMs?: number;
}

export interface SandboxFsWriteFileRequest {
	path: string;
	content: string;
}

export interface SandboxFsReadFileRequest {
	path: string;
}

export interface SandboxFsMkdirRequest {
	path: string;
	recursive?: boolean;
}

export interface SandboxFsReaddirRequest {
	path: string;
}

export interface SandboxFsUnlinkRequest {
	path: string;
}

export interface SandboxFsRenameRequest {
	oldPath: string;
	newPath: string;
}

export interface SandboxFsExistsRequest {
	path: string;
}

export interface SandboxFsReadFileResult {
	path: string;
	content: string;
}

export interface SandboxFsReaddirResult {
	path: string;
	entries: string[];
}

export interface SandboxFsExistsResult {
	path: string;
	exists: boolean;
}

export interface SandboxFsMountDocumentsRequest {
	directories: string[];
	files: string[];
}

export interface SandboxFsMountDocumentsResult {
	mounted: true;
	directoryCount: number;
	fileCount: number;
}

export interface SandboxFsMaterializeDocumentFileRequest {
	path: string;
	content: string;
}

export interface SandboxFsMaterializeDocumentFileResult {
	path: string;
	materialized: true;
}

export interface SandboxNpmInstallRequest {
	packageSpec: string;
	save?: boolean;
	saveDev?: boolean;
}

export interface SandboxNpmInstallFromPackageJsonRequest {
	save?: boolean;
	saveDev?: boolean;
}

export interface SandboxNpmInstallResult {
	success: boolean;
	installed: Record<string, string>;
}

export interface SandboxNpmListResult {
	packages: Record<string, string>;
}

export type SandboxServerKind = "express" | "vite" | "next";

export interface SandboxStartServerRequest {
	kind: SandboxServerKind;
	port: number;
	hostname?: string;
	entryPath?: string;
	rootDir?: string;
}

export interface SandboxStartServerResult {
	kind: SandboxServerKind;
	port: number;
	url: string;
}

export interface SandboxStopServerRequest {
	port: number;
}

export interface SandboxServerInfo {
	kind: SandboxServerKind;
	port: number;
	url: string;
}

export interface SandboxListServersResult {
	servers: SandboxServerInfo[];
}

export interface SandboxSnapshotResult {
	snapshot: unknown;
}

export interface SandboxRestoreSnapshotRequest {
	snapshot: unknown;
}

export interface SandboxHealthResult {
	ready: boolean;
	initializedAt: number | null;
}

export interface SandboxGetLogsRequest {
	limit?: number;
	level?: SandboxLogLevel;
}

export interface SandboxGetLogsResult {
	logs: SandboxLogEntry[];
}

export interface SandboxClearLogsResult {
	cleared: true;
}

export interface SandboxNetworkFetchRequest {
	url: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
	headers?: Record<string, string>;
	body?: string;
	timeoutMs?: number;
	responseType?: "auto" | "json" | "text" | "html";
}

export interface SandboxNetworkFetchResult {
	url: string;
	status: number;
	ok: boolean;
	contentType: string;
	responseType: "json" | "text" | "html";
	body: string;
}

export type SandboxOperation =
	| "health"
	| "runtime.executeCode"
	| "runtime.runFile"
	| "runtime.createRepl"
	| "runtime.replEval"
	| "runtime.getLogs"
	| "runtime.clearLogs"
	| "network.fetch"
	| "fs.writeFile"
	| "fs.readFile"
	| "fs.mkdir"
	| "fs.readdir"
	| "fs.unlink"
	| "fs.rename"
	| "fs.exists"
	| "fs.mountDocuments"
	| "fs.materializeDocumentFile"
	| "npm.install"
	| "npm.installFromPackageJson"
	| "npm.list"
	| "server.start"
	| "server.stop"
	| "server.list"
	| "snapshot.get"
	| "snapshot.restore"
	| "runtime.reset";

export type SandboxOperationPayloadMap = {
	health: undefined;
	"runtime.executeCode": SandboxExecutionRequest;
	"runtime.runFile": SandboxRunFileRequest;
	"runtime.createRepl": undefined;
	"runtime.replEval": SandboxReplEvalRequest;
	"runtime.getLogs": SandboxGetLogsRequest;
	"runtime.clearLogs": undefined;
	"network.fetch": SandboxNetworkFetchRequest;
	"fs.writeFile": SandboxFsWriteFileRequest;
	"fs.readFile": SandboxFsReadFileRequest;
	"fs.mkdir": SandboxFsMkdirRequest;
	"fs.readdir": SandboxFsReaddirRequest;
	"fs.unlink": SandboxFsUnlinkRequest;
	"fs.rename": SandboxFsRenameRequest;
	"fs.exists": SandboxFsExistsRequest;
	"fs.mountDocuments": SandboxFsMountDocumentsRequest;
	"fs.materializeDocumentFile": SandboxFsMaterializeDocumentFileRequest;
	"npm.install": SandboxNpmInstallRequest;
	"npm.installFromPackageJson": SandboxNpmInstallFromPackageJsonRequest;
	"npm.list": undefined;
	"server.start": SandboxStartServerRequest;
	"server.stop": SandboxStopServerRequest;
	"server.list": undefined;
	"snapshot.get": undefined;
	"snapshot.restore": SandboxRestoreSnapshotRequest;
	"runtime.reset": undefined;
};

export type SandboxOperationResultMap = {
	health: SandboxHealthResult;
	"runtime.executeCode": SandboxExecutionResult;
	"runtime.runFile": SandboxRunFileResult;
	"runtime.createRepl": SandboxReplCreateResult;
	"runtime.replEval": SandboxExecutionResult;
	"runtime.getLogs": SandboxGetLogsResult;
	"runtime.clearLogs": SandboxClearLogsResult;
	"network.fetch": SandboxNetworkFetchResult;
	"fs.writeFile": { path: string };
	"fs.readFile": SandboxFsReadFileResult;
	"fs.mkdir": { path: string };
	"fs.readdir": SandboxFsReaddirResult;
	"fs.unlink": { path: string };
	"fs.rename": { oldPath: string; newPath: string };
	"fs.exists": SandboxFsExistsResult;
	"fs.mountDocuments": SandboxFsMountDocumentsResult;
	"fs.materializeDocumentFile": SandboxFsMaterializeDocumentFileResult;
	"npm.install": SandboxNpmInstallResult;
	"npm.installFromPackageJson": SandboxNpmInstallResult;
	"npm.list": SandboxNpmListResult;
	"server.start": SandboxStartServerResult;
	"server.stop": { port: number };
	"server.list": SandboxListServersResult;
	"snapshot.get": SandboxSnapshotResult;
	"snapshot.restore": { restored: true };
	"runtime.reset": { reset: true };
};

export interface SandboxRequestEnvelope<T extends SandboxOperation> {
	channel: "memorall-sandbox-container";
	direction: "request";
	requestId: string;
	operation: T;
	payload: SandboxOperationPayloadMap[T];
}

export interface SandboxResponseEnvelope<T extends SandboxOperation> {
	channel: "memorall-sandbox-container";
	direction: "response";
	requestId: string;
	operation: T;
	ok: true;
	result: SandboxOperationResultMap[T];
}

export interface SandboxErrorEnvelope<T extends SandboxOperation> {
	channel: "memorall-sandbox-container";
	direction: "response";
	requestId: string;
	operation: T;
	ok: false;
	error: {
		message: string;
		stack?: string;
	};
}

export type SandboxResponseMessage<T extends SandboxOperation> =
	| SandboxResponseEnvelope<T>
	| SandboxErrorEnvelope<T>;
