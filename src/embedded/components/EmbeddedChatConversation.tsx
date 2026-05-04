import React from "react";
import {
	Conversation,
	ConversationContent,
	Message,
	MessageContent,
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from "@/embedded/components/MessageControl";
import { EmbeddedMessageRenderer } from "@/embedded/components/EmbeddedMessageRenderer";
import type { EMBEDDED_TRANSLATIONS } from "@/embedded/language";
import type { ChatMessage, EmbeddedContextItem } from "@/embedded/types";

interface EmbeddedChatConversationProps {
	conversationRef: React.RefObject<HTMLDivElement | null>;
	onScroll: React.UIEventHandler<HTMLDivElement>;
	onWheel: React.WheelEventHandler<HTMLDivElement>;
	needsPasskey: boolean;
	noModelConfig: boolean;
	encryptedProviders: string[];
	selectedProvider: string;
	messages: ChatMessage[];
	selectedTopic: string;
	pageHost: string;
	suggestedPrompts: string[];
	primaryPageContext?: EmbeddedContextItem;
	texts: typeof EMBEDDED_TRANSLATIONS.en.chat;
	onAttachContext: (contextItem: EmbeddedContextItem) => void;
	onSelectPrompt: (prompt: string) => void;
	onOpenMainApp: () => void;
}

const AuthRequiredState = ({
	encryptedProviders,
	selectedProvider,
	texts,
	onOpenMainApp,
}: Pick<
	EmbeddedChatConversationProps,
	"encryptedProviders" | "selectedProvider" | "texts" | "onOpenMainApp"
>) => (
	<div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
		<div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
			<svg
				className="w-6 h-6 text-amber-600 dark:text-amber-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				/>
			</svg>
		</div>
		<h3 className="font-medium mb-2 text-foreground">
			{texts.authRequired || "Authentication Required"}
		</h3>
		<p className="text-muted-foreground text-xs leading-relaxed mb-4">
			{texts.authRequiredDescription ||
				`${
					encryptedProviders.length > 0
						? `Your ${encryptedProviders.join(", ")} provider`
						: `Your ${selectedProvider} model`
				} requires authentication. Please open the main app to enter your passkey.`}
		</p>
		<button
			onClick={onOpenMainApp}
			className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
		>
			{texts.openMainApp || "Open Main App"}
		</button>
	</div>
);

const NoModelConfigState = ({
	texts,
	onOpenMainApp,
}: Pick<EmbeddedChatConversationProps, "texts" | "onOpenMainApp">) => (
	<div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
		<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
			<svg
				className="w-6 h-6 text-muted-foreground"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
				/>
			</svg>
		</div>
		<h3 className="font-medium mb-2 text-foreground">{texts.noModelConfig}</h3>
		<p className="text-muted-foreground text-xs leading-relaxed mb-4">
			{texts.noModelConfigDescription}
		</p>
		<button
			onClick={onOpenMainApp}
			className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
		>
			{texts.configureModel}
		</button>
	</div>
);

const EmptyConversationState = ({
	pageHost,
	suggestedPrompts,
	primaryPageContext,
	texts,
	onSelectPrompt,
	onAttachContext,
}: Pick<
	EmbeddedChatConversationProps,
	| "pageHost"
	| "suggestedPrompts"
	| "primaryPageContext"
	| "texts"
	| "onSelectPrompt"
	| "onAttachContext"
>) => (
	<div className="memorall-empty-state">
		<div className="memorall-empty-logo">
			<img
				src={chrome.runtime.getURL("logo.png")}
				alt="Memorall Logo"
				className="memorall-empty-logo-image"
			/>
		</div>
		<div className="memorall-empty-kicker">
			{texts.pageContext}: {pageHost}
		</div>
		<h3 className="memorall-empty-title">{texts.askAboutPage}</h3>
		<p className="memorall-empty-description">{texts.recallDescription}</p>
		<div className="memorall-suggested-prompts">
			{suggestedPrompts.map((prompt) => (
				<button
					key={prompt}
					type="button"
					className="memorall-suggested-prompt"
					onClick={() => onSelectPrompt(prompt)}
					onKeyDown={(event) => event.stopPropagation()}
					onKeyUp={(event) => event.stopPropagation()}
					onKeyPress={(event) => event.stopPropagation()}
				>
					{prompt}
				</button>
			))}
		</div>
		{primaryPageContext && (
			<button
				type="button"
				className="memorall-context-cta"
				onClick={() => onAttachContext(primaryPageContext)}
				onKeyDown={(event) => event.stopPropagation()}
				onKeyUp={(event) => event.stopPropagation()}
				onKeyPress={(event) => event.stopPropagation()}
			>
				{texts.attachPageContext}
			</button>
		)}
	</div>
);

const ChatMessageItem = ({
	message,
	messages,
	selectedTopic,
}: {
	message: ChatMessage;
	messages: ChatMessage[];
	selectedTopic: string;
}) => (
	<div className="space-y-3 overflow-x-hidden">
		<Message role={message.role}>
			<MessageContent role={message.role}>
				<EmbeddedMessageRenderer
					message={message}
					isLoading={message.isStreaming || false}
					allMessages={messages}
					selectedTopic={selectedTopic}
				/>
			</MessageContent>
		</Message>
		{message.reasoning && message.role === "assistant" && (
			<div className="max-w-[100%]">
				<Reasoning isStreaming={message.isStreaming} defaultOpen={false}>
					<ReasoningTrigger />
					<ReasoningContent>{message.reasoning}</ReasoningContent>
				</Reasoning>
			</div>
		)}
		{message.sources &&
			message.sources.length > 0 &&
			message.role === "assistant" && (
				<div className="max-w-[100%]">
					<Sources>
						<SourcesTrigger count={message.sources.length} />
						<SourcesContent>
							{message.sources.map((source, index) => (
								<Source
									key={`${source.url}-${index}`}
									href={source.url}
									title={source.title}
								/>
							))}
						</SourcesContent>
					</Sources>
				</div>
			)}
	</div>
);

export const EmbeddedChatConversation = ({
	conversationRef,
	onScroll,
	onWheel,
	needsPasskey,
	noModelConfig,
	encryptedProviders,
	selectedProvider,
	messages,
	selectedTopic,
	pageHost,
	suggestedPrompts,
	primaryPageContext,
	texts,
	onAttachContext,
	onSelectPrompt,
	onOpenMainApp,
}: EmbeddedChatConversationProps) => (
	<Conversation
		ref={conversationRef}
		className="flex-1 overflow-y-auto overscroll-contain"
		onScroll={onScroll}
		onWheel={onWheel}
	>
		<ConversationContent className="space-y-4">
			{needsPasskey ? (
				<AuthRequiredState
					encryptedProviders={encryptedProviders}
					selectedProvider={selectedProvider}
					texts={texts}
					onOpenMainApp={onOpenMainApp}
				/>
			) : noModelConfig ? (
				<NoModelConfigState texts={texts} onOpenMainApp={onOpenMainApp} />
			) : messages.length === 0 ? (
				<EmptyConversationState
					pageHost={pageHost}
					suggestedPrompts={suggestedPrompts}
					primaryPageContext={primaryPageContext}
					texts={texts}
					onSelectPrompt={onSelectPrompt}
					onAttachContext={onAttachContext}
				/>
			) : (
				messages.map((message) => (
					<ChatMessageItem
						key={message.id}
						message={message}
						messages={messages}
						selectedTopic={selectedTopic}
					/>
				))
			)}
		</ConversationContent>
	</Conversation>
);
