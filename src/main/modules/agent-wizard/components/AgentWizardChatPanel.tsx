import React from "react";
import { ArrowLeft, Bot, Send, Square } from "lucide-react";
import { Button } from "@/main/components/ui/button";
import { ScrollArea } from "@/main/components/ui/scroll-area";
import {
	PromptInput,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
} from "@/main/components/ui/shadcn-io/ai/prompt-input";
import { MessageRenderer } from "@/main/modules/chat/components/MessageRenderer";
import type { Message as DBMessage } from "@/services/database/types";
import type { AgentWizardMessage } from "../types";
import { cn } from "@/lib/utils";

interface AgentWizardChatPanelProps {
	messages: AgentWizardMessage[];
	inputValue: string;
	onInputChange: (value: string) => void;
	onSubmit: (event?: React.FormEvent) => void;
	onStop: () => void;
	onBack?: () => void;
	isStreaming: boolean;
	isModelReady: boolean;
}

const toDbMessage = (message: AgentWizardMessage): DBMessage =>
	({
		id: message.id,
		conversationId: "agent-wizard",
		type: "text",
		role: message.role,
		content: message.content,
		complexContent: null,
		topicId: null,
		embeddingSmall: null,
		embedding: null,
		embeddingLarge: null,
		metadata: {},
		createdAt: message.createdAt,
		updatedAt: message.createdAt,
	}) as DBMessage;

export const AgentWizardChatPanel: React.FC<AgentWizardChatPanelProps> = ({
	messages,
	inputValue,
	onInputChange,
	onSubmit,
	onStop,
	onBack,
	isStreaming,
	isModelReady,
}) => {
	const dbMessages = React.useMemo(() => messages.map(toDbMessage), [messages]);
	const canSubmit = Boolean(inputValue.trim()) && !isStreaming && isModelReady;

	return (
		<section className="flex h-full min-h-0 flex-col bg-background">
			<div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
				{onBack ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 gap-1.5 px-2 text-xs"
						onClick={onBack}
					>
						<ArrowLeft size={13} />
						Presets
					</Button>
				) : null}
				<div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
					<Bot size={16} />
				</div>
				<div className="min-w-0">
					<h2 className="text-sm font-semibold">Build agent with AI</h2>
					<p className="truncate text-xs text-muted-foreground">
						Describe behavior, tools, skills, and constraints.
					</p>
				</div>
			</div>

			<ScrollArea className="min-h-0 flex-1 px-4 py-4">
				<div className="mx-auto flex max-w-3xl flex-col gap-5">
					{dbMessages.map((message, index) => (
						<MessageRenderer
							key={message.id}
							message={message}
							index={index}
							isLastMessage={index === dbMessages.length - 1}
							isStreaming={
								isStreaming &&
								index === dbMessages.length - 1 &&
								message.role === "assistant"
							}
							groupMessages={dbMessages}
							showMessageControls={false}
						/>
					))}
				</div>
			</ScrollArea>

			<div className="shrink-0 border-t p-3">
				<PromptInput
					className="mx-auto max-w-3xl"
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit(event);
					}}
				>
					<PromptInputTextarea
						value={inputValue}
						placeholder={
							isModelReady
								? "Ask AI to build or update this agent..."
								: "Select or load a model before chatting..."
						}
						disabled={isStreaming || !isModelReady}
						onChange={(event) => onInputChange(event.target.value)}
						className="min-h-[76px]"
					/>
					<PromptInputToolbar>
						<span
							className={cn(
								"px-2 text-xs",
								isModelReady ? "text-muted-foreground" : "text-destructive",
							)}
						>
							{isModelReady ? "Wizard draft only" : "No model selected"}
						</span>
						{isStreaming ? (
							<Button
								type="button"
								size="icon"
								variant="ghost"
								onClick={onStop}
								aria-label="Stop"
							>
								<Square size={15} />
							</Button>
						) : (
							<PromptInputSubmit disabled={!canSubmit} aria-label="Send">
								<Send size={15} />
							</PromptInputSubmit>
						)}
					</PromptInputToolbar>
				</PromptInput>
			</div>
		</section>
	);
};
