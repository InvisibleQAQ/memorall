// Payload types for remember-save handler
export interface SavePageData {
	html: string;
	url: string;
	title: string;
	metadata?: any;
	article?: {
		textContent?: string;
	};
	topicId?: string;
}

export interface SaveContentData {
	sourceType:
		| "webpage"
		| "selection"
		| "user_input"
		| "raw_text"
		| "file_upload";
	sourceUrl?: string;
	originalUrl?: string;
	title: string;
	rawContent?: string;
	cleanContent?: string;
	textContent?: string;
	topicId?: string;
}
import { documentStorageService } from "@/modules/documents/services/document-storage";
import { BaseProcessHandler } from "./base-process-handler";
import type { ProcessDependencies, BaseJob, ItemHandlerResult } from "./types";
import { backgroundProcessFactory } from "./process-factory";
import { serviceManager } from "@/services";

export type RememberSavePayload = SaveContentData | SavePageData;

// Define result types that handlers return
export interface RememberSaveResult extends Record<string, unknown> {
	filePath: string;
	fileName: string;
}

const JOB_NAMES = {
	rememberSave: "remember-save",
} as const;

// Define handler-specific job type locally
export type RememberSaveJob = BaseJob & {
	jobType: (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
	payload: RememberSavePayload;
};

export class RememberSaveHandler extends BaseProcessHandler<RememberSaveJob> {
	constructor() {
		super();
	}

	async process(
		jobId: string,
		job: RememberSaveJob,
		dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		const payload = job.payload;
		try {
			const title =
				"title" in payload ? (payload as { title: string }).title : "content";

			await dependencies.logger.info(
				`💾 Processing remember-save job: ${jobId}`,
				{ title },
				"offscreen",
			);

			await this.addProgress(jobId, "Preparing content...", 10, dependencies);

			// Determine content type and extract text
			let contentText = "";
			let fileName = "";
			let sourceInfo = "";

			if ("html" in payload && "article" in payload) {
				// Full page save
				const savePageData = payload as SavePageData;
				fileName =
					this.sanitizeFileName(savePageData.title || "webpage") + ".txt";
				sourceInfo = `Web Title: ${savePageData.title}\nWeb URL: ${savePageData.url}\n\n`;
				contentText =
					savePageData.article?.textContent || savePageData.html || "";
			} else {
				// Direct content save (selection, user input, etc.)
				const saveContentData = payload as SaveContentData;
				fileName =
					this.sanitizeFileName(saveContentData.title || "content") + ".txt";

				if (saveContentData.sourceType === "webpage") {
					sourceInfo = `Web Title: ${saveContentData.title}\nWeb URL: ${saveContentData.sourceUrl || ""}\n\n`;
				} else if (saveContentData.sourceType === "selection") {
					sourceInfo = `Selection from: ${saveContentData.title}\nOriginal URL: ${saveContentData.originalUrl || ""}\n\n`;
				} else if (saveContentData.sourceType === "user_input") {
					sourceInfo = `Note: ${saveContentData.title}\n\n`;
				}

				contentText =
					saveContentData.textContent ||
					saveContentData.cleanContent ||
					saveContentData.rawContent ||
					"";
			}

			// Combine source info with content
			const fullContent = sourceInfo + contentText;

			await this.addProgress(jobId, "Saving to file...", 50, dependencies);

			// Create a File object from the content
			const textBlob = new Blob([fullContent], { type: "text/plain" });
			const file = new File([textBlob], fileName, { type: "text/plain" });

			// Save to document library
			await documentStorageService.initialize();
			const savedFile = await documentStorageService.uploadFile(
				file,
				"/saved-content",
			);

			await dependencies.logger.info(
				`✅ Content saved as file: ${savedFile.path}`,
				{},
				"offscreen",
			);

			// If topicId is provided and not "default", save the relationship in topic_files table
			const topicId = payload.topicId;
			if (topicId && topicId !== "default") {
				await dependencies.logger.info(
					`🏷️ Linking file to topic: ${topicId}`,
					{},
					"offscreen",
				);

				await serviceManager.databaseService.use(async ({ db, schema }) => {
					await db.insert(schema.topicFiles).values({
						topicId: topicId,
						filePath: savedFile.path,
					});
				});

				await dependencies.logger.info(
					`✅ File linked to topic successfully`,
					{},
					"offscreen",
				);
			} else if (topicId === "default") {
				await dependencies.logger.info(
					`📄 File saved to default location (no topic association)`,
					{},
					"offscreen",
				);
			}

			await this.addProgress(jobId, "Finalizing...", 90, dependencies, {
				filePath: savedFile.path,
			});

			// Return the file info
			return this.createSuccessResult({
				filePath: savedFile.path,
				fileName: savedFile.name,
			});
		} catch (error) {
			return this.createErrorResult(error);
		}
	}

	private sanitizeFileName(name: string): string {
		// Remove invalid filename characters
		return name
			.replace(/[<>:"/\\|?*]/g, "_")
			.replace(/\s+/g, "_")
			.substring(0, 100); // Limit length
	}
}

// Self-register the handler
backgroundProcessFactory.register({
	instance: new RememberSaveHandler(),
	jobs: Object.values(JOB_NAMES),
});

// Extend global registry for smart type inference
declare global {
	interface JobTypeRegistry {
		"remember-save": RememberSavePayload;
	}

	interface JobResultRegistry {
		"remember-save": RememberSaveResult;
	}
}
