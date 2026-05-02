import { and, eq } from "drizzle-orm";
import type { IDatabaseService } from "@/services/database/interfaces/database-service.interface";
import type { CronJob, NewCronJob } from "@/services/database/types";
import { v4 } from "@/utils/uuid";
import {
	getLocalTimezone,
	getNextCronRunAt,
	validateCronExpression,
} from "./cron-expression";
import type {
	CronJobSaveInput,
	CronJobValidation,
	ICronJobService,
} from "./types";

export abstract class CronJobServiceCore implements ICronJobService {
	constructor(protected databaseService: IDatabaseService) {}

	async initialize(): Promise<void> {}

	validateSchedule(
		expression: string,
		from: Date = new Date(),
	): CronJobValidation {
		const validation = validateCronExpression(expression);
		if (!validation.valid) {
			return validation;
		}
		try {
			return {
				valid: true,
				nextRunAt: getNextCronRunAt(expression, from),
			};
		} catch (error) {
			return {
				valid: false,
				error: error instanceof Error ? error.message : "Invalid schedule",
			};
		}
	}

	getNextRunAt(expression: string, from: Date = new Date()): Date {
		return getNextCronRunAt(expression, from);
	}

	async listByAgent(agentFlowId: string): Promise<CronJob[]> {
		return this.databaseService.use(async ({ db, schema }) =>
			db
				.select()
				.from(schema.cronJobs)
				.where(eq(schema.cronJobs.agentFlowId, agentFlowId)),
		);
	}

	protected normalizeInput(input: CronJobSaveInput): NewCronJob {
		const scheduleExpression = input.scheduleExpression.trim();
		const validation = this.validateSchedule(scheduleExpression);
		if (!validation.valid) {
			throw new Error(validation.error || "Invalid cron expression");
		}
		return {
			id: input.id ?? v4(),
			name: input.name.trim() || "Scheduled task",
			status: input.status,
			scheduleExpression,
			timezone: input.timezone || getLocalTimezone(),
			actionType: input.actionType,
			actionPayload: input.actionPayload,
			agentFlowId: input.agentFlowId ?? null,
			conversationId: input.conversationId ?? null,
			allowOverlap: Boolean(input.allowOverlap),
			nextRunAt:
				input.status === "active"
					? (validation.nextRunAt ?? getNextCronRunAt(scheduleExpression))
					: null,
			lastStatus: "idle",
			metadata: input.metadata ?? {},
		};
	}

	async save(input: CronJobSaveInput): Promise<CronJob> {
		const values = this.normalizeInput(input);
		const existing = input.id
			? await this.databaseService.use(async ({ db, schema }) =>
					db
						.select({ id: schema.cronJobs.id })
						.from(schema.cronJobs)
						.where(eq(schema.cronJobs.id, input.id!))
						.limit(1),
				)
			: [];

		const saved = await this.databaseService.transaction(
			async ({ db, schema }) => {
				if (existing.length > 0) {
					const [updated] = await db
						.update(schema.cronJobs)
						.set({
							name: values.name,
							status: values.status,
							scheduleExpression: values.scheduleExpression,
							timezone: values.timezone,
							actionType: values.actionType,
							actionPayload: values.actionPayload,
							agentFlowId: values.agentFlowId,
							conversationId: values.conversationId,
							allowOverlap: values.allowOverlap,
							nextRunAt: values.nextRunAt,
							metadata: values.metadata,
							updatedAt: new Date(),
						})
						.where(eq(schema.cronJobs.id, input.id!))
						.returning();
					return updated;
				}

				const [created] = await db
					.insert(schema.cronJobs)
					.values(values)
					.returning();
				return created;
			},
		);

		await this.reload(saved.id);
		return saved;
	}

	async saveManyForAgent(
		agentFlowId: string,
		jobs: CronJobSaveInput[],
		options: { activateDrafts?: boolean } = {},
	): Promise<CronJob[]> {
		const normalizedJobs = jobs.map((job) => ({
			...job,
			agentFlowId,
			status:
				options.activateDrafts && job.status === "draft"
					? ("active" as const)
					: job.status,
			actionPayload: {
				...job.actionPayload,
				agentFlowId,
			},
		}));
		const keepIds = new Set(
			normalizedJobs.map((job) => job.id).filter(Boolean),
		);

		const saved = await this.databaseService.transaction(
			async ({ db, schema }) => {
				const existing = await db
					.select({ id: schema.cronJobs.id })
					.from(schema.cronJobs)
					.where(eq(schema.cronJobs.agentFlowId, agentFlowId));

				for (const row of existing) {
					if (!keepIds.has(row.id)) {
						await db
							.delete(schema.cronJobs)
							.where(eq(schema.cronJobs.id, row.id));
					}
				}

				const saved: CronJob[] = [];
				for (const job of normalizedJobs) {
					const values = this.normalizeInput(job);
					const exists = job.id && existing.some((row) => row.id === job.id);
					if (exists) {
						const [updated] = await db
							.update(schema.cronJobs)
							.set({
								name: values.name,
								status: values.status,
								scheduleExpression: values.scheduleExpression,
								timezone: values.timezone,
								actionType: values.actionType,
								actionPayload: values.actionPayload,
								agentFlowId: values.agentFlowId,
								conversationId: values.conversationId,
								allowOverlap: values.allowOverlap,
								nextRunAt: values.nextRunAt,
								metadata: values.metadata,
								updatedAt: new Date(),
							})
							.where(
								and(
									eq(schema.cronJobs.id, job.id!),
									eq(schema.cronJobs.agentFlowId, agentFlowId),
								),
							)
							.returning();
						saved.push(updated);
						continue;
					}
					const [created] = await db
						.insert(schema.cronJobs)
						.values(values)
						.returning();
					saved.push(created);
				}

				return saved;
			},
		);

		await this.reload();
		return saved;
	}

	async delete(id: string): Promise<void> {
		await this.databaseService.use(async ({ db, schema }) => {
			await db.delete(schema.cronJobs).where(eq(schema.cronJobs.id, id));
		});
		await this.reload(id);
	}

	abstract triggerNow(id: string): Promise<void>;
	abstract reload(id?: string): Promise<void>;
}
