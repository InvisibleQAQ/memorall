import React, {
	useRef,
	lazy,
	Suspense,
	useMemo,
	useCallback,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
	Network,
	FileText,
	Search,
	Sparkles,
	ChevronDown,
	ChevronUp,
	PenLine,
	Database,
	Brain,
	Zap,
	Clock,
	Gauge,
	Box,
	Copy,
	Check,
	Lightbulb,
	type LucideIcon,
} from "lucide-react";
import dayjs from "dayjs";

import { ThreeDotsLoader } from "@/popup/components/atoms/ThreeDotsLoader";
import {
	Message,
	MessageContent,
} from "@/popup/components/ui/shadcn-io/ai/message";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/popup/components/ui/shadcn-io/ai/task";
import { MermaidRenderer } from "@/popup/components/atoms/MermaidRenderer";
import type { Message as DBMessage } from "@/services/database/types";
import { backgroundJob } from "@/services/background-jobs/background-job";

import { MessageKnowledgeGraph } from "./MessageKnowledgeGraph";

const USE_STREAMDOWN = false;
const Streamdown = lazy(() => import("./MessageStreamDown"));
const MarkdownMessage = lazy(() => import("./MarkdownMessage"));
const ContentComponent = USE_STREAMDOWN ? Streamdown : MarkdownMessage;

const TaskMermaidDiagram: React.FC<{ chart: string; isOpen: boolean }> = ({
	chart,
	isOpen,
}) => {
	const hasRendered = useRef(false);

	if (!isOpen) {
		return null;
	}

	if (!hasRendered.current) {
		hasRendered.current = true;
	}

	return <MermaidRenderer chart={chart} />;
};

const isMermaidOnly = (content: string): boolean => {
	const trimmed = content.trim();
	const mermaidRegex = /^```mermaid\s*\n([\s\S]*?)\n```$/;
	return mermaidRegex.test(trimmed);
};

const extractMermaidContent = (content: string): string => {
	const trimmed = content.trim();
	const mermaidRegex = /^```mermaid\s*\n([\s\S]*?)\n```$/;
	const match = trimmed.match(mermaidRegex);
	return match ? match[1].trim() : "";
};

interface KnowledgeGraphMetadata extends Record<string, unknown> {
	nodes: Array<{
		id: string;
		nodeType: string;
		name: string;
		summary: string;
		attributes: Record<string, unknown>;
		relevanceScore: number;
	}>;
	edges: Array<{
		id: string;
		sourceId: string;
		destinationId: string;
		edgeType: string;
		factText: string;
		attributes: Record<string, unknown>;
		relevanceScore: number;
	}>;
}

interface ActionItem {
	name: string;
	description: string;
	metadata?: Record<string, unknown>;
}

interface MessageMetadata extends Record<string, unknown> {
	model?: string;
	provider?: string;
	timeToAnswer?: number;
	tokensPerSecond?: number;
	estimatedTokens?: number;
	actions?: ActionItem[];
}

// Type guard for knowledge graph metadata
function isKnowledgeGraphMetadata(
	metadata: Record<string, unknown> | undefined,
): metadata is KnowledgeGraphMetadata {
	if (!metadata) {
		return false;
	}

	// Validate nodes with detailed logging
	let hasNodes = false;
	if (Array.isArray(metadata.nodes)) {
		const invalidNodes = metadata.nodes.filter(
			(node: unknown, index: number) => {
				if (typeof node !== "object" || node === null) {
					return true;
				}
				const nodeObj = node as Record<string, unknown>;
				const checks = {
					hasId: "id" in nodeObj,
					hasName: "name" in nodeObj,
					idIsString: typeof nodeObj.id === "string",
					nameIsString: typeof nodeObj.name === "string",
				};
				const isValid = Object.values(checks).every(Boolean);
				return !isValid;
			},
		);
		hasNodes = invalidNodes.length === 0;
	}

	// Validate edges with detailed logging
	let hasEdges = false;
	if (Array.isArray(metadata.edges)) {
		const invalidEdges = metadata.edges.filter(
			(edge: unknown, index: number) => {
				if (typeof edge !== "object" || edge === null) {
					return true;
				}
				const edgeObj = edge as Record<string, unknown>;
				const checks = {
					hasId: "id" in edgeObj,
					hasSourceId: "sourceId" in edgeObj,
					hasDestinationId: "destinationId" in edgeObj,
					hasEdgeType: "edgeType" in edgeObj,
					idIsString: typeof edgeObj.id === "string",
					sourceIdIsString: typeof edgeObj.sourceId === "string",
					destinationIdIsString: typeof edgeObj.destinationId === "string",
					edgeTypeIsString: typeof edgeObj.edgeType === "string",
				};
				const isValid = Object.values(checks).every(Boolean);
				return !isValid;
			},
		);
		hasEdges = invalidEdges.length === 0;
	}

	return hasNodes && hasEdges;
}

const ICON_MAPPINGS: Array<{ keywords: string[]; icon: LucideIcon }> = [
	{ keywords: ["search", "query", "retrieval", "retrieve"], icon: Search },
	{ keywords: ["generat", "create"], icon: Sparkles },
	{ keywords: ["write", "edit", "update"], icon: PenLine },
	{ keywords: ["graph", "network"], icon: Network },
	{ keywords: ["analys", "think"], icon: Brain },
	{ keywords: ["context", "knowledge", "data"], icon: Database },
	{ keywords: ["process", "execute", "run"], icon: Zap },
];

const getActionIcon = (name: string): LucideIcon => {
	const lower = name.toLowerCase();
	return (
		ICON_MAPPINGS.find(({ keywords }) =>
			keywords.some((keyword) => lower.includes(keyword)),
		)?.icon || FileText
	);
};

const translateActionName = (
	t: ReturnType<typeof useTranslation>["t"],
	actionName: string,
): string => {
	const translationKey = `actions.${actionName}`;
	const translated = t(translationKey);

	if (translated !== translationKey) {
		return translated;
	}

	return actionName.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

type ActionRenderer = (
	item: ActionItem,
	isOpen: boolean,
) => React.ReactNode | null;

const ACTION_RENDERERS: Record<string, ActionRenderer> = {
	knowledge_graph: (item, isOpen) => {
		if (!isOpen || !isKnowledgeGraphMetadata(item.metadata)) return null;
		return (
			<MessageKnowledgeGraph
				nodes={item.metadata.nodes}
				edges={item.metadata.edges}
			/>
		);
	},
};

const defaultActionRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const trimmedDesc = item.description?.trim() || "";
	if (isMermaidOnly(trimmedDesc)) {
		return (
			<TaskMermaidDiagram
				chart={extractMermaidContent(trimmedDesc)}
				isOpen={isOpen}
			/>
		);
	}

	return (
		<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
			{item.description}
		</div>
	);
};

interface ActionContentProps {
	item: ActionItem;
	isOpen: boolean;
}

const ActionContent: React.FC<ActionContentProps> = React.memo(
	({ item, isOpen }) => {
		const renderer = ACTION_RENDERERS[item.name] || defaultActionRenderer;
		return <>{renderer(item, isOpen)}</>;
	},
);

interface TaskItemRendererProps {
	item: ActionItem;
	index: number;
}

const TaskItemRenderer: React.FC<TaskItemRendererProps> = React.memo(
	({ item, index }) => {
		const { t } = useTranslation("chat");
		const [isOpen, setIsOpen] = React.useState(false);

		const Icon = useMemo(() => getActionIcon(item.name), [item.name]);
		const title = useMemo(
			() => translateActionName(t, item.name),
			[t, item.name],
		);

		return (
			<Task
				key={`${item.name}_${index}`}
				className="w-full"
				defaultOpen={false}
				onOpenChange={setIsOpen}
			>
				<TaskTrigger title={title}>
					<div className="flex items-center gap-2 w-full">
						<ChevronDown
							className={`size-4 transition-transform duration-200 ${
								isOpen ? "rotate-0" : "-rotate-90"
							}`}
						/>
						<Icon className="w-4 h-4" />
						<span className="flex-1">{title}</span>
					</div>
				</TaskTrigger>
				<TaskContent>
					<TaskItem>
						<ActionContent item={item} isOpen={isOpen} />
					</TaskItem>
				</TaskContent>
			</Task>
		);
	},
);

// Combined Message Footer Component (Actions + Metadata)
interface MessageFooterProps {
	message: DBMessage;
	groupMessages: DBMessage[];
	selectedTopic?: string;
	metadata: MessageMetadata;
}

const MessageFooter: React.FC<MessageFooterProps> = React.memo(
	({ message, groupMessages, selectedTopic, metadata }) => {
		const { t } = useTranslation("chat");
		const [copied, setCopied] = useState(false);
		const [saving, setSaving] = useState(false);
		const [saved, setSaved] = useState(false);
		const [showFullInfo, setShowFullInfo] = useState(false);

		const { model, provider, timeToAnswer, tokensPerSecond } = metadata;

		const formatTime = (seconds?: number) => {
			if (!seconds) return "-";
			if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
			return `${seconds.toFixed(2)}s`;
		};

		const formatTokensPerSecond = (tps?: number) => {
			if (!tps) return "-";
			return `${tps.toFixed(1)} t/s`;
		};

		const getProviderBadgeColor = () => {
			return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
		};

		const getModelBadgeColor = () => {
			return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
		};

		const getProviderLabel = (provider?: string) => {
			return provider || "Unknown";
		};

		const handleCopy = useCallback(async () => {
			try {
				await navigator.clipboard.writeText(message.content);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			} catch (error) {
				console.error("Failed to copy message:", error);
			}
		}, [message.content]);

		const handleSaveToRemembered = useCallback(async () => {
			if (saving) return;

			setSaving(true);
			try {
				// Format entire conversation group as dialogue
				const conversationText = groupMessages
					.filter((msg) => msg.type !== "separator" && msg.content)
					.map((msg) => {
						const role = msg.role === "user" ? "User" : "Assistant";
						return `${role}: ${msg.content}`;
					})
					.join("\n\n");

				// Generate a unique identifier for this conversation
				const conversationId = `conversation-${Date.now()}-${Math.random().toString(36).substring(7)}`;

				// Prepare the content with source info
				const sourceInfo = `Conversation from chat\nDate: ${dayjs().format("MMM D, YYYY h:mm A")}\n\n`;
				const fullContent = sourceInfo + conversationText;

				// Convert directly to knowledge using the knowledge-graph job
				const result = await backgroundJob.execute(
					"knowledge-graph",
					{
						filePath: conversationId,
						content: fullContent,
						isSpecificTextConversion: true, // Enable aggressive extraction
						topicId: selectedTopic || undefined,
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
		}, [saving, groupMessages, selectedTopic]);

		return (
			<div className="mt-3 pt-3 border-t border-border/40">
				{/* Main inline footer */}
				<div className="flex items-center justify-between gap-2 text-xs">
					{/* Left: Action buttons */}
					<div className="flex items-center gap-1">
						<button
							onClick={handleCopy}
							className="p-1.5 rounded hover:bg-accent transition-colors"
							title={
								copied
									? t("messages.copied", "Copied!")
									: t("messages.copy", "Copy message")
							}
						>
							{copied ? (
								<Check className="w-4 h-4 text-green-500" />
							) : (
								<Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
							)}
						</button>

						<button
							onClick={handleSaveToRemembered}
							className="p-1.5 rounded hover:bg-accent transition-colors"
							title={
								saved
									? t("messages.saved", "Saved!")
									: saving
										? t("messages.saving", "Saving...")
										: t("messages.remember", "Save to remembered content")
							}
							disabled={saving}
						>
							{saved ? (
								<Check className="w-4 h-4 text-green-500" />
							) : (
								<Lightbulb className="w-4 h-4 text-muted-foreground hover:text-foreground" />
							)}
						</button>
					</div>

					{/* Right: Metadata and info */}
					<div className="flex items-center gap-2">
						{/* Provider Badge */}
						{provider && (
							<div
								className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${getProviderBadgeColor()}`}
							>
								<Sparkles className="w-3 h-3" />
								<span>{getProviderLabel(provider)}</span>
							</div>
						)}

						{/* Tokens per Second */}
						{tokensPerSecond !== undefined && (
							<div className="flex items-center gap-1 text-muted-foreground">
								<Gauge className="w-3 h-3" />
								<span>{formatTokensPerSecond(tokensPerSecond)}</span>
							</div>
						)}

						{/* Toggle button */}
						<button
							onClick={() => setShowFullInfo(!showFullInfo)}
							className="p-1.5 rounded hover:bg-accent transition-colors"
							title={showFullInfo ? "Hide details" : "Show details"}
						>
							{showFullInfo ? (
								<ChevronUp className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
							) : (
								<ChevronDown className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
							)}
						</button>
					</div>
				</div>

				{/* Expanded info with animation */}
				<div
					className={`overflow-hidden transition-all duration-200 ease-in-out ${
						showFullInfo ? "max-h-20 opacity-100 mt-2" : "max-h-0 opacity-0"
					}`}
				>
					<div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-2 text-xs">
						{/* Model Name Badge */}
						{model && (
							<div
								className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${getModelBadgeColor()}`}
							>
								<Box className="w-3 h-3" />
								<span>{model}</span>
							</div>
						)}

						{/* Time to Answer */}
						{timeToAnswer !== undefined && (
							<div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 border border-border/40 text-muted-foreground">
								<Clock className="w-3 h-3" />
								<span>{formatTime(timeToAnswer)}</span>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	},
);

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

		const actions = useMemo<ActionItem[]>(() => {
			if (!message.metadata || typeof message.metadata !== "object") return [];
			if (!("actions" in message.metadata)) return [];
			if (!Array.isArray(message.metadata.actions)) return [];
			return message.metadata.actions;
		}, [message.metadata]);

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
				{actions.map((item, index) => (
					<TaskItemRenderer
						key={`${item.name}_${index}`}
						item={item}
						index={index}
					/>
				))}
				<Message key={message.id} from={message.role}>
					<MessageContent className="relative">
						{!message.content && isLastMessage && isStreaming ? (
							<div className="py-2">
								<ThreeDotsLoader className="text-muted-foreground" />
							</div>
						) : (
							<Suspense
								fallback={
									<div className="py-2">
										<ThreeDotsLoader className="text-muted-foreground" />
									</div>
								}
							>
								<div className="relative">
									<ContentComponent isStreaming={isStreaming}>
										{message.content}
									</ContentComponent>
									{isStreaming && (
										<>
											{/* Streaming indicator with three dots */}
											<div className="mt-2 flex items-center gap-2">
												<ThreeDotsLoader
													className="text-muted-foreground"
													size="sm"
												/>
											</div>
											{/* Subtle glass gradient at bottom to indicate streaming */}
											<div
												className="absolute -bottom-4 -left-6 -right-6 h-14 pointer-events-none rounded-b-lg"
												style={{
													background:
														"linear-gradient(to top, hsl(var(--background) / 0.2) 0%, hsl(var(--background) / 0.08) 50%, transparent 100%)",
													backdropFilter: "blur(1px)",
													WebkitBackdropFilter: "blur(1px)",
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
