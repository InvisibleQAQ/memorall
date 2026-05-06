import React, { useState } from "react";
import type { ChatMessage } from "../types";
import { EmbeddedMarkdown } from "./EmbeddedMarkdown";
import { Loader } from "./Icons";
import { EMBEDDED_CONTEXT_TAG_CONFIG } from "@/embedded/context-items";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { logWarn } from "@/utils/logger";
import {
	getEmbeddedTranslation,
	useEmbeddedTranslation,
} from "@/embedded/hooks/use-embedded-language";
import {
	parseArtifactSegments,
	type MessageContentSegment,
} from "@/main/modules/chat/components/artifacts/artifact-protocol";

// Helper function to translate action names (similar to MessageRenderer.tsx)
const translateActionName = (
	actionName: string,
	actions: Record<string, string>,
): string => {
	if (actions[actionName]) {
		return actions[actionName];
	}

	// Fallback: replace underscores with spaces and capitalize first letter
	return actionName.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

const getTextContent = (content: ChatMessage["content"]): string => {
	if (typeof content === "string") {
		return content;
	}

	return content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
};

const formatJsonPreview = (value: unknown, maxLength = 180): string => {
	if (value === undefined || value === null) return "";
	const raw =
		typeof value === "string" ? value : JSON.stringify(value, null, 2) || "";
	return raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
};

const getToolCallSummary = (toolCall: unknown, index: number) => {
	if (typeof toolCall !== "object" || toolCall === null) {
		return {
			id: `tool-${index}`,
			name: `Tool ${index + 1}`,
			argumentsText: formatJsonPreview(toolCall),
		};
	}

	const record = toolCall as Record<string, unknown>;
	const fn =
		typeof record.function === "object" && record.function !== null
			? (record.function as Record<string, unknown>)
			: undefined;

	return {
		id: typeof record.id === "string" ? record.id : `tool-${index}`,
		name:
			(typeof fn?.name === "string" && fn.name) ||
			(typeof record.name === "string" && record.name) ||
			"",
		argumentsText:
			(typeof fn?.arguments === "string" && fn.arguments) ||
			formatJsonPreview(record.arguments ?? record.args ?? record),
	};
};

const EmbeddedToolSummaries: React.FC<{
	message: ChatMessage;
}> = ({ message }) => {
	const t = useEmbeddedTranslation("messageRenderer");
	const { actions: actionTranslations } =
		getEmbeddedTranslation("messageRenderer");
	const actions = message.metadata?.actions || [];
	const toolCalls = message.metadata?.tool_calls || [];
	const executeState = message.metadata?.executeState;

	if (!actions.length && !toolCalls.length && !executeState) {
		return null;
	}

	return (
		<div className="memorall-tool-summary-list">
			{executeState?.node && (
				<div className="memorall-tool-summary">
					<div className="memorall-tool-summary-main">
						<span className="memorall-tool-summary-dot memorall-tool-summary-dot--active" />
						<span className="memorall-tool-summary-title">
							{translateActionName(executeState.node, actionTranslations)}
						</span>
						<span className="memorall-tool-summary-status">{t("running")}</span>
					</div>
					{executeState.metadata && (
						<div className="memorall-tool-summary-description">
							{formatJsonPreview(executeState.metadata)}
						</div>
					)}
				</div>
			)}

			{actions.map((action, index) => (
				<div className="memorall-tool-summary" key={`${action.id}-${index}`}>
					<div className="memorall-tool-summary-main">
						<span className="memorall-tool-summary-dot" />
						<span className="memorall-tool-summary-title">
							{translateActionName(action.name, actionTranslations)}
						</span>
						<span className="memorall-tool-summary-status">{t("done")}</span>
					</div>
					{action.description && (
						<div className="memorall-tool-summary-description">
							{action.description}
						</div>
					)}
				</div>
			))}

			{toolCalls.map((toolCall, index) => {
				const summary = getToolCallSummary(toolCall, index);
				const title = summary.name || t("toolLabel", { index: index + 1 });
				return (
					<details className="memorall-tool-summary" key={summary.id}>
						<summary className="memorall-tool-summary-main">
							<span className="memorall-tool-summary-dot" />
							<span className="memorall-tool-summary-title">{title}</span>
							<span className="memorall-tool-summary-status">
								{t("toolCall")}
							</span>
						</summary>
						{summary.argumentsText && (
							<pre className="memorall-tool-summary-code">
								{summary.argumentsText}
							</pre>
						)}
					</details>
				);
			})}
		</div>
	);
};

const EmbeddedArtifact: React.FC<{
	segment: Extract<MessageContentSegment, { kind: "artifact" }>;
}> = ({ segment }) => {
	const t = useEmbeddedTranslation("messageRenderer");
	const title =
		segment.title ||
		(segment.type === "url" ? t("urlArtifact") : t("htmlArtifact"));
	const openUrl = () => {
		if (segment.type === "url" && segment.content.trim()) {
			window.open(segment.content.trim(), "_blank", "noopener,noreferrer");
		}
	};

	return (
		<div className="memorall-artifact-card">
			<div className="memorall-artifact-header">
				<div className="memorall-artifact-title">{title}</div>
				{segment.type === "url" && (
					<button
						type="button"
						className="memorall-artifact-open"
						onClick={openUrl}
					>
						{t("open")}
					</button>
				)}
			</div>
			{segment.type === "html" ? (
				<iframe
					className="memorall-artifact-frame"
					title={title}
					sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
					srcDoc={segment.content}
				/>
			) : (
				<div className="memorall-artifact-url">
					<div className="memorall-artifact-url-text">{segment.content}</div>
					{/^https?:\/\//i.test(segment.content.trim()) && (
						<iframe
							className="memorall-artifact-frame memorall-artifact-frame--url"
							title={title}
							sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
							src={segment.content.trim()}
						/>
					)}
				</div>
			)}
		</div>
	);
};

const AssistantMessageContent: React.FC<{
	content: string;
	isStreaming: boolean;
}> = ({ content, isStreaming }) => {
	const segments = parseArtifactSegments(content);

	return (
		<div className="memorall-assistant-content">
			{segments.map((segment, index) =>
				segment.kind === "artifact" ? (
					<EmbeddedArtifact
						key={`artifact-${segment.identifier ?? index}`}
						segment={segment}
					/>
				) : segment.text.trim() ? (
					<EmbeddedMarkdown
						key={`text-${index}`}
						content={segment.text}
						isStreaming={isStreaming}
					/>
				) : null,
			)}
		</div>
	);
};

// Component to render user message content with enhanced context UI
const UserMessageContent: React.FC<{ message: ChatMessage }> = ({
	message,
}) => {
	const t = useEmbeddedTranslation("messageRenderer");
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(),
	);

	// Parse context XML sections
	const parseContextSections = (content: string) => {
		const sections: Array<{ type: string; content: string; label: string }> =
			[];

		// Match context tags
		const contextMatch = content.match(/<context>([\s\S]*?)<\/context>/);
		if (!contextMatch) {
			return { hasContext: false, plainText: content, sections };
		}

		const contextContent = contextMatch[1];
		const beforeContext = content.slice(0, contextMatch.index);
		const afterContext = content.slice(
			contextMatch.index! + contextMatch[0].length,
		);

		// Extract website info
		const websiteMatch = contextContent.match(/<website>([\s\S]*?)<\/website>/);
		let websiteInfo = null;
		if (websiteMatch) {
			const titleMatch = websiteMatch[1].match(/<title>(.*?)<\/title>/);
			const urlMatch = websiteMatch[1].match(/<url>(.*?)<\/url>/);
			websiteInfo = {
				title: titleMatch?.[1]?.trim() || "",
				url: urlMatch?.[1]?.trim() || "",
			};
		}

		const tagPattern = Object.keys(EMBEDDED_CONTEXT_TAG_CONFIG).join("|");
		const sectionRegex = new RegExp(
			`<(${tagPattern})>([\\s\\S]*?)<\\/\\1>`,
			"g",
		);
		const labelPrefixByType: Record<string, string> = {
			text: "📝",
			html: "🏗️",
			screenshot: "📸",
		};

		for (const match of contextContent.matchAll(sectionRegex)) {
			const tag = match[1];
			const sectionConfig = EMBEDDED_CONTEXT_TAG_CONFIG[tag];
			if (!sectionConfig) {
				continue;
			}

			sections.push({
				type: sectionConfig.displayType,
				content: match[2].trim(),
				label: `${labelPrefixByType[sectionConfig.displayType]} ${sectionConfig.renderLabel}`,
			});
		}

		return {
			hasContext: true,
			websiteInfo,
			sections,
			userMessage: (beforeContext + afterContext).trim(),
		};
	};

	const textContent = getTextContent(message.content);
	const parsed = parseContextSections(textContent);

	const [copiedSection, setCopiedSection] = useState<string | null>(null);

	const toggleSection = (label: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(label)) {
				next.delete(label);
			} else {
				next.add(label);
			}
			return next;
		});
	};

	const copySection = async (
		label: string,
		content: string,
		e: React.MouseEvent,
	) => {
		e.stopPropagation(); // Prevent toggle when clicking copy
		try {
			await navigator.clipboard.writeText(content);
			setCopiedSection(label);
			setTimeout(() => setCopiedSection(null), 2000);
		} catch (error) {
			logWarn("Failed to copy content:", error);
		}
	};

	if (!parsed.hasContext) {
		// Regular message without context
		return (
			<>
				<pre
					className="memorall-user-text whitespace-pre-wrap font-sans text-sm max-w-full"
					style={{
						wordBreak: "break-word",
						overflowWrap: "break-word",
					}}
				>
					{textContent}
				</pre>
				{/* Render images from OpenAI content format */}
				{typeof message.content !== "string" && (
					<div className="mt-3 grid grid-cols-1 gap-3">
						{message.content
							.filter((part) => part.type === "image_url")
							.map((part, idx) => (
								<div
									key={idx}
									className="rounded-lg border border-border overflow-hidden bg-card shadow-sm"
								>
									<img
										src={part.image_url.url}
										alt={t("imageAlt", { index: idx + 1 })}
										className="w-full"
									/>
								</div>
							))}
					</div>
				)}
			</>
		);
	}

	// Message with context sections
	return (
		<div className="memorall-user-context space-y-3">
			{/* User's actual message */}
			{parsed.userMessage && (
				<div className="memorall-user-text memorall-user-text--with-context text-sm">
					{parsed.userMessage}
				</div>
			)}

			{/* Context sections */}
			<div className="space-y-2">
				{/* Website info */}
				{parsed.websiteInfo && (
					<div className="memorall-user-context-card flex items-start gap-2.5 rounded-lg px-3 py-2.5 border border-border transition-colors">
						<svg
							className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
							/>
						</svg>
						<div className="flex-1 min-w-0">
							<div className="memorall-user-context-card-title text-sm truncate">
								{parsed.websiteInfo.title}
							</div>
							<div className="memorall-user-context-card-subtitle truncate text-xs mt-0.5">
								{parsed.websiteInfo.url}
							</div>
						</div>
					</div>
				)}

				{/* Context sections */}
				{parsed.sections.map((section, idx) => {
					const isExpanded = expandedSections.has(section.label);
					const isScreenshot = section.type === "screenshot";
					const isHtml = section.type === "html";
					const isCopied = copiedSection === section.label;

					return (
						<div
							key={idx}
							className="memorall-user-context-card border border-border rounded-lg overflow-hidden"
						>
							<div className="memorall-user-context-card-header w-full px-3 py-2 flex items-center justify-between text-xs font-medium transition-colors">
								<button
									onClick={() => toggleSection(section.label)}
									className="flex-1 flex items-center justify-between text-left"
									onKeyDown={(e) => e.stopPropagation()}
									onKeyUp={(e) => e.stopPropagation()}
									onKeyPress={(e) => e.stopPropagation()}
								>
									<span className="memorall-user-context-card-title">
										{section.label}
									</span>
									<svg
										className={`memorall-user-context-card-icon w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								</button>
								<button
									onClick={(e) =>
										copySection(section.label, section.content, e)
									}
									className="memorall-user-context-icon-button ml-2 p-1 rounded transition-colors"
									title={isCopied ? t("copiedTitle") : t("copyContent")}
									onKeyDown={(e) => e.stopPropagation()}
									onKeyUp={(e) => e.stopPropagation()}
									onKeyPress={(e) => e.stopPropagation()}
								>
									{isCopied ? (
										<svg
											className="w-4 h-4 text-green-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M5 13l4 4L19 7"
											/>
										</svg>
									) : (
										<svg
											className="memorall-user-context-card-icon w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
											/>
										</svg>
									)}
								</button>
							</div>

							{isExpanded && (
								<div className="memorall-user-context-expanded px-3 py-2 border-t border-border">
									{isScreenshot ? (
										<div className="memorall-user-context-card-subtitle text-xs italic">
											{section.content}
										</div>
									) : isHtml ? (
										<pre className="memorall-user-context-pre whitespace-pre-wrap font-mono text-xs max-h-96 overflow-y-auto overflow-x-auto">
											{section.content}
										</pre>
									) : (
										<pre className="memorall-user-context-pre whitespace-pre-wrap font-sans text-xs max-h-96 overflow-y-auto">
											{section.content}
										</pre>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Images from OpenAI content format */}
			{typeof message.content !== "string" && (
				<div className="grid grid-cols-1 gap-3">
					{message.content
						.filter((part) => part.type === "image_url")
						.map((part, idx) => (
							<div
								key={idx}
								className="rounded-lg border border-border overflow-hidden bg-card shadow-sm"
							>
								<img
									src={part.image_url.url}
									alt={t("imageAlt", { index: idx + 1 })}
									className="w-full"
								/>
							</div>
						))}
				</div>
			)}
		</div>
	);
};

export interface EmbeddedMessageRendererProps {
	message: ChatMessage;
	isLoading: boolean;
	allMessages: ChatMessage[];
	selectedTopic?: string;
}

// Message Actions Component
const MessageActions: React.FC<{
	message: ChatMessage;
	allMessages: ChatMessage[];
	selectedTopic?: string;
}> = ({ message, allMessages, selectedTopic }) => {
	const t = useEmbeddedTranslation("messageRenderer");
	const [copied, setCopied] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

	const handleCopy = async () => {
		try {
			// Extract text content for copying
			const textToCopy =
				typeof message.content === "string"
					? message.content
					: message.content
							.filter((part) => part.type === "text")
							.map((part) => part.text)
							.join("\n");
			await navigator.clipboard.writeText(textToCopy);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			logWarn("Failed to copy message:", error);
		}
	};

	const handleSaveToRemembered = async () => {
		if (saving) return;

		setSaving(true);
		try {
			// Format entire conversation as dialogue
			const conversationText = allMessages
				.map((msg) => {
					// Extract text content from message
					const content =
						typeof msg.content === "string"
							? msg.content
							: msg.content
									.filter((part) => part.type === "text")
									.map((part) => part.text)
									.join("\n");

					const role = msg.role === "user" ? t("userRole") : t("assistantRole");
					return `${role}: ${content}`;
				})
				.join("\n\n");

			// Generate a unique identifier for this conversation
			const conversationId = `conversation-${Date.now()}-${Math.random().toString(36).substring(7)}`;

			// Prepare the content with source info (similar to CONVERT_TO_KNOWLEDGE_CONTEXT_MENU_ID)
			const sourceInfo = `${t("directContentSave")}\n${t("webTitle")}: ${
				document.title || t("untitled")
			}\n${t("webUrl")}: ${window.location.href}\n\n`;
			const fullContent = sourceInfo + conversationText;

			// Convert directly to knowledge using the knowledge-graph job
			// Use aggressive extraction mode for user-saved conversations
			const result = await backgroundJob.execute(
				"knowledge-graph",
				{
					filePath: conversationId,
					content: fullContent,
					isSpecificTextConversion: true, // Enable aggressive extraction
					topicId: selectedTopic || undefined, // Use currently selected topic
				},
				{ stream: false },
			);

			if ("promise" in result) {
				await result.promise;
			}

			setSaved(true);
			setTimeout(() => setSaved(false), 3000);
		} catch (error) {
			logWarn("Failed to save to remembered content:", error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex items-center gap-1">
			<button
				onClick={handleCopy}
				className="h-8 px-3 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 group/copy"
				title={copied ? t("copiedTitle") : t("copyMessage")}
			>
				{copied ? (
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				) : (
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
				)}
				<span className="hidden group-hover/copy:inline">
					{copied ? t("copied") : t("copy")}
				</span>
			</button>

			<button
				onClick={handleSaveToRemembered}
				className="h-8 px-3 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 group/save"
				title={
					saved ? t("savedTitle") : saving ? t("saving") : t("saveToRemembered")
				}
				disabled={saving}
			>
				{saved ? (
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				) : (
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
						/>
					</svg>
				)}
				<span className="hidden group-hover/save:inline">
					{saving ? t("saving") : saved ? t("saved") : t("remember")}
				</span>
			</button>
		</div>
	);
};

// Enhanced Message Renderer with Actions
export const EmbeddedMessageRenderer: React.FC<
	EmbeddedMessageRendererProps
> = ({ message, isLoading, allMessages, selectedTopic }) => {
	const t = useEmbeddedTranslation("messageRenderer");

	// Loading state with actions
	if (!message.content && isLoading && message.role === "assistant") {
		return (
			<div className="flex flex-col gap-4">
				<EmbeddedToolSummaries message={message} />
				<div className="flex items-center gap-2">
					<Loader size={14} />
					<span className="text-muted-foreground text-sm">{t("thinking")}</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<EmbeddedToolSummaries message={message} />
			{message.content && (
				<>
					{message.role === "user" ? (
						// User messages: render with better context UI
						<UserMessageContent message={message} />
					) : (
						// Assistant messages: render as markdown with action buttons
						<>
							<AssistantMessageContent
								content={getTextContent(message.content)}
								isStreaming={isLoading && message.role === "assistant"}
							/>
							{!isLoading && (
								<MessageActions
									message={message}
									allMessages={allMessages}
									selectedTopic={selectedTopic}
								/>
							)}
						</>
					)}
				</>
			)}
		</div>
	);
};
