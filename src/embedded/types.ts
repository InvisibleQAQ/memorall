import type { ChatAction } from "@/main/modules/chat/services/chat-service";

export type { ChatAction };

export interface ChatMessage {
	id: string;
	// content should follow openAI message content format
	content:
		| string
		| Array<
				| { type: "text"; text: string }
				| {
						type: "image_url";
						image_url: { url: string; detail?: "low" | "high" | "auto" };
				  }
		  >;
	role: "user" | "assistant";
	timestamp: Date;
	topicId?: string | null;
	reasoning?: string;
	sources?: Array<{ title: string; url: string }>;
	isStreaming?: boolean;
	metadata?: {
		actions?: ChatAction[];
		tool_calls?: unknown[];
		executeState?: {
			node?: string;
			metadata?: Record<string, unknown>;
		};
		model?: string;
		provider?: string;
		timeToAnswer?: number;
		tokensPerSecond?: number;
		estimatedTokens?: number;
		usage?: {
			prompt_tokens?: number;
			completion_tokens?: number;
			total_tokens?: number;
		};
		[key: string]: unknown;
	};
}

export interface SelectionData {
	selectedText: string;
	selectionContext: string;
	pageUrl: string;
	pageTitle: string;
	timestamp: string;
	selectionRange?: {
		startOffset: number;
		endOffset: number;
	};
}

export interface PageMetadata {
	url: string;
	title: string;
	favicon: string;
	description: string;
	ogImage: string;
	timestamp: string;
	domain: string;
	siteName: string;
}

export interface ReadableContent {
	title: string;
	content: string;
	textContent: string;
	length: number;
	excerpt: string;
	byline: string;
	dir: string;
	lang: string;
	siteName: string;
}

export interface ExtractedPageData {
	html: string;
	url: string;
	title: string;
	metadata: PageMetadata;
	topicId: string | null;
	article: ReadableContent;
}

export interface ExtractedSelectionData {
	selectedText: string;
	selectionContext: string;
	url: string;
	title: string;
	sourceMetadata: SelectionData;
}

export interface RememberContext {
	context?: string;
	pageUrl: string;
	pageTitle: string;
	timestamp: string;
}

export type EmbeddedContextKind =
	| "selection"
	| "viewport"
	| "viewport_html"
	| "full_page"
	| "full_page_html"
	| "viewport_screenshot"
	| "screenshot"
	| "selected_image"
	| "smart_text"
	| "smart_clean_html"
	| "smart_html";

export interface EmbeddedContextItem {
	id: string;
	kind: EmbeddedContextKind;
	label: string;
	content: string;
}

export type EmbeddedChatDisplayMode = "panel" | "popup";

export interface ChatModalProps {
	context?: string;
	mode?: "general" | "topic";
	displayMode?: EmbeddedChatDisplayMode;
	coAgentEnabled?: boolean;
	pageUrl: string;
	pageTitle: string;
	contextOptions?: EmbeddedContextItem[];
	onCoAgentToggle?: (enabled: boolean) => void;
	onClose: () => void;
}

export interface TopicSelectorProps {
	context: string;
	pageUrl: string;
	pageTitle: string;
	onClose: () => void;
}

export interface BackgroundMessage {
	type: string;
	tabId?: number;
	url?: string;
	context?: string;
	selectedText?: string;
	topicId?: string;
	mode?: "general" | "topic";
	displayMode?: EmbeddedChatDisplayMode;
	coAgentEnabled?: boolean;
	showTopicSelector?: boolean;
	contextData?: RememberContext;
	data?: ExtractedPageData | ExtractedSelectionData;
	folderPath?: string;
	fileName?: string;
	mimeType?: string;
	content?: string;
	imageSources?: string[];
}

export interface MessageResponse {
	success: boolean;
	error?: string;
	jobId?: string;
	topics?: Array<{ id: string; name: string; description?: string }>;
}
