import React, { useState } from "react";
import type { ChatMessage } from "../types";
import { EmbeddedMarkdown } from "./EmbeddedMarkdown";
import { Task, TaskTrigger, TaskContent, TaskItem } from "./TaskComponents";
import { Loader } from "./Icons";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "@/constants/language";
import type { Language } from "@/constants/language";

// Translation map for action names
const ACTION_TRANSLATIONS = {
	en: {
		// Add common action translations here - these should match the chat.json actions namespace
		search_knowledge: "Search Knowledge",
		retrieve_documents: "Retrieve Documents",
		analyze_content: "Analyze Content",
		generate_response: "Generate Response",
		process_query: "Process Query",
	},
	vn: {
		search_knowledge: "Tìm kiếm kiến thức",
		retrieve_documents: "Truy xuất tài liệu",
		analyze_content: "Phân tích nội dung",
		generate_response: "Tạo phản hồi",
		process_query: "Xử lý truy vấn",
	},
};

// Helper function to translate action names (similar to MessageRenderer.tsx)
const translateActionName = (
	actionName: string,
	language: Language,
): string => {
	// Try to get translation from actions map
	const translations = ACTION_TRANSLATIONS[language];
	if (translations && translations[actionName as keyof typeof translations]) {
		return translations[actionName as keyof typeof translations];
	}

	// Fallback: replace underscores with spaces and capitalize first letter
	return actionName.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

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
				regex: /<viewport_html_structure>([\s\S]*?)<\/viewport_html_structure>/,
				label: "🏗️ Viewport HTML",
				type: "html",
			},
			{
				regex: /<full_page_content>([\s\S]*?)<\/full_page_content>/,
				label: "📄 Full Page Content",
				type: "text",
			},
			{
				regex:
					/<full_page_html_structure>([\s\S]*?)<\/full_page_html_structure>/,
				label: "🏗️ Page HTML",
				type: "html",
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
			{
				regex: /<selected_image>([\s\S]*?)<\/selected_image>/,
				label: "🖼️ Selected Region",
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
			console.error("Failed to copy content:", error);
		}
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
					const isHtml = section.type === "html";
					const isCopied = copiedSection === section.label;

					return (
						<div
							key={idx}
							className="border border-border rounded-lg overflow-hidden bg-card"
						>
							<div className="w-full px-3 py-2 flex items-center justify-between text-xs font-medium bg-card hover:bg-accent transition-colors">
								<button
									onClick={() => toggleSection(section.label)}
									className="flex-1 flex items-center justify-between text-left"
									onKeyDown={(e) => e.stopPropagation()}
									onKeyUp={(e) => e.stopPropagation()}
									onKeyPress={(e) => e.stopPropagation()}
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
								<button
									onClick={(e) =>
										copySection(section.label, section.content, e)
									}
									className="ml-2 p-1 rounded hover:bg-accent-foreground/10 transition-colors"
									title={isCopied ? "Copied!" : "Copy content"}
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
											className="w-4 h-4 text-muted-foreground hover:text-foreground"
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
								<div className="px-3 py-2 border-t border-border bg-muted/30">
									{isScreenshot ? (
										<div className="text-xs text-muted-foreground italic">
											{section.content}
										</div>
									) : isHtml ? (
										<pre className="whitespace-pre-wrap font-mono text-xs text-foreground/80 max-h-96 overflow-y-auto overflow-x-auto">
											{section.content}
										</pre>
									) : (
										<pre className="whitespace-pre-wrap font-sans text-xs text-foreground/80 max-h-96 overflow-y-auto">
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
	allMessages: ChatMessage[];
	selectedTopic?: string;
}

// Message Actions Component
const MessageActions: React.FC<{
	message: ChatMessage;
	allMessages: ChatMessage[];
	selectedTopic?: string;
}> = ({ message, allMessages, selectedTopic }) => {
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

					// Format as: "User: <message>" or "Assistant: <message>"
					const role = msg.role === "user" ? "User" : "Assistant";
					return `${role}: ${content}`;
				})
				.join("\n\n");

			// Generate a unique identifier for this conversation
			const conversationId = `conversation-${Date.now()}-${Math.random().toString(36).substring(7)}`;

			// Prepare the content with source info (similar to CONVERT_TO_KNOWLEDGE_CONTEXT_MENU_ID)
			const sourceInfo = `Direct content save\nWeb Title: ${document.title || "Untitled"}\nWeb URL: ${window.location.href}\n\n`;
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
			console.error("Failed to save to remembered content:", error);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex items-center gap-1">
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
> = ({ message, isLoading, allMessages, selectedTopic }) => {
	const actions = message.metadata?.actions || [];
	const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

	// Load language from storage on mount
	React.useEffect(() => {
		const loadLanguage = async () => {
			try {
				const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
				const savedLanguage = result[LANGUAGE_STORAGE_KEY];

				if (
					savedLanguage &&
					(savedLanguage === "en" || savedLanguage === "vn")
				) {
					setLanguage(savedLanguage);
				}
			} catch (error) {
				console.error("Failed to load language:", error);
				// Keep default language
			}
		};

		loadLanguage();
	}, []);

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
							<TaskTrigger title={translateActionName(action.name, language)} />
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
						<TaskTrigger title={translateActionName(action.name, language)} />
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
