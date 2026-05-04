import React, { lazy, Suspense, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import {
	Check,
	ChevronDown,
	Code2,
	Copy,
	File,
	FileText,
	Globe2,
	Image,
} from "lucide-react";

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
import { cn } from "@/lib/utils";
import { EMBEDDED_CONTEXT_TAG_CONFIG } from "@/embedded/context-items";
import { ArtifactRenderer } from "./artifacts/ArtifactRenderer";
import { parseArtifactSegments } from "./artifacts/artifact-protocol";

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

type UserContextSection = {
	type: "text" | "html" | "screenshot";
	content: string;
	label: string;
};

type ParsedUserContext = {
	hasContext: boolean;
	userMessage: string;
	websiteInfo?: {
		title: string;
		url: string;
	};
	sections: UserContextSection[];
};

const parseUserContext = (content: string): ParsedUserContext => {
	const contextMatch = content.match(/<context>([\s\S]*?)<\/context>/);
	if (!contextMatch) {
		return {
			hasContext: false,
			userMessage: content,
			sections: [],
		};
	}

	const contextContent = contextMatch[1] ?? "";
	const beforeContext = content.slice(0, contextMatch.index).trim();
	const afterContext = content
		.slice((contextMatch.index ?? 0) + contextMatch[0].length)
		.trim();
	const websiteMatch = contextContent.match(/<website>([\s\S]*?)<\/website>/);
	const websiteInner = websiteMatch?.[1] ?? "";
	const title = websiteInner.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim();
	const url = websiteInner.match(/<url>([\s\S]*?)<\/url>/)?.[1]?.trim();
	const tagPattern = Object.keys(EMBEDDED_CONTEXT_TAG_CONFIG).join("|");
	const sectionRegex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)<\\/\\1>`, "g");
	const sections: UserContextSection[] = [];

	for (const match of contextContent.matchAll(sectionRegex)) {
		const tag = match[1];
		const sectionConfig = EMBEDDED_CONTEXT_TAG_CONFIG[tag];
		if (!sectionConfig) continue;

		sections.push({
			type: sectionConfig.displayType,
			content: match[2].trim(),
			label: sectionConfig.renderLabel,
		});
	}

	return {
		hasContext: true,
		userMessage: [beforeContext, afterContext].filter(Boolean).join("\n\n"),
		websiteInfo:
			title || url
				? {
						title: title || "Website",
						url: url || "",
					}
				: undefined,
		sections,
	};
};

const getContextSectionIcon = (type: UserContextSection["type"]) => {
	if (type === "html") return Code2;
	if (type === "screenshot") return Image;
	return FileText;
};

const UserContextSectionCard: React.FC<{
	section: UserContextSection;
}> = ({ section }) => {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const Icon = getContextSectionIcon(section.type);

	const handleCopy = async (event: React.MouseEvent) => {
		event.stopPropagation();
		try {
			await navigator.clipboard.writeText(section.content);
			setIsCopied(true);
			window.setTimeout(() => setIsCopied(false), 1800);
		} catch {
			setIsCopied(false);
		}
	};

	return (
		<div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
			<div className="flex items-center gap-2 px-3 py-2">
				<button
					type="button"
					className="flex min-w-0 flex-1 items-center gap-2 text-left"
					onClick={() => setIsExpanded((value) => !value)}
				>
					<Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
					<span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
						{section.label}
					</span>
					<ChevronDown
						className={cn(
							"h-4 w-4 shrink-0 text-muted-foreground transition-transform",
							isExpanded && "rotate-180",
						)}
					/>
				</button>
				<button
					type="button"
					className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title={isCopied ? "Copied" : "Copy context"}
					onClick={handleCopy}
				>
					{isCopied ? (
						<Check className="h-4 w-4 text-green-500" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</button>
			</div>
			{isExpanded ? (
				<div className="border-t border-border/60 px-3 py-2">
					{section.type === "screenshot" ? (
						<p className="text-xs italic text-muted-foreground">
							{section.content}
						</p>
					) : (
						<pre
							className={cn(
								"max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground",
								section.type === "html" ? "font-mono" : "font-sans",
							)}
						>
							{section.content}
						</pre>
					)}
				</div>
			) : null}
		</div>
	);
};

const UserMessageContent: React.FC<{
	content: string;
	isStreaming: boolean;
}> = ({ content, isStreaming }) => {
	const parsed = useMemo(() => parseUserContext(content), [content]);

	if (!parsed.hasContext) {
		return (
			<MessageContentWithArtifacts
				content={content}
				isStreaming={isStreaming}
			/>
		);
	}

	return (
		<div className="space-y-3">
			{parsed.userMessage ? (
				<div className="whitespace-pre-wrap break-words">
					{parsed.userMessage}
				</div>
			) : null}
			<div className="space-y-2">
				{parsed.websiteInfo ? (
					<div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
						<Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
						<div className="min-w-0 flex-1">
							<div className="truncate text-xs font-medium text-foreground">
								{parsed.websiteInfo.title}
							</div>
							{parsed.websiteInfo.url ? (
								<div className="mt-0.5 truncate text-xs text-muted-foreground">
									{parsed.websiteInfo.url}
								</div>
							) : null}
						</div>
					</div>
				) : null}
				{parsed.sections.map((section, index) => (
					<UserContextSectionCard
						key={`${section.label}-${index}`}
						section={section}
					/>
				))}
			</div>
		</div>
	);
};

/**
 * Renders message content by splitting on standard <artifact> tags.
 * Text segments go to MarkdownMessage; artifact segments go to ArtifactRenderer.
 */
const MessageContentWithArtifacts: React.FC<{
	content: string;
	isStreaming: boolean;
}> = ({ content, isStreaming }) => {
	const segments = useMemo(() => parseArtifactSegments(content), [content]);

	return (
		<>
			{segments.map((seg, i) => {
				if (seg.kind === "artifact") {
					return (
						<ArtifactRenderer
							key={i}
							type={seg.type}
							content={seg.content}
							identifier={seg.identifier}
							title={seg.title}
						/>
					);
				}
				const text = seg.text;
				if (!text.trim()) return null;
				return (
					<ContentComponent key={i} isStreaming={isStreaming}>
						{text}
					</ContentComponent>
				);
			})}
		</>
	);
};

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
	showMessageControls?: boolean;
}

export const MessageRenderer: React.FC<MessageRendererProps> = React.memo(
	({
		message,
		isLastMessage,
		isStreaming,
		groupMessages,
		selectedTopic,
		showMessageControls = true,
	}) => {
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
					<div className="flex-1 border-t border-border/60"></div>
					<div className="mx-4 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
						{formattedDate}
					</div>
					<div className="flex-1 border-t border-border/60"></div>
				</div>
			);
		}

		const isUserMessage = message.role === "user";

		return (
			<div
				key={message.id}
				className={cn(
					"flex flex-col gap-2",
					isUserMessage ? "items-end" : "items-start",
				)}
			>
				{showMessageControls && actions.length > 0 ? (
					<div className="w-full space-y-2">
						<MessageActions actions={actions} />
					</div>
				) : null}
				{!isUserMessage ? (
					<div className="flex items-center justify-start gap-2 px-1 text-[11px] font-medium tracking-normal text-muted-foreground/80">
						<span>Assistant</span>
						<span className="h-1 w-1 rounded-full bg-muted-foreground/35" />
						<time dateTime={new Date(message.createdAt).toISOString()}>
							{formattedDate}
						</time>
					</div>
				) : null}
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
									{isUserMessage ? (
										<UserMessageContent
											content={message.content}
											isStreaming={isStreaming}
										/>
									) : (
										<MessageContentWithArtifacts
											content={message.content}
											isStreaming={isStreaming}
										/>
									)}
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
									{showMessageControls &&
									!isStreaming &&
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
			prev.isStreaming === next.isStreaming &&
			prev.showMessageControls === next.showMessageControls
		);
	},
);
