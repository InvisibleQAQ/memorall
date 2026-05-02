import { BaseProcessHandler } from "./base-process-handler";
import type { ProcessDependencies, BaseJob, ItemHandlerResult } from "./types";
import { handlerRegistry } from "./handler-registry";
import { serviceManager } from "@/services";
import type { CronOperationPayload } from "@/services/cron-jobs";

const JOB_NAMES = {
	cronOperation: "cron-operation",
} as const;

type CronOperationJob = BaseJob & {
	jobType: typeof JOB_NAMES.cronOperation;
	payload: CronOperationPayload;
};

class CronOperationHandler extends BaseProcessHandler<CronOperationJob> {
	async process(
		_jobId: string,
		job: CronOperationJob,
		_dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		const { operation, cronJobId } = job.payload;

		switch (operation) {
			case "reload":
				await serviceManager.cronJobService.reload();
				return { operation, reloaded: true };
			case "reload-one":
				if (!cronJobId) throw new Error("cronJobId is required");
				await serviceManager.cronJobService.reload(cronJobId);
				return { operation, cronJobId, reloaded: true };
			case "delete-one":
				if (!cronJobId) throw new Error("cronJobId is required");
				await serviceManager.cronJobService.reload(cronJobId);
				return { operation, cronJobId, deleted: true };
			case "trigger-now":
				if (!cronJobId) throw new Error("cronJobId is required");
				await serviceManager.cronJobService.triggerNow(cronJobId);
				return { operation, cronJobId, triggered: true };
			default:
				throw new Error(`Unknown cron operation: ${operation}`);
		}
	}
}

const cronOperationHandler = new CronOperationHandler();
handlerRegistry.register({
	instance: cronOperationHandler,
	jobs: [JOB_NAMES.cronOperation],
});

declare global {
	interface JobTypeRegistry {
		"cron-operation": CronOperationPayload;
	}

	interface JobResultRegistry {
		"cron-operation": Record<string, unknown>;
	}
}
