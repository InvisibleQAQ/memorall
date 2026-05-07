import React from "react";
import type { ChatMessage } from "../types";
import { Loader } from "./Icons";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";
import { getTextContent } from "./messages/utils";
import {
	EmbeddedToolSummaries,
	AssistantMessageContent,
	UserMessageContent,
	MessageActions,
} from "./messages";

export interface EmbeddedMessageRendererProps {
	message: ChatMessage;
	isLoading: boolean;
	allMessages: ChatMessage[];
	selectedTopic?: string;
}

export const EmbeddedMessageRenderer: React.FC<
	EmbeddedMessageRendererProps
> = ({ message, isLoading, allMessages, selectedTopic }) => {
	const t = useEmbeddedTranslation("messageRenderer");

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
						<UserMessageContent message={message} />
					) : (
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
