/**
 * Knowledge Conversion Hook
 * React hook for converting documents to knowledge graphs with topic selection
 */

import { useCallback } from "react";
import { logInfo, logError } from "@/utils/logger";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { documentStorageService } from "../services/document-storage";
import { topicService } from "@/modules/topics/services/topic-service";
import type { DocumentFile } from "@/types/document-library";
import type { Topic } from "@/services/database/entities/topics";
import {
	parseExcelFile,
	workbookToMarkdown,
} from "../handlers/excel-extraction";
import NiceModal from "@ebay/nice-modal-react";
import { TopicPickerDialog } from "@/modules/topics/modals";

/**
 * Shared function for converting documents to knowledge graphs with topic selection
 * Can be used directly or through the hook
 */
export async function convertToKnowledge(
	file: DocumentFile,
	currentFileTopics: Topic[] = [],
	onTopicsUpdated?: () => void,
): Promise<void> {
	try {
		// Show topic picker modal
		const selectedTopicId = await NiceModal.show(TopicPickerDialog, {
			fileName: file.name,
		});

		if (selectedTopicId === null || typeof selectedTopicId !== "string") {
			return; // User cancelled
		}

		// Add to topic if new association and not default
		if (selectedTopicId) {
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
			await result.promise;
		}

		logInfo("Knowledge conversion completed successfully");
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
