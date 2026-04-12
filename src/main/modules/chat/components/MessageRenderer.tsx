import React, { lazy, Suspense, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { File, FileText } from "lucide-react";

import { ThreeDotsLoader } from "@/main/components/atoms/ThreeDotsLoader";
import {
	Message,
	MessageContent,
} from "@/main/components/ui/shadcn-io/ai/message";
import type { Message as DBMessage } from "@/services/database/types";
import type { MessageActionItem } from "@/main/modules/chat/components/types";
import type {
	AttachedDocumentRef,
	ComplexContent,
	ComplexContentPartImage,
} from "@/types/chat";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";

import { MessageActions } from "./MessageActions";
import { MessageFooter, type MessageFooterMetadata } from "./MessageFooter";

/** Loads a single stored image from the document filesystem and renders it. */
const ChatImagePart: React.FC<{ part: ComplexContentPartImage }> = ({
	part,
}) => {
	const [dataUri, setDataUri] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		documentFileSystemService
			.readFileAsBase64(part.path, part.mimeType)
			.then((uri) => {
				if (!cancelled) setDataUri(uri);
			})
			.catch(() => {
				// silently ignore — broken image indicator is enough
			});
		return () => {
			cancelled = true;
		};
	}, [part.path, part.mimeType]);

	if (!dataUri) return null;

	return (
		<img
			src={dataUri}
			alt=""
			className="max-h-48 rounded-md object-contain border border-border mt-1"
		/>
	);
};

/** Renders multipart complex content (images + text). Text is handled by the main renderer. */
const MessageComplexImages: React.FC<{ complexContent: ComplexContent }> = ({
	complexContent,
}) => {
	const imageParts = complexContent.filter(
		(p) => p.type === "image",
	) as ComplexContentPartImage[];
	if (imageParts.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2 mb-2">
			{imageParts.map((part, i) => (
				<ChatImagePart key={i} part={part} />
			))}
		</div>
	);
};

const MessageAttachedDocuments: React.FC<{
	documents: AttachedDocumentRef[];
}> = ({ documents }) => {
	if (documents.length === 0) return null;

	return (
		<div className="mb-2 flex flex-wrap gap-2">
			{documents.map((doc, index) => (
				<div
					key={`${doc.path}-${index}`}
					className="inline-flex max-w-60 items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5 text-xs"
					title={doc.path}
				>
					<span className="shrink-0 text-muted-foreground">
						{doc.docType === "pdf" ? (
							<File size={14} />
						) : (
							<FileText size={14} />
						)}
					</span>
					<span className="truncate text-foreground">{doc.name}</span>
				</div>
			))}
		</div>
	);
};

const USE_STREAMDOWN = false;
const Streamdown = lazy(() => import("./MessageStreamDown"));
const MarkdownMessage = lazy(() => import("./MarkdownMessage"));
const ContentComponent = USE_STREAMDOWN ? Streamdown : MarkdownMessage;

interface MessageMetadata extends MessageFooterMetadata {
	actions?: MessageActionItem[];
	attachedDocuments?: AttachedDocumentRef[];
	executeState?: {
		node: string;
		metadata?: Record<string, unknown>;
	};
}

interface MessageRendererProps {
	message: DBMessage;
	index: number;
	isLastMessage: boolean;
	isStreaming: boolean;
	groupMessages?: DBMessage[];
	selectedTopic?: string;
}

export const MessageRenderer: React.FC<MessageRendererProps> = React.memo(
	({ message, isLastMessage, isStreaming, groupMessages, selectedTopic }) => {
		const formattedDate = useMemo(
			() => dayjs(message.createdAt).format("MMM D, YYYY h:mm A"),
			[message.createdAt],
		);
		const { t } = useTranslation("chat");

		const complexContent = useMemo<ComplexContent | null>(() => {
			if (!message.complexContent || !Array.isArray(message.complexContent))
				return null;
			return message.complexContent as ComplexContent;
		}, [message.complexContent]);

		const actions = useMemo<MessageActionItem[]>(() => {
			if (!message.metadata || typeof message.metadata !== "object") return [];
			if (!("actions" in message.metadata)) return [];
			if (!Array.isArray(message.metadata.actions)) return [];
			return message.metadata.actions;
		}, [message.metadata]);

		const attachedDocuments = useMemo<AttachedDocumentRef[]>(() => {
			if (!message.metadata || typeof message.metadata !== "object") return [];
			if (!("attachedDocuments" in message.metadata)) return [];
			if (!Array.isArray(message.metadata.attachedDocuments)) return [];
			return message.metadata.attachedDocuments as AttachedDocumentRef[];
		}, [message.metadata]);

		const executeState = useMemo(() => {
			const metadata = message.metadata as MessageMetadata | undefined;
			return metadata?.executeState;
		}, [message.metadata]);

		const executionLabel = useMemo(() => {
			if (!executeState?.node) return "";
			const key = `execution.nodes.${executeState.node}`;
			const translated = t(key);
			if (translated !== key) return translated;
			return executeState.node;
		}, [executeState?.node, t]);

		const executionText = useMemo(() => {
			if (!executeState?.node) return "";
			const toolName =
				typeof executeState.metadata?.tool === "string"
					? executeState.metadata.tool
					: undefined;
			if (toolName) {
				return t("execution.tool", { name: toolName });
			}
			return t("execution.default", { node: executionLabel });
		}, [executeState, executionLabel, t]);

		if (message.type === "separator") {
			return (
				<div key={message.id} className="my-4 flex items-center">
					<div className="flex-1 border-t border-gray-300"></div>
					<div className="mx-4 text-xs text-gray-500 font-medium">
						{formattedDate}
					</div>
					<div className="flex-1 border-t border-gray-300"></div>
				</div>
			);
		}

		return (
			<div key={message.id} className="flex flex-col gap-4">
				<MessageActions actions={actions} />
				<Message key={message.id} from={message.role}>
					<MessageContent className="relative">
						{message.role === "user" && attachedDocuments.length > 0 && (
							<MessageAttachedDocuments documents={attachedDocuments} />
						)}
						{complexContent && (
							<MessageComplexImages complexContent={complexContent} />
						)}
						{!message.content && isLastMessage && isStreaming ? (
							<div className="py-2 flex items-center gap-2">
								<ThreeDotsLoader className="text-muted-foreground" />
								{executionText ? (
									<span className="text-muted-foreground animate-pulse">
										{executionText}
									</span>
								) : null}
							</div>
						) : (
							<Suspense
								fallback={
									<div className="py-2">
										<ThreeDotsLoader className="text-muted-foreground" />
									</div>
								}
							>
								<div className="relative z-10">
									<ContentComponent isStreaming={isStreaming}>
										{message.content}
									</ContentComponent>
									{isStreaming && (
										<>
											<div className="mt-4 flex items-center gap-2">
												<ThreeDotsLoader
													className="text-muted-foreground"
													size="sm"
												/>
												{executionText ? (
													<span className="text-muted-foreground animate-pulse">
														{executionText}
													</span>
												) : null}
											</div>
											<div
												className="absolute -bottom-6 -left-6 -right-6 h-10 pointer-events-none rounded-b-lg z-0"
												style={{
													background:
														"linear-gradient(to top, hsl(var(--background) / 0.2) 0%, hsl(var(--background) / 0.08) 55%, transparent 100%)",
												}}
											/>
										</>
									)}
									{!isStreaming &&
									message.role === "assistant" &&
									message.metadata &&
									groupMessages &&
									groupMessages.length > 0 ? (
										<MessageFooter
											message={message}
											groupMessages={groupMessages}
											selectedTopic={selectedTopic}
											metadata={message.metadata as MessageMetadata}
										/>
									) : null}
								</div>
							</Suspense>
						)}
					</MessageContent>
				</Message>
			</div>
		);
	},
	(prev, next) => {
		return (
			prev.message.id === next.message.id &&
			prev.message.content === next.message.content &&
			prev.message.complexContent === next.message.complexContent &&
			prev.message.metadata === next.message.metadata &&
			prev.isLastMessage === next.isLastMessage &&
			prev.isStreaming === next.isStreaming
		);
	},
);
