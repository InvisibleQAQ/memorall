import { knowledgeGraphService } from "@/modules/knowledge/services/knowledge-graph-service";
import type { ConversionProgress } from "@/types/knowledge-graph";
import { BaseProcessHandler } from "./base-process-handler";
import type {
	ProcessDependencies,
	BaseJob,
	ItemHandlerResult,
	JobProgressUpdate,
} from "./types";
import type { ILLMService } from "@/services/llm/interfaces/llm-service.interface";
import { serviceManager } from "@/services";
import { backgroundProcessFactory } from "./process-factory";
import { and, eq } from "drizzle-orm";

// Knowledge graph payload - file path, content, and optional topicId
export interface KnowledgeGraphPayload {
	filePath: string;
	content: string;
	topicId?: string; // undefined means default (no topic)
}

// Define result types that handlers return
export interface KnowledgeGraphResult extends Record<string, unknown> {
	pageTitle: string; // Contains filePath for compatibility
}

// Extend global registry for smart type inference
declare global {
	interface JobTypeRegistry {
		"knowledge-graph": KnowledgeGraphPayload;
	}

	interface JobResultRegistry {
		"knowledge-graph": KnowledgeGraphResult;
	}
}

const JOB_NAMES = {
	convertPageToKnowledgeGraph: "knowledge-graph",
} as const;

export type KnowledgeGraphJob = BaseJob & {
	jobType: (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
	payload: KnowledgeGraphPayload;
};

export class KnowledgeGraphHandler extends BaseProcessHandler<KnowledgeGraphJob> {
	constructor() {
		super();
	}

	async process(
		jobId: string,
		job: KnowledgeGraphJob,
		dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		// Job is properly typed - no casting needed
		const pageData = job.payload;

		await dependencies.logger.info(
			`🔄 Starting knowledge graph job: ${jobId}`,
			{
				filePath: pageData.filePath,
			},
			"offscreen",
		);
		const llmService = serviceManager.llmService as ILLMService;

		// DEBUG: Check what services we have before processing
		const availableServices = llmService.list();
		await dependencies.logger.info(
			"🔍 DEBUG: Before knowledge graph processing:",
			{
				availableServices,
				hasLmstudio: llmService.has("lmstudio"),
				hasOpenai: llmService.has("openai"),
			},
			"offscreen",
		);

		try {
			// Update source status to processing at the start
			await this.updateSourceStatus(pageData.filePath, "processing");

			// Send initial progress update
			await dependencies.updateJobProgress(jobId, {
				stage: "Starting background processing...",
				progress: 5,
			});

			// Subscribe to knowledge graph service progress for detailed logging
			const unsubscribe = knowledgeGraphService.subscribe((conversions) => {
				const conversion = conversions.get(pageData.filePath);
				if (!conversion) return;

				const progressUpdate = this.mapConversionToJobProgress(conversion);
				void dependencies.updateJobProgress(jobId, progressUpdate);
				dependencies.logger.info(
					`📊 Job ${jobId} progress: ${conversion.stage}`,
					{
						status: conversion.status,
						progress: conversion.progress,
						stage: conversion.stage,
					},
					"offscreen",
				);
			});

			try {
				await dependencies.logger.info(
					`🧠 Processing knowledge graph for: ${pageData.filePath}`,
					{
						jobId,
						filePath: pageData.filePath,
						contentLength: pageData.content.length,
					},
					"offscreen",
				);

				await knowledgeGraphService.convertPageToKnowledgeGraph(
					pageData.filePath,
					pageData.content,
					pageData.topicId, // Pass the topicId (undefined for default)
				);

				await dependencies.logger.info(
					`✅ Knowledge graph job completed successfully: ${jobId}`,
					{
						filePath: pageData.filePath,
					},
					"offscreen",
				);

				// Source status is already updated by knowledgeGraphService.convertPageToKnowledgeGraph
				return { pageTitle: pageData.filePath };
			} finally {
				unsubscribe();
			}
		} catch (error) {
			// Update source status to failed on error
			await this.updateSourceStatus(pageData.filePath, "failed");
			throw error;
		}
	}

	private async updateSourceStatus(
		filePath: string,
		status: "pending" | "processing" | "completed" | "failed",
	): Promise<void> {
		try {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				const now = new Date();
				await db
					.update(schema.sources)
					.set({
						status,
						statusValidFrom: now,
						updatedAt: now,
					})
					.where(
						and(
							eq(schema.sources.targetType, "file"),
							eq(schema.sources.targetId, filePath),
						),
					);
			});
		} catch (error) {
			// Log but don't fail the job
			console.error(
				`Failed to update source status for file ${filePath}:`,
				error,
			);
		}
	}

	private mapConversionToJobProgress(
		conversion: ConversionProgress,
	): JobProgressUpdate {
		const status =
			conversion.status === "failed"
				? "failed"
				: conversion.status === "completed"
					? "completed"
					: "processing";

		const update: JobProgressUpdate = {
			stage: conversion.stage,
			progress: conversion.progress,
			status,
			completedAt: conversion.completedAt,
			error: conversion.error,
			metadata: {
				conversionStatus: conversion.status,
				filePath: conversion.pageId, // pageId contains filePath
			},
		};

		if (status === "completed" && conversion.knowledgeGraph) {
			update.result = {
				filePath: conversion.pageId, // pageId contains filePath
				knowledgeGraph: conversion.knowledgeGraph,
				stats: conversion.stats,
			};
		}

		return update;
	}
}

// Self-register the handler
backgroundProcessFactory.register({
	instance: new KnowledgeGraphHandler(),
	jobs: Object.values(JOB_NAMES),
});
