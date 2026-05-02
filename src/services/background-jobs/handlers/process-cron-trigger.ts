import { eq, sql } from "drizzle-orm";
import { BaseProcessHandler } from "./base-process-handler";
import type { ProcessDependencies, BaseJob, ItemHandlerResult } from "./types";
import { handlerRegistry } from "./handler-registry";
import { serviceManager } from "@/services";
import type { CronTriggerPayload } from "@/services/cron-jobs";
import { cronActionRegistry } from "./cron-actions";

const JOB_NAMES = {
	cronTrigger: "cron-trigger",
} as const;

type CronTriggerJob = BaseJob & {
	jobType: typeof JOB_NAMES.cronTrigger;
	payload: CronTriggerPayload;
};

class CronTriggerHandler extends BaseProcessHandler<CronTriggerJob> {
	async process(
		jobId: string,
		job: CronTriggerJob,
		dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		const { cronJobId, reason } = job.payload;
		const [cronJob] = await serviceManager.databaseService.use(
			async ({ db, schema }) =>
				db
					.select()
					.from(schema.cronJobs)
					.where(eq(schema.cronJobs.id, cronJobId))
					.limit(1),
		);

		if (!cronJob) {
			throw new Error(`Cron job not found: ${cronJobId}`);
		}

		if (cronJob.status !== "active") {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				await db
					.update(schema.cronJobs)
					.set({
						lastStatus: "skipped",
						lastError: "Cron job is not active",
						updatedAt: new Date(),
					})
					.where(eq(schema.cronJobs.id, cronJob.id));
			});
			return {
				skipped: true,
				reason: "cron job is not active",
			};
		}

		try {
			const handler = cronActionRegistry.get(cronJob.actionType);
			return await handler({ cronJob, reason, dependencies, jobId });
		} catch (error) {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				await db
					.update(schema.cronJobs)
					.set({
						lastStatus: "failed",
						lastError:
							error instanceof Error ? error.message : "Cron job failed",
						runCount: sql`${schema.cronJobs.runCount} + 1`,
						updatedAt: new Date(),
					})
					.where(eq(schema.cronJobs.id, cronJob.id));
			});
			throw error;
		}
	}
}

const cronTriggerHandler = new CronTriggerHandler();
handlerRegistry.register({
	instance: cronTriggerHandler,
	jobs: [JOB_NAMES.cronTrigger],
});

declare global {
	interface JobTypeRegistry {
		"cron-trigger": CronTriggerPayload;
	}

	interface JobResultRegistry {
		"cron-trigger": Record<string, unknown>;
	}
}
