import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { backgroundJob } from "@/services/background-jobs/background-job";
import type { IDatabaseService } from "@/services/database/interfaces/database-service.interface";
import { logError, logInfo } from "@/utils/logger";
import { CronJobServiceCore } from "./cron-job-service-core";
import { getNextCronRunAt } from "./cron-expression";

const TICK_INTERVAL_MS = 30_000;

export class CronJobServiceMain extends CronJobServiceCore {
	private tickTimer: ReturnType<typeof setInterval> | null = null;
	private ticking = false;
	private runningJobIds = new Set<string>();

	constructor(databaseService: IDatabaseService) {
		super(databaseService);
	}

	async initialize(): Promise<void> {
		await this.reload();
		if (!this.tickTimer) {
			this.tickTimer = setInterval(() => {
				void this.tick();
			}, TICK_INTERVAL_MS);
		}
		void this.tick();
		logInfo("[CRON] CronJobServiceMain initialized");
	}

	async reload(id?: string): Promise<void> {
		await this.databaseService.use(async ({ db, schema }) => {
			const rows = id
				? await db
						.select()
						.from(schema.cronJobs)
						.where(eq(schema.cronJobs.id, id))
						.limit(1)
				: await db
						.select()
						.from(schema.cronJobs)
						.where(eq(schema.cronJobs.status, "active"));

			for (const row of rows) {
				if (row.status !== "active") continue;
				if (row.nextRunAt && row.nextRunAt > new Date()) continue;
				try {
					await db
						.update(schema.cronJobs)
						.set({
							nextRunAt: getNextCronRunAt(row.scheduleExpression),
							lastError: null,
							updatedAt: new Date(),
						})
						.where(eq(schema.cronJobs.id, row.id));
				} catch (error) {
					await db
						.update(schema.cronJobs)
						.set({
							status: "paused",
							lastStatus: "failed",
							lastError:
								error instanceof Error ? error.message : "Invalid schedule",
							updatedAt: new Date(),
						})
						.where(eq(schema.cronJobs.id, row.id));
				}
			}
		});
	}

	async triggerNow(id: string): Promise<void> {
		const result = await backgroundJob.execute(
			"cron-trigger",
			{ cronJobId: id, reason: "manual" },
			{ stream: false },
		);
		if ("promise" in result) {
			await result.promise;
		}
	}

	private async tick(): Promise<void> {
		if (this.ticking) return;
		this.ticking = true;
		try {
			const now = new Date();
			const dueJobs = await this.databaseService.use(async ({ db, schema }) =>
				db
					.select()
					.from(schema.cronJobs)
					.where(
						and(
							eq(schema.cronJobs.status, "active"),
							isNotNull(schema.cronJobs.nextRunAt),
							lte(schema.cronJobs.nextRunAt, now),
						),
					),
			);

			for (const job of dueJobs) {
				if (!job.allowOverlap && this.runningJobIds.has(job.id)) {
					await this.advanceSkippedJob(job.id, job.scheduleExpression);
					continue;
				}
				await this.advanceDueJob(job.id, job.scheduleExpression);
				this.runningJobIds.add(job.id);
				void backgroundJob
					.execute(
						"cron-trigger",
						{ cronJobId: job.id, reason: "schedule" },
						{ stream: false },
					)
					.finally(() => {
						this.runningJobIds.delete(job.id);
					});
			}
		} catch (error) {
			logError("[CRON] Tick failed:", error);
		} finally {
			this.ticking = false;
		}
	}

	private async advanceDueJob(
		cronJobId: string,
		expression: string,
	): Promise<void> {
		const nextRunAt = getNextCronRunAt(expression);
		await this.databaseService.use(async ({ db, schema }) => {
			await db
				.update(schema.cronJobs)
				.set({
					nextRunAt,
					lastStatus: "running",
					lastRunAt: new Date(),
					lastError: null,
					updatedAt: new Date(),
				})
				.where(eq(schema.cronJobs.id, cronJobId));
		});
	}

	private async advanceSkippedJob(
		cronJobId: string,
		expression: string,
	): Promise<void> {
		const nextRunAt = getNextCronRunAt(expression);
		await this.databaseService.use(async ({ db, schema }) => {
			await db
				.update(schema.cronJobs)
				.set({
					nextRunAt,
					lastStatus: "skipped",
					lastError: "Previous run is still active",
					runCount: sql`${schema.cronJobs.runCount} + 1`,
					updatedAt: new Date(),
				})
				.where(eq(schema.cronJobs.id, cronJobId));
		});
	}
}
