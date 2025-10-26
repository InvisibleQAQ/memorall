/**
 * Document Viewer Component
 * Display detailed information and preview for selected document
 */

import React, { useState, useEffect } from "react";
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
import type { DocumentFile } from "@/types/document-library";
import type { Topic } from "@/services/database/entities/topics";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { documentStorageService } from "@/modules/documents/services/document-storage";
import { PDFPageSelector } from "./PDFPageSelector";
import { ExcelViewer } from "./ExcelViewer";
import { logInfo, logError } from "@/utils/logger";
import { backgroundJob } from "@/services/background-jobs/background-job";
import {
	parseExcelFile,
	workbookToMarkdown,
} from "@/embedded/excel-extraction";
import { serviceManager } from "@/services";
import { eq, inArray } from "drizzle-orm";
import { TopicBadgeList } from "@/modules/topics/components";

interface DocumentViewerProps {
	file: DocumentFile;
	onClose?: () => void;
	onDelete?: () => void;
	onDownload?: () => void;
	onManageTopics?: (file: DocumentFile) => void;
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
	fileTopics: propFileTopics,
	selectedTopicIds = [],
	onTopicClick,
}) => {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [textContent, setTextContent] = useState<string | null>(null);
	const [excelData, setExcelData] = useState<Uint8Array | null>(null);
	const [loading, setLoading] = useState(false);
	const [showProperties, setShowProperties] = useState(false);
	const [showPageSelector, setShowPageSelector] = useState(false);
	const [converting, setConverting] = useState(false);
	const [loadedFileTopics, setLoadedFileTopics] = useState<Topic[]>([]);

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
					console.error("Failed to load preview:", error);
				} finally {
					setLoading(false);
				}
			} else if (file.type === "text") {
				setLoading(true);
				try {
					const content = await documentStorageService.getFileContent(file.id);
					const textDecoder = new TextDecoder("utf-8");
					const text = textDecoder.decode(content);
					setTextContent(text);
				} catch (error) {
					console.error("Failed to load text content:", error);
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

	const handleConvertPages = () => {
		// Simplified callback - conversion happens in background job now
		logInfo("PDF pages converted successfully");
		alert("Successfully converted PDF pages to remembered content!");
	};

	const handleConvertText = async () => {
		try {
			setConverting(true);

			// Get file content from storage and convert to text in main thread
			const fileContent = await documentStorageService.getFileContent(file.id);

			logInfo(`Converting text file in main thread: ${file.name}`);

			// Decode text content in main thread
			const textDecoder = new TextDecoder("utf-8");
			const textContent = textDecoder.decode(fileContent);

			// Create title from file name
			const title = file.name.replace(/\\.txt$/i, "");

			logInfo(`Text converted in main thread, sending to knowledge graph...`);

			// Send text content directly to knowledge graph handler
			const { jobId, promise } = await backgroundJob.execute(
				"knowledge-graph",
				{
					filePath: file.path,
					content: textContent,
				},
				{ stream: false },
			);

			logInfo(`Knowledge graph job created: ${jobId}`);

			// Wait for completion
			const result = await promise;

			logInfo(`Knowledge graph generation completed:`, result);

			alert("Successfully generated knowledge graph from text file!");
		} catch (error) {
			logError("Failed to convert text file:", error);
			alert("Failed to convert text file. Please try again.");
		} finally {
			setConverting(false);
		}
	};

	const handleConvertExcel = async () => {
		try {
			setConverting(true);

			// Get file content from storage
			const fileContent = await documentStorageService.getFileContent(file.id);

			logInfo(`Converting Excel file in main thread: ${file.name}`);

			// Parse Excel file and convert to markdown
			const workbook = await parseExcelFile(fileContent);
			const markdownContent = workbookToMarkdown(workbook);

			// Create title from file name
			const title = file.name.replace(/\.(xls|xlsx|xlsm)$/i, "");

			logInfo(
				`Excel converted to markdown in main thread, sending to knowledge graph...`,
			);

			// Send markdown content directly to knowledge graph handler
			const { jobId, promise } = await backgroundJob.execute(
				"knowledge-graph",
				{
					filePath: file.path,
					content: markdownContent,
				},
				{ stream: false },
			);

			logInfo(`Knowledge graph job created: ${jobId}`);

			// Wait for completion
			const result = await promise;

			logInfo(`Knowledge graph generation completed:`, result);

			alert("Successfully generated knowledge graph from Excel file!");
		} catch (error) {
			logError("Failed to convert Excel file:", error);
			alert("Failed to convert Excel file. Please try again.");
		} finally {
			setConverting(false);
		}
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
									{file.metadata.pageCount} pages
								</span>
							</>
						)}
						{file.metadata?.sheetCount && (
							<>
								<span className="text-muted-foreground">•</span>
								<span className="text-sm text-muted-foreground">
									{file.metadata.sheetCount} sheets
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
									Manage
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
							Add Topics
						</Button>
					) : null}
				</div>
				<div className="flex items-center gap-1">
					{file.type === "pdf" && (
						<Button
							variant="default"
							size="sm"
							onClick={() => setShowPageSelector(true)}
						>
							<BookmarkPlus className="h-4 w-4 mr-2" />
							<span className="hidden sm:inline">Convert to Knowledge</span>
						</Button>
					)}
					{file.type === "text" && (
						<Button
							variant="default"
							size="sm"
							onClick={handleConvertText}
							disabled={converting}
						>
							<BookmarkPlus className="h-4 w-4 mr-2" />
							<span className="hidden sm:inline">
								{converting ? "Converting..." : "Convert to Knowledge"}
							</span>
						</Button>
					)}
					{file.type === "excel" && (
						<Button
							variant="default"
							size="sm"
							onClick={handleConvertExcel}
							disabled={converting}
						>
							<BookmarkPlus className="h-4 w-4 mr-2" />
							<span className="hidden sm:inline">
								{converting ? "Converting..." : "Convert to Knowledge"}
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
								Loading preview...
							</div>
						</div>
					</div>
				)}

				{/* Metadata Section - Only show when showProperties is true */}
				{showProperties && (
					<ScrollArea className="flex-shrink-0 border-t max-h-[400px]">
						<div className="p-4 space-y-4">
							<h3 className="text-sm font-semibold">Document Information</h3>

							<div className="grid grid-cols-1 gap-3">
								{file.metadata?.title && (
									<div className="flex items-start gap-3">
										<FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
										<div className="flex-1 min-w-0">
											<div className="text-xs text-muted-foreground">Title</div>
											<div className="text-sm">{file.metadata.title}</div>
										</div>
									</div>
								)}

								{file.metadata?.author && (
									<div className="flex items-start gap-3">
										<FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
										<div className="flex-1 min-w-0">
											<div className="text-xs text-muted-foreground">
												Author
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
												Sheets
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
													Sheet Names
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
										<div className="text-xs text-muted-foreground">Type</div>
										<div className="text-sm">{file.mimeType}</div>
									</div>
								</div>

								<div className="flex items-start gap-3">
									<HardDrive className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="text-xs text-muted-foreground">Size</div>
										<div className="text-sm">{formatFileSize(file.size)}</div>
									</div>
								</div>

								<div className="flex items-start gap-3">
									<Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="text-xs text-muted-foreground">Created</div>
										<div className="text-sm">{formatDate(file.createdAt)}</div>
									</div>
								</div>

								<div className="flex items-start gap-3">
									<Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="text-xs text-muted-foreground">
											Modified
										</div>
										<div className="text-sm">{formatDate(file.modifiedAt)}</div>
									</div>
								</div>
							</div>

							{/* Tags Section */}
							{file.metadata?.tags && file.metadata.tags.length > 0 && (
								<div className="space-y-2">
									<h3 className="text-sm font-semibold">Tags</h3>
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
										<h3 className="text-sm font-semibold">Topics</h3>
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
									<h3 className="text-sm font-semibold">Description</h3>
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
					open={showPageSelector}
					onOpenChange={setShowPageSelector}
					onConvert={handleConvertPages}
				/>
			)}
		</div>
	);
};
