import React, { lazy, Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

import { ThreeDotsLoader } from "@/main/components/atoms/ThreeDotsLoader";
import {
	Message,
	MessageContent,
} from "@/main/components/ui/shadcn-io/ai/message";
import type { Message as DBMessage } from "@/services/database/types";

import { MessageActions, type MessageActionItem } from "./MessageActions";
import { MessageFooter, type MessageFooterMetadata } from "./MessageFooter";

const USE_STREAMDOWN = false;
const Streamdown = lazy(() => import("./MessageStreamDown"));
const MarkdownMessage = lazy(() => import("./MarkdownMessage"));
const ContentComponent = USE_STREAMDOWN ? Streamdown : MarkdownMessage;

interface MessageMetadata extends MessageFooterMetadata {
	actions?: MessageActionItem[];
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
}

export const MessageRenderer: React.FC<MessageRendererProps> = React.memo(
	({ message, isLastMessage, isStreaming, groupMessages, selectedTopic }) => {
		const formattedDate = useMemo(
			() => dayjs(message.createdAt).format("MMM D, YYYY h:mm A"),
			[message.createdAt],
		);
		const { t } = useTranslation("chat");

		const actions = useMemo<MessageActionItem[]>(() => {
			if (!message.metadata || typeof message.metadata !== "object") return [];
			if (!("actions" in message.metadata)) return [];
			if (!Array.isArray(message.metadata.actions)) return [];
			return message.metadata.actions;
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
					<div className="flex-1 border-t border-gray-300"></div>
					<div className="mx-4 text-xs text-gray-500 font-medium">
						{formattedDate}
					</div>
					<div className="flex-1 border-t border-gray-300"></div>
				</div>
			);
		}

		return (
			<div key={message.id} className="flex flex-col gap-4">
				<MessageActions actions={actions} />
				<Message key={message.id} from={message.role}>
					<MessageContent className="relative">
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
									<ContentComponent isStreaming={isStreaming}>
										{message.content}
									</ContentComponent>
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
									{!isStreaming &&
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
			prev.message.metadata === next.message.metadata &&
			prev.isLastMessage === next.isLastMessage &&
			prev.isStreaming === next.isStreaming
		);
	},
);
