declare module "almostnode" {
	export type ConsoleLogLevel =
		| "log"
		| "info"
		| "warn"
		| "error"
		| "debug";

	export interface RuntimeExecutionOptions {
		filename?: string;
		timeout?: number;
		async?: boolean;
		onConsole?: (level: ConsoleLogLevel, args: unknown[]) => void;
	}

	export interface RuntimeExecutionResultSuccess {
		type: "success";
		result: unknown;
	}

	export interface RuntimeExecutionResultError {
		type: "error";
		error: unknown;
		stack?: string;
	}

	export interface RuntimeExecutionResultTimeout {
		type: "timeout";
	}

	export type RuntimeExecutionResult =
		| RuntimeExecutionResultSuccess
		| RuntimeExecutionResultError
		| RuntimeExecutionResultTimeout;

	export interface REPL {
		evaluate(code: string): unknown | Promise<unknown>;
		dispose(): void;
	}

	export interface VirtualFSSnapshot {
		[key: string]: unknown;
	}

	export interface VirtualFSInstance {
		writeFile(path: string, content: string): Promise<void>;
		readFile(path: string): Promise<string>;
		mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
		readdir(path: string): Promise<string[]>;
		unlink(path: string): Promise<void>;
		rename(oldPath: string, newPath: string): Promise<void>;
		exists(path: string): Promise<boolean>;
		toSnapshot(): VirtualFSSnapshot;
	}

	export class VirtualFS implements VirtualFSInstance {
		constructor();
		static fromSnapshot(snapshot: VirtualFSSnapshot): VirtualFS;
		writeFile(path: string, content: string): Promise<void>;
		readFile(path: string): Promise<string>;
		mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
		readdir(path: string): Promise<string[]>;
		unlink(path: string): Promise<void>;
		rename(oldPath: string, newPath: string): Promise<void>;
		exists(path: string): Promise<boolean>;
		toSnapshot(): VirtualFSSnapshot;
	}

	export interface RuntimeOptions {
		workingDirectory?: string;
	}

	export class Runtime {
		constructor(vfs: VirtualFSInstance, options?: RuntimeOptions);
		execute(
			code: string,
			options?: RuntimeExecutionOptions,
		): RuntimeExecutionResult | Promise<RuntimeExecutionResult>;
		executeAsync(
			code: string,
			options?: RuntimeExecutionOptions,
		): Promise<RuntimeExecutionResult>;
		runFile(
			path: string,
			options?: RuntimeExecutionOptions,
		): RuntimeExecutionResult | Promise<RuntimeExecutionResult>;
		runFileAsync(
			path: string,
			options?: RuntimeExecutionOptions,
		): Promise<RuntimeExecutionResult>;
		createREPL(): REPL;
		dispose(): void;
	}

	export interface PackageManagerOptions {
		cwd?: string;
	}

	export interface InstallPackageOptions {
		save?: boolean;
		saveDev?: boolean;
	}

	export class PackageManager {
		constructor(vfs: VirtualFSInstance, options?: PackageManagerOptions);
		install(
			packageSpec: string,
			options?: InstallPackageOptions,
		): Promise<Record<string, string>>;
		installFromPackageJson(
			options?: InstallPackageOptions,
		): Promise<Record<string, string>>;
		listInstalled(): Promise<Record<string, string>>;
	}

	export interface ServerBridge {
		registerServer(server: object, port: number): void;
		unregisterServer(port: number): void;
		getServerUrl(port: number): string;
		listServerPorts(): number[];
	}

	export function getServerBridge(): ServerBridge;
}

declare module "almostnode/vite" {
	import type { Runtime, VirtualFSInstance } from "almostnode";

	export interface ViteDevServerOptions {
		port: number;
		hostname?: string;
		rootDir?: string;
	}

	export class ViteDevServer {
		constructor(
			runtime: Runtime,
			vfs: VirtualFSInstance,
			options: ViteDevServerOptions,
		);
		start(): Promise<void>;
		stop(): Promise<void>;
	}
}

declare module "almostnode/next" {
	import type { Runtime, VirtualFSInstance } from "almostnode";

	export interface NextDevServerOptions {
		port: number;
		hostname?: string;
		rootDir?: string;
	}

	export class NextDevServer {
		constructor(
			runtime: Runtime,
			vfs: VirtualFSInstance,
			options: NextDevServerOptions,
		);
		start(): Promise<void>;
		stop(): Promise<void>;
	}
}
