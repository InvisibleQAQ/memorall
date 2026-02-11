import { sandboxContainerService } from "@/services/sandbox-container";
import type {
	SandboxOperation,
	SandboxOperationPayloadMap,
	SandboxOperationResultMap,
} from "@/services/sandbox-container";
import { backgroundProcessFactory } from "./process-factory";
import type {
	BaseJob,
	ItemHandlerResult,
	ProcessDependencies,
	ProcessHandler,
} from "./types";

const JOB_NAME = "sandbox-operation" as const;

type SandboxOperationJobPayload = {
	[K in SandboxOperation]: {
		operation: K;
		payload: SandboxOperationPayloadMap[K];
	};
}[SandboxOperation];

export interface SandboxOperationJobResult extends Record<string, unknown> {
	operation: SandboxOperation;
	result: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isSandboxOperationPayload = (
	value: unknown,
): value is SandboxOperationJobPayload => {
	if (!isObject(value)) {
		return false;
	}
	return typeof value.operation === "string";
};

export class SandboxOperationsHandler implements ProcessHandler<BaseJob> {
	private async executeOperation<T extends SandboxOperation>(
		operation: T,
		payload: SandboxOperationPayloadMap[T],
	): Promise<SandboxOperationResultMap[T]> {
		return sandboxContainerService.request(operation, payload);
	}

	async process(
		jobId: string,
		job: BaseJob,
		dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		const { logger } = dependencies;
		if (!isSandboxOperationPayload(job.payload)) {
			throw new Error("Invalid sandbox-operation payload");
		}

		const { operation } = job.payload;
		await logger.info("Starting sandbox operation", { jobId, operation }, "offscreen");

		const result = await this.runWithStrongTypes(job.payload);

		await logger.info(
			"Completed sandbox operation",
			{ jobId, operation },
			"offscreen",
		);

		return {
			operation,
			result,
		};
	}

	private async runWithStrongTypes(
		payload: SandboxOperationJobPayload,
	): Promise<unknown> {
		switch (payload.operation) {
			case "health":
				return this.executeOperation("health", payload.payload);
			case "runtime.executeCode":
				return this.executeOperation("runtime.executeCode", payload.payload);
			case "runtime.runFile":
				return this.executeOperation("runtime.runFile", payload.payload);
			case "runtime.createRepl":
				return this.executeOperation("runtime.createRepl", payload.payload);
			case "runtime.replEval":
				return this.executeOperation("runtime.replEval", payload.payload);
			case "runtime.getLogs":
				return this.executeOperation("runtime.getLogs", payload.payload);
			case "runtime.clearLogs":
				return this.executeOperation("runtime.clearLogs", payload.payload);
			case "network.fetch":
				return this.executeOperation("network.fetch", payload.payload);
			case "fs.writeFile":
				return this.executeOperation("fs.writeFile", payload.payload);
			case "fs.readFile":
				return this.executeOperation("fs.readFile", payload.payload);
			case "fs.mkdir":
				return this.executeOperation("fs.mkdir", payload.payload);
			case "fs.readdir":
				return this.executeOperation("fs.readdir", payload.payload);
			case "fs.unlink":
				return this.executeOperation("fs.unlink", payload.payload);
			case "fs.rename":
				return this.executeOperation("fs.rename", payload.payload);
			case "fs.exists":
				return this.executeOperation("fs.exists", payload.payload);
			case "npm.install":
				return this.executeOperation("npm.install", payload.payload);
			case "npm.installFromPackageJson":
				return this.executeOperation("npm.installFromPackageJson", payload.payload);
			case "npm.list":
				return this.executeOperation("npm.list", payload.payload);
			case "server.start":
				return this.executeOperation("server.start", payload.payload);
			case "server.stop":
				return this.executeOperation("server.stop", payload.payload);
			case "server.list":
				return this.executeOperation("server.list", payload.payload);
			case "snapshot.get":
				return this.executeOperation("snapshot.get", payload.payload);
			case "snapshot.restore":
				return this.executeOperation("snapshot.restore", payload.payload);
			case "runtime.reset":
				return this.executeOperation("runtime.reset", payload.payload);
			default: {
				const unreachable: never = payload;
				throw new Error(
					`Unsupported sandbox operation payload: ${JSON.stringify(unreachable)}`,
				);
			}
		}
	}
}

backgroundProcessFactory.register({
	instance: new SandboxOperationsHandler(),
	jobs: [JOB_NAME],
});

declare global {
	interface JobTypeRegistry {
		[JOB_NAME]: SandboxOperationJobPayload;
	}

	interface JobResultRegistry {
		[JOB_NAME]: SandboxOperationJobResult;
	}
}
