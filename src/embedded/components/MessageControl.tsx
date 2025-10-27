import { Loader } from "lucide-react";
import React, { type FormEventHandler } from "react";
import { CloseIcon } from "./Icons";

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
	}
>(({ className, children, onScroll }, ref) => (
	<div ref={ref} className={`relative ${className || ""}`} onScroll={onScroll}>
		{children}
	</div>
));

export const ConversationContent: React.FC<{
	className?: string;
	children: React.ReactNode;
}> = ({ className, children }) => (
	<div className={`overflow-y-auto px-4 py-4 ${className || ""}`}>
		{children}
	</div>
);

export const Message: React.FC<{
	role: "user" | "assistant";
	children: React.ReactNode;
}> = ({ role, children }) => (
	<div
		className={`flex flex-col gap-2 ${role === "user" ? "items-end" : "items-start"}`}
	>
		{children}
	</div>
);

export const MessageContent: React.FC<{
	role: "user" | "assistant";
	children: React.ReactNode;
}> = ({ role, children }) => (
	<div
		className={`text-sm ${
			role === "user"
				? "ml-auto bg-primary text-primary-foreground p-3 rounded-lg max-w-[85%]"
				: "text-foreground max-w-[100%]"
		}`}
	>
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

export const ReasoningTrigger: React.FC = () => (
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
		<span>💭 Reasoning</span>
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

export const SourcesTrigger: React.FC<{ count: number }> = ({ count }) => (
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
		<span>🔗 Sources ({count})</span>
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
	<form
		onSubmit={onSubmit}
		className="relative border rounded-lg bg-background"
	>
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
		className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-h-[50px] max-h-32"
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
}) => (
	<div className="flex items-center justify-between border-t px-3 py-2">
		{children}
	</div>
);

export const PromptInputTools: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => <div className="flex items-center gap-1">{children}</div>;

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
}> = ({ disabled, status, onStop }) => (
	<button
		type={status === "streaming" ? "button" : "submit"}
		disabled={disabled}
		onClick={status === "streaming" ? onStop : undefined}
		className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
	>
		{status === "streaming" ? (
			<>
				<Loader size={14} />
				<span className="ml-1">Stop</span>
			</>
		) : (
			"Send"
		)}
	</button>
);

// Header Component
interface ChatHeaderProps {
	mode: "general" | "topic" | "recall";
	onOpenFullVersion: () => void;
	onClose: () => void;
	modelId?: string;
	provider?: string;
	modelAvailable?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
	mode,
	onOpenFullVersion,
	onClose,
	modelId,
	provider,
	modelAvailable,
}) => {
	return (
		<div className="border-b bg-muted/50 px-4 py-3 flex-shrink-0">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3 min-w-0 flex-1">
					<img
						src={chrome.runtime.getURL("logo.png")}
						alt="Memorall"
						className="w-6 h-6 flex-shrink-0"
					/>
					<span className="font-semibold text-base flex-shrink-0">Recall</span>
					{modelAvailable && modelId && provider ? (
						<div className="flex items-center gap-1 text-xs min-w-0">
							<div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
							<span className="text-foreground font-medium truncate min-w-0 flex-1">
								{modelId}
							</span>
						</div>
					) : (
						<div className="flex items-center gap-1 text-xs">
							<div className="w-1.5 h-1.5 rounded-full bg-red-500" />
							<span className="text-muted-foreground">No model</span>
						</div>
					)}
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={onOpenFullVersion}
						className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
						aria-label="Open full version"
						title="Open full version"
						onKeyDown={(e) => e.stopPropagation()}
						onKeyUp={(e) => e.stopPropagation()}
						onKeyPress={(e) => e.stopPropagation()}
					>
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
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							/>
						</svg>
					</button>
					<button
						onClick={onClose}
						className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
						aria-label="Close"
						onKeyDown={(e) => e.stopPropagation()}
						onKeyUp={(e) => e.stopPropagation()}
						onKeyPress={(e) => e.stopPropagation()}
					>
						<CloseIcon className="w-4 h-4" />
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
