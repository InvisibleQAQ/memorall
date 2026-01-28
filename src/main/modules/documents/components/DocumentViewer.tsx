/**
 * Document Viewer Component
 * Display detailed information and preview for selected document
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	FileText,
	Calendar,
	HardDrive,
	FileType,
	Download,
	Trash2,
	X,
	Info,
	BookmarkPlus,
	Tag,
	Tags,
} from "lucide-react";
import { eq, inArray } from "drizzle-orm";

import { logInfo, logError } from "@/utils/logger";
import { serviceManager } from "@/services";
import { TopicBadgeList } from "@/main/modules/topics/components";
import { useIsProcessing } from "@/main/stores/process-monitor";
import type { DocumentFile } from "@/types/document-library";
import type { Topic } from "@/services/database/types";
import { ScrollArea } from "@/main/components/ui/scroll-area";
import { Button } from "@/main/components/ui/button";
import { Badge } from "@/main/components/ui/badge";
import { Separator } from "@/main/components/ui/separator";
import { documentStorageService } from "@/main/modules/documents/services/document-storage";

import { PDFPageSelector } from "./PDFPageSelector";
import { ExcelViewer } from "./ExcelViewer";
import { ExcelSheetSelector } from "./ExcelSheetSelector";
import { useModalSelector } from "../hooks/useModalSelector";
import { useSourceStatus } from "../hooks/useSourceStatus";
import { editorRegistry } from "../editors";

interface DocumentViewerProps {
	file: DocumentFile;
	onClose?: () => void;
	onDelete?: () => void;
	onDownload?: () => void;
	onManageTopics?: (file: DocumentFile) => void;
	onConvertToKnowledge?: (file: DocumentFile) => void;
	fileTopics?: Topic[];
	selectedTopicIds?: string[];
	onTopicClick?: (topicId: string) => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
	file,
	onClose,
	onDelete,
	onDownload,
	onManageTopics,
	onConvertToKnowledge,
	fileTopics: propFileTopics,
	selectedTopicIds = [],
	onTopicClick,
}) => {
	const { t } = useTranslation("documents");
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [textContent, setTextContent] = useState<string | null>(null);
	const [excelData, setExcelData] = useState<Uint8Array | null>(null);
	const [loading, setLoading] = useState(false);
	const [showProperties, setShowProperties] = useState(false);
	const pdfPageSelector = useModalSelector();
	const excelSheetSelector = useModalSelector();
	const [loadedFileTopics, setLoadedFileTopics] = useState<Topic[]>([]);

	// Track knowledge generation status using source and process monitor
	const sourceStatus = useSourceStatus(file.path);
	const isProcessing = useIsProcessing(file.path);

	// Use prop topics if provided, otherwise use loaded topics
	const fileTopics = propFileTopics || loadedFileTopics;

	useEffect(() => {
		// Load preview for supported file types
		const loadPreview = async () => {
			if (file.type === "pdf" || file.type === "image") {
				setLoading(true);
				try {
					const content = await documentStorageService.getFileContent(file.id);
					// Create blob directly from Uint8Array
					const blob = new Blob([content] as unknown as BlobPart[], {
						type: file.mimeType,
					});
					const url = URL.createObjectURL(blob);
					setPreviewUrl(url);
				} catch (error) {
					logError("Failed to load preview:", error);
				} finally {
					setLoading(false);
				}
			} else if (file.type === "text" || file.type === "markdown") {
				setLoading(true);
				try {
					const content = await documentStorageService.getFileContent(file.id);
					const textDecoder = new TextDecoder("utf-8");
					const text = textDecoder.decode(content);
					setTextContent(text);
				} catch (error) {
					logError("Failed to load text content:", error);
				} finally {
					setLoading(false);
				}
			} else if (file.type === "excel") {
				setLoading(true);
				try {
					logInfo("Loading Excel file content for:", file.name);
					const content = await documentStorageService.getFileContent(file.id);
					logInfo("Excel content loaded, size:", content.length, "bytes");
					setExcelData(content);
					logInfo("Excel data set in state");
				} catch (error) {
					logError("Failed to load Excel file:", error);
				} finally {
					setLoading(false);
				}
			}
		};

		loadPreview();

		return () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	}, [file.id]);

	// Load topics for this file (only if not provided via props)
	useEffect(() => {
		if (propFileTopics) return; // Skip if topics provided via props

		const loadTopics = async () => {
			try {
				// Get all topics and their files, then filter for this file
				const allTopics = await serviceManager.databaseService.use(
					async ({ db, schema }) => {
						// Get all topic_files entries for this file
						const topicFileEntries = await db
							.select()
							.from(schema.topicFiles)
							.where(eq(schema.topicFiles.filePath, file.path));

						if (topicFileEntries.length === 0) {
							return [];
						}

						// Get the topics for these entries
						const topicIds = topicFileEntries.map((tf) => tf.topicId);
						const topics = await db
							.select()
							.from(schema.topics)
							.where(inArray(schema.topics.id, topicIds));

						return topics;
					},
				);

				setLoadedFileTopics(allTopics);
			} catch (error) {
				logError("Failed to load file topics:", error);
			}
		};

		loadTopics();
	}, [file.path, propFileTopics]);

	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	};

	const formatDate = (date: Date): string => {
		return new Intl.DateTimeFormat("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	};

	const handleSaveContent = async (content: string): Promise<void> => {
		try {
			// Convert content to Uint8Array
			const encoder = new TextEncoder();
			const contentArray = encoder.encode(content);

			// Update the file content
			// This will NOT trigger tree reload (content-only changes)
			await documentStorageService.updateFileContent(file.id, contentArray);

			// Update local state after successful save
			setTextContent(content);

			logInfo(`[DOCUMENT_VIEWER] Saved ${file.name}`);
		} catch (error) {
			logError("[DOCUMENT_VIEWER] Failed to save file:", error);
			throw error;
		}
	};

	const handleConvertPages = () => {
		// Simplified callback - conversion happens in background job now
		logInfo("PDF pages converted successfully");
		alert("Successfully converted PDF pages to remembered content!");
	};

	return (
		<div className="flex flex-col h-full bg-card">
			{/* Header */}
			<div className="flex items-start justify-between p-4 border-b">
				<div className="flex-1 min-w-0 mr-4">
					{/* File name + metadata on same line */}
					<div className="flex items-center gap-2 flex-wrap mb-2">
						<h2 className="text-lg font-semibold truncate">{file.name}</h2>
						{file.metadata?.pageCount && (
							<>
								<span className="text-muted-foreground">•</span>
								<span className="text-sm text-muted-foreground">
									{t("viewer.pages", { count: file.metadata.pageCount })}
								</span>
							</>
						)}
						{file.metadata?.sheetCount && (
							<>
								<span className="text-muted-foreground">•</span>
								<span className="text-sm text-muted-foreground">
									{t("viewer.sheets", { count: file.metadata.sheetCount })}
								</span>
							</>
						)}
					</div>

					{/* Topic Badges - Second line */}
					{fileTopics.length > 0 ? (
						<div className="flex items-center gap-2 flex-wrap">
							<TopicBadgeList
								topics={fileTopics}
								maxVisible={3}
								size="sm"
								onTopicClick={(topic) => onTopicClick?.(topic.id)}
								activeTopicIds={selectedTopicIds}
							/>
							{onManageTopics && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => onManageTopics(file)}
									className="h-6 px-2 text-xs"
								>
									<Tags className="h-3 w-3 mr-1" />
									{t("viewer.manage")}
								</Button>
							)}
						</div>
					) : onManageTopics ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => onManageTopics(file)}
							className="h-7 px-2 text-xs gap-1"
						>
							<Tags className="h-3 w-3" />
							{t("viewer.addTopics")}
						</Button>
					) : null}
				</div>
				<div className="flex items-center gap-1">
					{file.type === "pdf" && (
						<Button
							variant="default"
							size="sm"
							onClick={pdfPageSelector.openSelector}
						>
							<BookmarkPlus className="h-4 w-4 mr-2" />
							<span className="hidden sm:inline">
								{t("viewer.convertToKnowledge")}
							</span>
						</Button>
					)}
					{(file.type === "text" || file.type === "markdown") &&
						onConvertToKnowledge && (
							<Button
								variant="default"
								size="sm"
								onClick={() => onConvertToKnowledge(file)}
								disabled={sourceStatus.isGenerating || isProcessing}
							>
								<BookmarkPlus className="h-4 w-4 mr-2" />
								<span className="hidden sm:inline">
									{sourceStatus.isGenerating || isProcessing
										? t("viewer.converting")
										: t("viewer.convertToKnowledge")}
								</span>
							</Button>
						)}
					{file.type === "excel" && (
						<Button
							variant="default"
							size="sm"
							onClick={excelSheetSelector.openSelector}
						>
							<BookmarkPlus className="h-4 w-4 mr-2" />
							<span className="hidden sm:inline">
								{t("viewer.convertToKnowledge")}
							</span>
						</Button>
					)}
					<Button
						variant={showProperties ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setShowProperties(!showProperties)}
					>
						<Info className="h-4 w-4" />
					</Button>
					{onDownload && (
						<Button variant="ghost" size="sm" onClick={onDownload}>
							<Download className="h-4 w-4" />
						</Button>
					)}
					{onDelete && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onDelete}
							className="text-destructive hover:text-destructive"
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					)}
					{onClose && (
						<Button variant="ghost" size="sm" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>

			{/* Content Area - Flex layout */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Preview Section - Takes remaining space */}
				{file.type === "pdf" && previewUrl && (
					<div className="flex-1 p-4 overflow-hidden">
						<div className="border rounded-lg overflow-hidden h-full">
							<iframe
								src={previewUrl}
								className="w-full h-full"
								title={file.name}
							/>
						</div>
					</div>
				)}

				{file.type === "image" && previewUrl && (
					<div className="flex-1 p-4 overflow-hidden">
						<div className="border rounded-lg overflow-hidden h-full flex items-center justify-center bg-muted/20">
							<img
								src={previewUrl}
								alt={file.name}
								className="max-w-full max-h-full object-contain"
							/>
						</div>
					</div>
				)}

				{file.type === "text" && textContent && (
					<ScrollArea className="flex-1 p-4">
						<div className="border rounded-lg p-4 bg-muted/20">
							<pre className="text-sm whitespace-pre-wrap font-mono">
								{textContent}
							</pre>
						</div>
					</ScrollArea>
				)}

				{file.type === "markdown" &&
					textContent !== null &&
					(() => {
						const EditorComponent =
							editorRegistry.getEditorComponent("markdown");
						if (EditorComponent) {
							return (
								<div className="flex-1 overflow-hidden">
									<EditorComponent
										file={file}
										initialContent={textContent}
										onSave={handleSaveContent}
									/>
								</div>
							);
						}
						// Fallback to text preview if editor not available
						return (
							<ScrollArea className="flex-1 p-4">
								<div className="border rounded-lg p-4 bg-muted/20">
									<pre className="text-sm whitespace-pre-wrap font-mono">
										{textContent}
									</pre>
								</div>
							</ScrollArea>
						);
					})()}

				{file.type === "excel" && excelData && (
					<div className="flex-1 p-4 overflow-hidden">
						<div className="border rounded-lg overflow-hidden h-full">
							<ExcelViewer
								fileData={excelData}
								fileName={file.name}
								className="h-full"
							/>
						</div>
					</div>
				)}

				{loading && (
					<div className="flex-1 p-4 overflow-hidden">
						<div className="flex items-center justify-center h-full border rounded-lg">
							<div className="text-sm text-muted-foreground">
								{t("viewer.loadingPreview")}
							</div>
						</div>
					</div>
				)}

				{/* Metadata Section - Only show when showProperties is true */}
				{showProperties && (
					<ScrollArea className="flex-shrink-0 border-t max-h-[400px]">
						<div className="p-4 space-y-4">
							<h3 className="text-sm font-semibold">
								{t("viewer.documentInformation")}
							</h3>

							<div className="grid grid-cols-1 gap-3">
								{file.metadata?.title && (
									<div className="flex items-start gap-3">
										<FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
										<div className="flex-1 min-w-0">
											<div className="text-xs text-muted-foreground">
												{t("viewer.title")}
											</div>
											<div className="text-sm">{file.metadata.title}</div>
										</div>
									</div>
								)}

								{file.metadata?.author && (
									<div className="flex items-start gap-3">
										<FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
										<div className="flex-1 min-w-0">
											<div className="text-xs text-muted-foreground">
												{t("viewer.author")}
											</div>
											<div className="text-sm">{file.metadata.author}</div>
										</div>
									</div>
								)}

								{file.metadata?.sheetCount && (
									<div className="flex items-start gap-3">
										<FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
										<div className="flex-1 min-w-0">
											<div className="text-xs text-muted-foreground">
												{t("viewer.sheetsLabel")}
											</div>
											<div className="text-sm">{file.metadata.sheetCount}</div>
										</div>
									</div>
								)}

								{file.metadata?.sheetNames &&
									file.metadata.sheetNames.length > 0 && (
										<div className="flex items-start gap-3">
											<FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
											<div className="flex-1 min-w-0">
												<div className="text-xs text-muted-foreground">
													{t("viewer.sheetNames")}
												</div>
												<div className="text-sm">
													{file.metadata.sheetNames.join(", ")}
												</div>
											</div>
										</div>
									)}

								<Separator />

								<div className="flex items-start gap-3">
									<FileType className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="text-xs text-muted-foreground">
											{t("viewer.type")}
										</div>
										<div className="text-sm">{file.mimeType}</div>
									</div>
								</div>

								<div className="flex items-start gap-3">
									<HardDrive className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="text-xs text-muted-foreground">
											{t("viewer.size")}
										</div>
										<div className="text-sm">{formatFileSize(file.size)}</div>
									</div>
								</div>

								<div className="flex items-start gap-3">
									<Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="text-xs text-muted-foreground">
											{t("viewer.created")}
										</div>
										<div className="text-sm">{formatDate(file.createdAt)}</div>
									</div>
								</div>

								<div className="flex items-start gap-3">
									<Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="text-xs text-muted-foreground">
											{t("viewer.modified")}
										</div>
										<div className="text-sm">{formatDate(file.modifiedAt)}</div>
									</div>
								</div>
							</div>

							{/* Tags Section */}
							{file.metadata?.tags && file.metadata.tags.length > 0 && (
								<div className="space-y-2">
									<h3 className="text-sm font-semibold">{t("viewer.tags")}</h3>
									<div className="flex flex-wrap gap-2">
										{file.metadata.tags.map((tag, index) => (
											<Badge key={index} variant="outline">
												{tag}
											</Badge>
										))}
									</div>
								</div>
							)}

							{/* Topics Section */}
							{fileTopics.length > 0 && (
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<Tag className="h-4 w-4 text-muted-foreground" />
										<h3 className="text-sm font-semibold">
											{t("viewer.topics")}
										</h3>
									</div>
									<div className="flex flex-wrap gap-2">
										{fileTopics.map((topic) => (
											<Badge key={topic.id} variant="secondary">
												{topic.name}
											</Badge>
										))}
									</div>
								</div>
							)}

							{/* Description Section */}
							{file.metadata?.description && (
								<div className="space-y-2">
									<h3 className="text-sm font-semibold">
										{t("viewer.description")}
									</h3>
									<p className="text-sm text-muted-foreground">
										{file.metadata.description}
									</p>
								</div>
							)}
						</div>
					</ScrollArea>
				)}
			</div>

			{/* PDF Page Selector Dialog */}
			{file.type === "pdf" && (
				<PDFPageSelector
					file={file}
					open={pdfPageSelector.showSelector}
					onOpenChange={pdfPageSelector.setShowSelector}
					onConvert={handleConvertPages}
				/>
			)}

			{/* Excel Sheet Selector Dialog */}
			{file.type === "excel" && (
				<ExcelSheetSelector
					file={file}
					open={excelSheetSelector.showSelector}
					onOpenChange={excelSheetSelector.setShowSelector}
					onConvert={handleConvertPages}
				/>
			)}
		</div>
	);
};
