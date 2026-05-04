import {
	ExternalLink,
	Bot,
	Loader,
	MessageCircle,
	PanelRight,
	SquarePen,
} from "lucide-react";
import React, { type FormEventHandler } from "react";
import { CloseIcon } from "./Icons";
import { EMBEDDED_TRANSLATIONS } from "../language";
import { DEFAULT_LANGUAGE } from "@/constants/language";
import type { EmbeddedChatDisplayMode } from "@/embedded/types";

// Workflow type (matches api-types from workflows module)
export interface Workflow {
	id: string;
	project_id: string;
	name: string;
	description: string;
	source_workflow_id: string | null;
	params: Record<string, unknown> | null;
	balancer: Record<string, unknown> | null;
	workflow: Record<string, unknown>;
	session: Record<string, unknown> | null;
	created_at: string;
	updated_at: string | null;
	created_by: number;
	updated_by: number | null;
	// Additional runtime properties
	modelId?: string;
	provider?: string;
}

// Mock implementations of shadcn/ui AI components for content script context
// These replicate the exact structure and styling from your example

export const Conversation = React.forwardRef<
	HTMLDivElement,
	{
		className?: string;
		children: React.ReactNode;
		onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
		onWheel?: (e: React.WheelEvent<HTMLDivElement>) => void;
	}
>(({ className, children, onScroll, onWheel }, ref) => (
	<div
		ref={ref}
		className={`relative ${className || ""}`}
		onScroll={onScroll}
		onWheel={onWheel}
	>
		{children}
	</div>
));

export const ConversationContent: React.FC<{
	className?: string;
	children: React.ReactNode;
}> = ({ className, children }) => (
	<div className={`memorall-conversation-content ${className || ""}`}>
		{children}
	</div>
);

export const Message: React.FC<{
	role: "user" | "assistant";
	children: React.ReactNode;
}> = ({ role, children }) => (
	<div className={`memorall-message memorall-message--${role}`}>{children}</div>
);

export const MessageContent: React.FC<{
	role: "user" | "assistant";
	children: React.ReactNode;
}> = ({ role, children }) => (
	<div className={`memorall-message-content memorall-message-content--${role}`}>
		{children}
	</div>
);

export const Reasoning: React.FC<{
	isStreaming?: boolean;
	defaultOpen?: boolean;
	children: React.ReactNode;
}> = ({ isStreaming, defaultOpen = false, children }) => (
	<details className="group" open={defaultOpen}>
		{children}
	</details>
);

export const ReasoningTrigger: React.FC<{
	texts?: typeof EMBEDDED_TRANSLATIONS.en.messageControl;
}> = ({ texts = EMBEDDED_TRANSLATIONS[DEFAULT_LANGUAGE].messageControl }) => (
	<summary className="cursor-pointer flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground p-2 rounded border bg-muted/50">
		<svg
			className="w-3 h-3 group-open:rotate-90 transition-transform"
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				style={{
					scale: 2,
				}}
				fillRule="evenodd"
				d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
				clipRule="evenodd"
			/>
		</svg>
		<span>{texts.reasoning}</span>
	</summary>
);

export const ReasoningContent: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => (
	<div className="mt-2 p-3 text-xs text-muted-foreground bg-muted/30 rounded border">
		{children}
	</div>
);

export const Sources: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => <details className="group">{children}</details>;

export const SourcesTrigger: React.FC<{
	count: number;
	texts?: typeof EMBEDDED_TRANSLATIONS.en.messageControl;
}> = ({
	count,
	texts = EMBEDDED_TRANSLATIONS[DEFAULT_LANGUAGE].messageControl,
}) => (
	<summary className="cursor-pointer flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground p-2 rounded border bg-muted/50">
		<svg
			className="w-3 h-3 group-open:rotate-90 transition-transform"
			fill="currentColor"
			viewBox="0 0 20 20"
		>
			<path
				style={{
					scale: 2,
				}}
				fillRule="evenodd"
				d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
				clipRule="evenodd"
			/>
		</svg>
		<span>
			{texts.sources} ({count})
		</span>
	</summary>
);

export const SourcesContent: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => <div className="mt-2 space-y-2">{children}</div>;

export const Source: React.FC<{ href: string; title: string }> = ({
	href,
	title,
}) => (
	<div className="p-2 bg-muted/30 rounded border text-xs">
		<div className="font-medium">{title}</div>
		{href !== "#" && (
			<div className="text-muted-foreground text-xs mt-1">{href}</div>
		)}
	</div>
);

export const PromptInput: React.FC<{
	onSubmit: FormEventHandler<HTMLFormElement>;
	children: React.ReactNode;
}> = ({ onSubmit, children }) => (
	<form onSubmit={onSubmit} className="memorall-prompt-input">
		{children}
	</form>
);

export const PromptInputTextarea: React.FC<{
	value: string;
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	placeholder: string;
	disabled: boolean;
}> = ({ value, onChange, placeholder, disabled }) => (
	<textarea
		value={value}
		onChange={onChange}
		placeholder={placeholder}
		disabled={disabled}
		className="memorall-prompt-textarea"
		onKeyDown={(e) => {
			// Stop all keyboard events from propagating to the host page
			e.stopPropagation();

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				const form = e.currentTarget.closest("form");
				if (form) {
					form.requestSubmit();
				}
			}
		}}
		onKeyUp={(e) => {
			// Stop keyup events from propagating
			e.stopPropagation();
		}}
		onKeyPress={(e) => {
			// Stop keypress events from propagating
			e.stopPropagation();
		}}
	/>
);

export const PromptInputToolbar: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => <div className="memorall-prompt-toolbar">{children}</div>;

export const PromptInputTools: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => <div className="memorall-prompt-tools">{children}</div>;

// Simple Workflow Select Component
export const WorkflowDropdown: React.FC<{
	workflows: Workflow[];
	selectedWorkflow: Workflow | null;
	onSelect: (workflow: Workflow) => void;
	disabled?: boolean;
}> = ({ workflows, selectedWorkflow, onSelect, disabled }) => {
	return (
		<div className="flex items-center gap-2 max-w-[200px]">
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				className="text-muted-foreground flex-shrink-0"
			>
				<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
				<path d="M16 3.13a4 4 0 0 1 0 7.75" />
			</svg>
			<select
				value={selectedWorkflow?.id || ""}
				onChange={(e) => {
					const workflow = workflows.find((w) => w.id === e.target.value);
					if (workflow) {
						onSelect(workflow);
					}
				}}
				disabled={disabled}
				className="text-xs bg-transparent border-0 px-2 py-1 text-muted-foreground hover:text-foreground focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed truncate flex-1 min-w-0"
				style={{ maxWidth: "100%" }}
				onKeyDown={(e) => e.stopPropagation()}
				onKeyUp={(e) => e.stopPropagation()}
				onKeyPress={(e) => e.stopPropagation()}
			>
				<option value="" disabled>
					Select Workflow
				</option>
				{workflows.map((workflow) => (
					<option key={workflow.id} value={workflow.id}>
						{workflow.name}
					</option>
				))}
			</select>
		</div>
	);
};

export const PromptInputSubmit: React.FC<{
	disabled: boolean;
	status: "ready" | "streaming";
	onStop?: () => void;
	texts?: typeof EMBEDDED_TRANSLATIONS.en.messageControl;
}> = ({
	disabled,
	status,
	onStop,
	texts = EMBEDDED_TRANSLATIONS[DEFAULT_LANGUAGE].messageControl,
}) => (
	<button
		type={status === "streaming" ? "button" : "submit"}
		disabled={disabled}
		onClick={status === "streaming" ? onStop : undefined}
		className="memorall-submit-button"
		aria-label={status === "streaming" ? texts.stop : texts.send}
		title={status === "streaming" ? texts.stop : texts.send}
	>
		{status === "streaming" ? (
			<>
				<Loader size={14} />
				<span>{texts.stop}</span>
			</>
		) : (
			texts.send
		)}
	</button>
);

// Header Component
interface ChatHeaderProps {
	mode: "general" | "topic" | "recall";
	displayMode: EmbeddedChatDisplayMode;
	onToggleDisplayMode: () => void;
	onNewChat: () => void;
	onOpenFullVersion: () => void;
	onClose: () => void;
	coAgentEnabled?: boolean;
	onToggleCoAgent?: () => void;
	modelId?: string;
	provider?: string;
	modelAvailable?: boolean;
	texts?: typeof EMBEDDED_TRANSLATIONS.en.messageControl;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
	displayMode,
	onToggleDisplayMode,
	onNewChat,
	onOpenFullVersion,
	onClose,
	coAgentEnabled,
	onToggleCoAgent,
	modelId,
	provider,
	modelAvailable,
	texts = EMBEDDED_TRANSLATIONS[DEFAULT_LANGUAGE].messageControl,
}) => {
	const displayToggleLabel =
		displayMode === "panel" ? texts.switchToPopup : texts.switchToPanel;

	return (
		<div className="memorall-chat-header">
			<div className="memorall-chat-header-inner">
				<div className="memorall-chat-title">
					<img
						src={chrome.runtime.getURL("logo.png")}
						alt="Memorall"
						className="memorall-chat-logo"
					/>
					<span className="memorall-chat-brand">{texts.recall}</span>
					{modelAvailable && modelId && provider ? (
						<div className="memorall-model-chip memorall-model-chip--ready">
							<div className="memorall-model-dot" />
							<span className="memorall-model-name">{modelId}</span>
						</div>
					) : (
						<div className="memorall-model-chip memorall-model-chip--empty">
							<div className="memorall-model-dot" />
							<span>{texts.noModel}</span>
						</div>
					)}
				</div>
				<div className="memorall-header-actions">
					<button
						onClick={onToggleCoAgent}
						className={`memorall-icon-button ${
							coAgentEnabled ? "memorall-icon-button--active" : ""
						}`}
						aria-label={coAgentEnabled ? "Disable co-agent" : "Enable co-agent"}
						title={coAgentEnabled ? "Disable co-agent" : "Enable co-agent"}
						onKeyDown={(e) => e.stopPropagation()}
						onKeyUp={(e) => e.stopPropagation()}
						onKeyPress={(e) => e.stopPropagation()}
					>
						<Bot size={16} />
					</button>
					<button
						onClick={onNewChat}
						className="memorall-icon-button"
						aria-label={texts.newChat}
						title={texts.newChat}
						onKeyDown={(e) => e.stopPropagation()}
						onKeyUp={(e) => e.stopPropagation()}
						onKeyPress={(e) => e.stopPropagation()}
					>
						<SquarePen size={16} />
					</button>
					<button
						onClick={onToggleDisplayMode}
						className="memorall-icon-button"
						aria-label={displayToggleLabel}
						title={displayToggleLabel}
						onKeyDown={(e) => e.stopPropagation()}
						onKeyUp={(e) => e.stopPropagation()}
						onKeyPress={(e) => e.stopPropagation()}
					>
						{displayMode === "panel" ? (
							<MessageCircle size={16} />
						) : (
							<PanelRight size={16} />
						)}
					</button>
					<button
						onClick={onOpenFullVersion}
						className="memorall-icon-button"
						aria-label={texts.openFullVersion}
						title={texts.openFullVersion}
						onKeyDown={(e) => e.stopPropagation()}
						onKeyUp={(e) => e.stopPropagation()}
						onKeyPress={(e) => e.stopPropagation()}
					>
						<ExternalLink size={16} />
					</button>
					<button
						onClick={onClose}
						className="memorall-icon-button"
						aria-label={texts.close}
						title={texts.close}
						onKeyDown={(e) => e.stopPropagation()}
						onKeyUp={(e) => e.stopPropagation()}
						onKeyPress={(e) => e.stopPropagation()}
					>
						<CloseIcon className="memorall-icon" />
					</button>
				</div>
			</div>
		</div>
	);
};

interface EmptyStateProps {
	hasWorkflows: boolean;
	hasContextOptions: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
	hasWorkflows,
	hasContextOptions,
}) => {
	return (
		<div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
			<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 overflow-hidden">
				<img
					src={chrome.runtime.getURL("logo.png")}
					alt="contexta Logo"
					className="w-8 h-8 object-contain"
				/>
			</div>
			<h3 className="font-medium mb-2">
				{!hasWorkflows
					? "No Workflows Available"
					: hasContextOptions
						? "Ask your Jitera"
						: "Start a Conversation"}
			</h3>
			<p className="text-muted-foreground text-xs leading-relaxed max-w-xs">
				{!hasWorkflows
					? "Please configure a workflow in the extension to start chatting."
					: hasContextOptions
						? "Select one or more context options above, or start asking questions directly."
						: "Select a workflow and start asking questions."}
			</p>
		</div>
	);
};
