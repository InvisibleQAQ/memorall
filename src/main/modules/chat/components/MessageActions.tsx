import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	Network,
	FileText,
	Search,
	Sparkles,
	ChevronDown,
	AlertTriangle,
	PenLine,
	Database,
	Brain,
	Zap,
	Globe,
	TerminalSquare,
	Target,
	Clock3,
	ScrollText,
	Bot,
	MousePointer2,
	MousePointerClick,
	Eye,
	Keyboard,
	type LucideIcon,
} from "lucide-react";

import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/main/components/ui/shadcn-io/ai/task";
import type { MessageActionItem } from "./types";
import { webAccessRenderer } from "./tools/WebAccess";
import { apiResultRenderer } from "./tools/APIResult";
import { defaultActionRenderer } from "./tools/DefaultActionRenderer";
import { webReadRenderer } from "./tools/WebRead";
import { webOpenRenderer } from "./tools/WebOpen";
import { webDomRenderer } from "./tools/WebDom";
import { webSearchRenderer } from "./tools/WebSearch";
import { fsActionRenderer } from "./tools/FileSystem";
import { terminalToolRenderer } from "./tools/TerminalTool";
import { plannerToolRenderer } from "./tools/PlannerTool";
import { ToolItemRawIO } from "./tools/ToolCommon";
import {
	messageKnowledgeGraphRenderer,
	structMemKnowledgeRetrievalRenderer,
} from "./tools/MessageKnowledgeGraph";
import {
	currentTimeToolRenderer,
	loadSkillToolRenderer,
	sendMessageToAgentToolRenderer,
} from "./tools/UtilityAgentTools";
import {
	coAgentToolRenderer,
	getCoAgentActionTitle,
} from "./tools/CoAgentTool";

const ICON_MAPPINGS: Array<{ keywords: string[]; icon: LucideIcon }> = [
	{ keywords: ["search", "query", "retrieval", "retrieve"], icon: Search },
	{ keywords: ["web", "url", "browser", "html"], icon: Globe },
	{ keywords: ["command", "terminal", "shell"], icon: TerminalSquare },
	{ keywords: ["generat", "create"], icon: Sparkles },
	{ keywords: ["write", "edit", "update"], icon: PenLine },
	{ keywords: ["plan", "planner"], icon: Target },
	{ keywords: ["graph", "network"], icon: Network },
	{ keywords: ["analys", "think"], icon: Brain },
	{ keywords: ["context", "knowledge", "data"], icon: Database },
	{ keywords: ["process", "execute", "run"], icon: Zap },
];

const EXACT_ICON_MAPPINGS: Record<string, LucideIcon> = {
	current_time: Clock3,
	load_skill: ScrollText,
	send_message_to_agent: Bot,
	co_agent_query: Search,
	co_agent_observe: Eye,
	co_agent_move: MousePointer2,
	co_agent_scroll: ScrollText,
	co_agent_click: MousePointerClick,
	co_agent_input: Keyboard,
	co_agent_error: AlertTriangle,
};

const getActionIcon = (name: string): LucideIcon => {
	const exact = EXACT_ICON_MAPPINGS[name];
	if (exact) {
		return exact;
	}

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

	const coAgentTitle = getCoAgentActionTitle(actionName);
	if (coAgentTitle) {
		return coAgentTitle;
	}

	return actionName.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

type ActionRenderer = (
	item: MessageActionItem,
	isOpen: boolean,
) => React.ReactNode | null;

const ACTION_RENDERERS: Record<string, ActionRenderer> = {
	container_web_access: webAccessRenderer,
	web_access: webAccessRenderer,
	web_read: webReadRenderer,
	container_web_read: webReadRenderer,
	"web access": webAccessRenderer,
	container_render_server: webAccessRenderer,
	web_open: webOpenRenderer,
	web_dom_action: webDomRenderer,
	web_find_in_page: defaultActionRenderer,
	"web find in page": defaultActionRenderer,
	web_search: webSearchRenderer,
	"web search": webSearchRenderer,
	sandbox_api_result: apiResultRenderer,
	container_request_server: apiResultRenderer,
	container_execute_command: terminalToolRenderer,
	container_listen_command: terminalToolRenderer,
	container_list_commands: terminalToolRenderer,
	fs_read: fsActionRenderer,
	fs_write: fsActionRenderer,
	fs_edit: fsActionRenderer,
	fs_ls: fsActionRenderer,
	fs_glob: fsActionRenderer,
	fs_grep: fsActionRenderer,
	fs_mkdir: fsActionRenderer,
	fs_remove: fsActionRenderer,
	web_screenshot: defaultActionRenderer,
	planner_create: plannerToolRenderer,
	planner_get: plannerToolRenderer,
	planner_check_item: plannerToolRenderer,
	planner_add_item: plannerToolRenderer,
	planner_remove_item: plannerToolRenderer,
	current_time: currentTimeToolRenderer,
	load_skill: loadSkillToolRenderer,
	send_message_to_agent: sendMessageToAgentToolRenderer,
	co_agent_query: coAgentToolRenderer,
	co_agent_observe: coAgentToolRenderer,
	co_agent_move: coAgentToolRenderer,
	co_agent_scroll: coAgentToolRenderer,
	co_agent_click: coAgentToolRenderer,
	co_agent_input: coAgentToolRenderer,
	co_agent_error: coAgentToolRenderer,
	knowledge_graph: messageKnowledgeGraphRenderer,
	structmem_knowledge_retrieval: structMemKnowledgeRetrievalRenderer,
};

interface ActionContentProps {
	item: MessageActionItem;
	isOpen: boolean;
}

const ActionRenderFallback: React.FC<{
	item: MessageActionItem;
	error?: Error | null;
}> = ({ item, error }) => {
	const description = item.description?.trim() || "";

	return (
		<div className="space-y-3">
			<div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
				<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
				<div className="min-w-0">
					<div className="font-medium">Renderer fallback</div>
					<div className="text-xs break-words text-amber-800/90 dark:text-amber-100/90">
						Failed to render this tool output. Showing raw content instead.
						{error?.message ? ` ${error.message}` : ""}
					</div>
				</div>
			</div>
			{description ? (
				<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
					{item.description}
				</div>
			) : null}
			<ToolItemRawIO item={item} />
		</div>
	);
};

class ActionRenderErrorBoundary extends React.Component<
	{ children: React.ReactNode; item: MessageActionItem },
	{ error: Error | null }
> {
	constructor(props: { children: React.ReactNode; item: MessageActionItem }) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
		// The fallback UI handles renderer failures locally for the chat action pane.
	}

	componentDidUpdate(
		prevProps: Readonly<{ children: React.ReactNode; item: MessageActionItem }>,
	) {
		if (
			this.state.error &&
			(prevProps.item.name !== this.props.item.name ||
				prevProps.item.description !== this.props.item.description ||
				prevProps.item.metadata !== this.props.item.metadata)
		) {
			this.setState({ error: null });
		}
	}

	render() {
		if (this.state.error) {
			return (
				<ActionRenderFallback item={this.props.item} error={this.state.error} />
			);
		}

		return this.props.children;
	}
}

const ActionContent: React.FC<ActionContentProps> = React.memo(
	({ item, isOpen }) => {
		const renderer = ACTION_RENDERERS[item.name] || defaultActionRenderer;
		try {
			return <>{renderer(item, isOpen)}</>;
		} catch (error) {
			return (
				<ActionRenderFallback
					item={item}
					error={error instanceof Error ? error : new Error(String(error))}
				/>
			);
		}
	},
);

interface TaskItemRendererProps {
	item: MessageActionItem;
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
						<ActionRenderErrorBoundary item={item}>
							<ActionContent item={item} isOpen={isOpen} />
						</ActionRenderErrorBoundary>
					</TaskItem>
				</TaskContent>
			</Task>
		);
	},
);

interface MessageActionsProps {
	actions: MessageActionItem[];
}

export const MessageActions: React.FC<MessageActionsProps> = React.memo(
	({ actions }) => {
		if (actions.length === 0) return null;

		return (
			<>
				{actions.map((item, index) => (
					<TaskItemRenderer
						key={`${item.name}_${index}`}
						item={item}
						index={index}
					/>
				))}
			</>
		);
	},
);
