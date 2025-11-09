import React, { useRef, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
	Loader2,
	Network,
	FileText,
	GitBranch,
	Search,
	Sparkles,
	ChevronDown,
	PenLine,
	Database,
	Brain,
	Zap,
} from "lucide-react";
import { Message, MessageContent } from "@/components/ui/shadcn-io/ai/message";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/components/ui/shadcn-io/ai/task";
import { MermaidRenderer } from "@/components/atoms/MermaidRenderer";
import { MessageKnowledgeGraph } from "./MessageKnowledgeGraph";
import type { Message as DBMessage } from "@/services/database";
import dayjs from "dayjs";

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

// Type guard for knowledge graph metadata
function isKnowledgeGraphMetadata(
	metadata: Record<string, unknown> | undefined
): metadata is KnowledgeGraphMetadata {
	if (!metadata) return false;

	const hasNodes = Array.isArray(metadata.nodes) &&
		metadata.nodes.every((node: unknown): node is KnowledgeGraphMetadata['nodes'][number] =>
			typeof node === 'object' &&
			node !== null &&
			'id' in node &&
			'nodeType' in node &&
			'name' in node &&
			typeof node.id === 'string' &&
			typeof node.nodeType === 'string' &&
			typeof node.name === 'string'
		);

	const hasEdges = Array.isArray(metadata.edges) &&
		metadata.edges.every((edge: unknown): edge is KnowledgeGraphMetadata['edges'][number] =>
			typeof edge === 'object' &&
			edge !== null &&
			'id' in edge &&
			'sourceId' in edge &&
			'destinationId' in edge &&
			'edgeType' in edge &&
			typeof edge.id === 'string' &&
			typeof edge.sourceId === 'string' &&
			typeof edge.destinationId === 'string' &&
			typeof edge.edgeType === 'string'
		);

	return hasNodes && hasEdges;
}

const ICON_MAPPINGS = [
	{ keywords: ['search', 'query', 'retrieval', 'retrieve'], icon: Search },
	{ keywords: ['generat', 'create'], icon: Sparkles },
	{ keywords: ['write', 'edit', 'update'], icon: PenLine },
	{ keywords: ['graph', 'network'], icon: Network },
	{ keywords: ['analys', 'think'], icon: Brain },
	{ keywords: ['context', 'knowledge', 'data'], icon: Database },
	{ keywords: ['process', 'execute', 'run'], icon: Zap },
];

const getActionIcon = (name: string) => {
	const lower = name.toLowerCase();
	const Icon = ICON_MAPPINGS.find(({ keywords }) =>
		keywords.some(keyword => lower.includes(keyword))
	)?.icon || FileText;

	return <Icon className="w-4 h-4" />;
};

const useTranslateActionName = () => {
	const { t } = useTranslation("chat");

	return (actionName: string): string => {
		const translationKey = `actions.${actionName}`;
		const translated = t(translationKey);

		if (translated !== translationKey) {
			return translated;
		}

		return actionName.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
	};
};

type ActionRenderer = (item: ActionItem, isOpen: boolean) => React.ReactNode | null;

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

const ActionContent: React.FC<ActionContentProps> = ({ item, isOpen }) => {
	const renderer = ACTION_RENDERERS[item.name] || defaultActionRenderer;
	return <>{renderer(item, isOpen)}</>;
};

interface TaskItemRendererProps {
	item: ActionItem;
	index: number;
}

const TaskItemRenderer: React.FC<TaskItemRendererProps> = React.memo(
	({ item, index }) => {
		const translateActionName = useTranslateActionName();
		const [isOpen, setIsOpen] = React.useState(false);

		const icon = getActionIcon(item.name);

		console.log('TaskItemRenderer>>>>>>>>>>>>>>>>>')

		return (
			<Task
				key={`${item.name}_${index}`}
				className="w-full"
				defaultOpen={false}
				onOpenChange={setIsOpen}
			>
				<TaskTrigger title={translateActionName(item.name)}>
					<div className="flex items-center gap-2 w-full">
						<ChevronDown
							className={`size-4 transition-transform duration-200 ${
								isOpen ? "rotate-0" : "-rotate-90"
							}`}
						/>
						{icon}
						<span className="flex-1">{translateActionName(item.name)}</span>
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

interface MessageRendererProps {
	message: DBMessage;
	index: number;
	isLastMessage: boolean;
	isStreaming: boolean;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({
	message,
	isLastMessage,
	isStreaming,
}) => {
	if (message.type === "separator") {
		return (
			<div key={message.id} className="my-4 flex items-center">
				<div className="flex-1 border-t border-gray-300"></div>
				<div className="mx-4 text-xs text-gray-500 font-medium">
					{dayjs(message.createdAt).format("MMM D, YYYY h:mm A")}
				</div>
				<div className="flex-1 border-t border-gray-300"></div>
			</div>
		);
	}

	const actions: ActionItem[] =
		message.metadata &&
		typeof message.metadata === "object" &&
		"actions" in message.metadata &&
		message.metadata?.actions &&
		Array.isArray(message.metadata.actions)
			? message.metadata.actions
			: [];

	return (
		<div key={message.id} className="flex flex-col gap-4">
			{actions?.map((item, index) => (
				<TaskItemRenderer
					key={`${item.name}_${index}`}
					item={item}
					index={index}
				/>
			)) || []}
			<Message key={message.id} from={message.role}>
				<MessageContent>
					{!message.content && isLastMessage && isStreaming ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<Suspense fallback={<Loader2 className="w-4 h-4 animate-spin" />}>
							<>
								<ContentComponent isStreaming={false}>
									{message.content}
								</ContentComponent>
								{isStreaming ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : undefined}
							</>
						</Suspense>
					)}
				</MessageContent>
			</Message>
		</div>
	);
};
