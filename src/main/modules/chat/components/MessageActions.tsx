import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	Network,
	FileText,
	Search,
	Sparkles,
	ChevronDown,
	PenLine,
	Database,
	Brain,
	Zap,
	Globe,
	TerminalSquare,
	Target,
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
	planner_create: plannerToolRenderer,
	planner_get: plannerToolRenderer,
	planner_check_item: plannerToolRenderer,
	planner_add_item: plannerToolRenderer,
	planner_remove_item: plannerToolRenderer,
};

interface ActionContentProps {
	item: MessageActionItem;
	isOpen: boolean;
}

const ActionContent: React.FC<ActionContentProps> = React.memo(
	({ item, isOpen }) => {
		const renderer = ACTION_RENDERERS[item.name] || defaultActionRenderer;
		return <>{renderer(item, isOpen)}</>;
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
						<ActionContent item={item} isOpen={isOpen} />
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
