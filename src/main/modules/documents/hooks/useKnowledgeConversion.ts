/**
 * Knowledge Conversion Hook
 * React hook for converting documents to knowledge graphs with topic selection
 */

import { useCallback } from "react";
import { logInfo, logError } from "@/utils/logger";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { documentStorageService } from "../services/document-storage";
import { topicService } from "@/main/modules/topics/services/topic-service";
import type { DocumentFile } from "@/types/document-library";
import type { Topic } from "@/services/database/types";
import {
	parseExcelFile,
	workbookToMarkdown,
} from "../handlers/excel-extraction";
import NiceModal from "@ebay/nice-modal-react";
import { TopicPickerDialog } from "@/main/modules/topics/modals";
import { useProcessMonitor } from "@/main/stores/process-monitor";
import type { ProcessingSource } from "@/main/stores/process-monitor";

/**
 * Shared function for converting documents to knowledge graphs with topic selection
 * Can be used directly or through the hook
 */
export async function convertToKnowledge(
	file: DocumentFile,
	currentFileTopics: Topic[] = [],
	onTopicsUpdated?: () => void,
): Promise<void> {
	const { addProcess, updateProcess, removeProcess } =
		useProcessMonitor.getState();

	try {
		// Show topic picker modal
		const selectedTopicId = await NiceModal.show(TopicPickerDialog, {
			fileName: file.name,
		});

		// Only return if user explicitly cancelled (null)
		// undefined means "Default" (no topic), which should still process
		if (selectedTopicId === null) {
			return; // User cancelled
		}

		// Add to topic if new association and not default (selectedTopicId is a string)
		if (selectedTopicId && typeof selectedTopicId === "string") {
			const currentTopicIds = currentFileTopics.map((topic) => topic.id);
			const isNewAssociation = !currentTopicIds.includes(selectedTopicId);
			if (isNewAssociation) {
				await topicService.addFileToTopic(selectedTopicId, file.path);
				onTopicsUpdated?.();
			}
		}

		// Get content based on file type
		let content: string;
		const fileContent = await documentStorageService.getFileContent(file.id);

		switch (file.type) {
			case "text":
				content = new TextDecoder("utf-8").decode(fileContent);
				break;
			case "excel":
				const workbook = await parseExcelFile(fileContent);
				content = workbookToMarkdown(workbook);
				break;
			default:
				content = new TextDecoder("utf-8").decode(fileContent);
		}

		// Add to process monitor as processing
		const processSource: ProcessingSource = {
			id: crypto.randomUUID(),
			type: "page",
			raw: "",
			targetType: "file",
			targetId: file.path,
			name: file.name,
			metadata: {},
			referenceTime: null,
			weight: 1.0,
			status: "processing",
			statusValidFrom: new Date(),
			graph: "",
			createdAt: new Date(),
			updatedAt: new Date(),
			progress: 0,
			stage: "Starting conversion...",
		};
		addProcess(file.path, processSource);

		try {
			// Convert to knowledge
			const result = await backgroundJob.execute(
				"knowledge-graph",
				{
					filePath: file.path,
					content: content,
					topicId: selectedTopicId,
				},
				{ stream: false },
			);

			if ("promise" in result) {
				// Update progress while processing
				updateProcess(file.path, {
					progress: 50,
					stage: "Processing knowledge graph...",
				});

				await result.promise;

				// Update to completed
				updateProcess(file.path, {
					status: "completed",
					progress: 100,
					stage: "Completed",
					updatedAt: new Date(),
				});
			}

			logInfo("Knowledge conversion completed successfully");

			// Remove from active processes after a brief delay
			setTimeout(() => {
				removeProcess(file.path);
			}, 3000);
		} catch (conversionError) {
			// Update to failed state
			updateProcess(file.path, {
				status: "failed",
				stage: "Conversion failed",
				updatedAt: new Date(),
			});

			// Remove from active processes after showing error
			setTimeout(() => {
				removeProcess(file.path);
			}, 5000);

			throw conversionError;
		}
	} catch (error) {
		logError("Failed to convert to knowledge:", error);
		throw error;
	}
}

/**
 * Hook wrapper for the convertToKnowledge function
 */
export function useKnowledgeConversion() {
	const wrappedConvertToKnowledge = useCallback(convertToKnowledge, []);
	return { convertToKnowledge: wrappedConvertToKnowledge };
}
