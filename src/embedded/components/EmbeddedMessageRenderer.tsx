import React, { useState } from "react";
import type { ChatMessage } from "../types";
import { EmbeddedMarkdown } from "./EmbeddedMarkdown";
import { Task, TaskTrigger, TaskContent, TaskItem } from "./TaskComponents";
import { Loader } from "./Icons";

// Component to render user message content with enhanced context UI
const UserMessageContent: React.FC<{ message: ChatMessage }> = ({
	message,
}) => {
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

		// Extract other sections
		const sectionPatterns = [
			{
				regex: /<selected_text>([\s\S]*?)<\/selected_text>/,
				label: "📝 Selected Text",
				type: "text",
			},
			{
				regex: /<viewport_content>([\s\S]*?)<\/viewport_content>/,
				label: "👁️ Viewport Content",
				type: "text",
			},
			{
				regex: /<full_page_content>([\s\S]*?)<\/full_page_content>/,
				label: "📄 Full Page Content",
				type: "text",
			},
			{
				regex: /<viewport_screenshot>([\s\S]*?)<\/viewport_screenshot>/,
				label: "📸 Viewport Screenshot",
				type: "screenshot",
			},
			{
				regex: /<screenshot>([\s\S]*?)<\/screenshot>/,
				label: "📸 Full Page Screenshot",
				type: "screenshot",
			},
		];

		sectionPatterns.forEach(({ regex, label, type }) => {
			const match = contextContent.match(regex);
			if (match) {
				sections.push({ type, content: match[1].trim(), label });
			}
		});

		return {
			hasContext: true,
			websiteInfo,
			sections,
			userMessage: (beforeContext + afterContext).trim(),
		};
	};

	// Extract text content from OpenAI format
	const getTextContent = (content: ChatMessage["content"]): string => {
		if (typeof content === "string") {
			return content;
		}
		// For array content, concatenate all text parts
		return content
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("\n");
	};

	const textContent = getTextContent(message.content);
	const parsed = parseContextSections(textContent);

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

	if (!parsed.hasContext) {
		// Regular message without context
		return (
			<>
				<pre
					className="whitespace-pre-wrap font-sans text-sm max-w-full"
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
										alt={`Image ${idx + 1}`}
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
		<div className="space-y-3">
			{/* User's actual message */}
			{parsed.userMessage && (
				<div className="text-sm">{parsed.userMessage}</div>
			)}

			{/* Context sections */}
			<div className="space-y-2">
				{/* Website info */}
				{parsed.websiteInfo && (
					<div className="flex items-start gap-2.5 bg-card rounded-lg px-3 py-2.5 border border-border hover:bg-accent transition-colors">
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
							<div className="text-sm truncate">{parsed.websiteInfo.title}</div>
							<div className="truncate text-xs mt-0.5">
								{parsed.websiteInfo.url}
							</div>
						</div>
					</div>
				)}

				{/* Context sections */}
				{parsed.sections.map((section, idx) => {
					const isExpanded = expandedSections.has(section.label);
					const isScreenshot = section.type === "screenshot";

					return (
						<div
							key={idx}
							className="border border-border rounded-lg overflow-hidden bg-card"
						>
							<button
								onClick={() => toggleSection(section.label)}
								className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium hover:bg-accent transition-colors text-left"
							>
								<span className="text-foreground">{section.label}</span>
								<svg
									className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
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

							{isExpanded && (
								<div className="px-3 py-2 border-t border-border bg-muted/30">
									{isScreenshot ? (
										<div className="text-xs text-muted-foreground italic">
											{section.content}
										</div>
									) : (
										<pre className="whitespace-pre-wrap font-sans text-xs text-foreground/80 max-h-60 overflow-y-auto">
											{section.content.length > 500
												? section.content.slice(0, 500) + "..."
												: section.content}
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
									alt={`Image ${idx + 1}`}
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
}

// Message Actions Component
const MessageActions: React.FC<{
	message: ChatMessage;
}> = ({ message }) => {
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
			console.error("Failed to copy message:", error);
		}
	};

	const handleSaveToRemembered = async () => {
		if (saving) return;

		setSaving(true);
		try {
			// Extract text content for saving
			const textContent =
				typeof message.content === "string"
					? message.content
					: message.content
							.filter((part) => part.type === "text")
							.map((part) => part.text)
							.join("\n");

			const pageData = {
				sourceType: "text" as const,
				sourceUrl: window.location.href,
				originalUrl: window.location.href,
				title: document.title || "Untitled",
				rawContent: textContent,
				cleanContent: textContent,
				textContent: textContent,
				sourceMetadata: {
					pageUrl: window.location.href,
					pageTitle: document.title || "Untitled",
					savedAt: message.timestamp.toISOString(),
				},
				extractionMetadata: {
					extractedAt: new Date().toISOString(),
					length: textContent.length,
					excerpt: textContent.substring(0, 200),
				},
			};

			// Use backgroundJob directly from content script
			const { backgroundJob } = await import(
				"@/services/background-jobs/background-job"
			);
			await backgroundJob.execute("remember-save", pageData, { stream: false });

			setSaved(true);
			setTimeout(() => setSaved(false), 3000);
		} catch (error) {
			console.error("Failed to save to remembered content:", error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex items-center gap-2 mt-2">
			<button
				onClick={handleCopy}
				className="h-8 px-3 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 group/copy"
				title={copied ? "Copied!" : "Copy message"}
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
					{copied ? "Copied" : "Copy"}
				</span>
			</button>

			<button
				onClick={handleSaveToRemembered}
				className="h-8 px-3 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 group/save"
				title={
					saved ? "Saved!" : saving ? "Saving..." : "Save to remembered content"
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
					{saving ? "Saving..." : saved ? "Saved!" : "Remember"}
				</span>
			</button>
		</div>
	);
};

// Enhanced Message Renderer with Actions
export const EmbeddedMessageRenderer: React.FC<
	EmbeddedMessageRendererProps
> = ({ message, isLoading }) => {
	const actions = message.metadata?.actions || [];

	// Loading state with actions
	if (!message.content && isLoading && message.role === "assistant") {
		return (
			<div className="flex flex-col gap-4">
				{actions.length > 0 &&
					actions.map((action, index) => (
						<Task
							key={`${action.name}_${index}`}
							className="w-full"
							defaultOpen={false}
						>
							<TaskTrigger title={action.name} />
							<TaskContent>
								<TaskItem>{action.description}</TaskItem>
							</TaskContent>
						</Task>
					))}
				<div className="flex items-center gap-2">
					<Loader size={14} />
					<span className="text-muted-foreground text-sm">Thinking...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{actions.length > 0 &&
				actions.map((action, index) => (
					<Task
						key={`${action.name}_${index}`}
						className="w-full"
						defaultOpen={false}
					>
						<TaskTrigger title={action.name} />
						<TaskContent>
							<TaskItem>{action.description}</TaskItem>
						</TaskContent>
					</Task>
				))}
			{message.content && (
				<>
					{message.role === "user" ? (
						// User messages: render with better context UI
						<UserMessageContent message={message} />
					) : (
						// Assistant messages: render as markdown with action buttons
						<>
							<EmbeddedMarkdown
								content={
									typeof message.content === "string"
										? message.content
										: message.content
												.filter((part) => part.type === "text")
												.map((part) => part.text)
												.join("\n")
								}
								isStreaming={isLoading && message.role === "assistant"}
							/>
							{!isLoading && <MessageActions message={message} />}
						</>
					)}
				</>
			)}
		</div>
	);
};
