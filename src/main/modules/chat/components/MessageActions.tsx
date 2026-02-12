import React, { useMemo, useRef } from "react";
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
	type LucideIcon,
} from "lucide-react";

import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/main/components/ui/shadcn-io/ai/task";
import { MermaidRenderer } from "@/main/components/atoms/MermaidRenderer";
import { MessageKnowledgeGraph } from "./MessageKnowledgeGraph";

export interface MessageActionItem {
	name: string;
	description: string;
	metadata?: Record<string, unknown>;
}

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

interface WebAccessPayload {
	url: string;
	requestedUrl?: string;
	html?: string;
	status?: number;
	ok?: boolean;
	contentType?: string;
}

interface ApiResultPayload {
	url: string;
	method?: string;
	path?: string;
	status?: number;
	ok?: boolean;
	contentType?: string;
	responseType?: string;
	body?: string;
}

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

function isKnowledgeGraphMetadata(
	metadata: Record<string, unknown> | undefined,
): metadata is KnowledgeGraphMetadata {
	if (!metadata) {
		return false;
	}

	let hasNodes = false;
	if (Array.isArray(metadata.nodes)) {
		const invalidNodes = metadata.nodes.filter((node: unknown) => {
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
			return !Object.values(checks).every(Boolean);
		});
		hasNodes = invalidNodes.length === 0;
	}

	let hasEdges = false;
	if (Array.isArray(metadata.edges)) {
		const invalidEdges = metadata.edges.filter((edge: unknown) => {
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
			return !Object.values(checks).every(Boolean);
		});
		hasEdges = invalidEdges.length === 0;
	}

	return hasNodes && hasEdges;
}

const ICON_MAPPINGS: Array<{ keywords: string[]; icon: LucideIcon }> = [
	{ keywords: ["search", "query", "retrieval", "retrieve"], icon: Search },
	{ keywords: ["web", "url", "browser", "html"], icon: Globe },
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
	item: MessageActionItem,
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isHttpUrl = (value: string): boolean => {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
};

const normalizePreviewUrl = (rawUrl: string): string => {
	try {
		const parsed = new URL(rawUrl);
		if (parsed.hostname === "0.0.0.0" || parsed.hostname === "::") {
			parsed.hostname = "127.0.0.1";
		}
		return parsed.toString();
	} catch {
		return rawUrl;
	}
};

const extractWebAccessPayload = (
	item: MessageActionItem,
): WebAccessPayload | null => {
	const fromMetadata = item.metadata;
	if (fromMetadata && typeof fromMetadata.url === "string") {
		return {
			requestedUrl:
				typeof fromMetadata.requestedUrl === "string"
					? fromMetadata.requestedUrl
					: undefined,
			url: fromMetadata.url,
			html:
				typeof fromMetadata.html === "string" ? fromMetadata.html : undefined,
			status:
				typeof fromMetadata.status === "number"
					? fromMetadata.status
					: undefined,
			ok: typeof fromMetadata.ok === "boolean" ? fromMetadata.ok : undefined,
			contentType:
				typeof fromMetadata.contentType === "string"
					? fromMetadata.contentType
					: undefined,
		};
	}

	try {
		const parsed = JSON.parse(item.description);
		if (!isRecord(parsed) || typeof parsed.url !== "string") {
			return null;
		}
		return {
			requestedUrl:
				typeof parsed.requestedUrl === "string"
					? parsed.requestedUrl
					: undefined,
			url: parsed.url,
			html: typeof parsed.html === "string" ? parsed.html : undefined,
			status: typeof parsed.status === "number" ? parsed.status : undefined,
			ok: typeof parsed.ok === "boolean" ? parsed.ok : undefined,
			contentType:
				typeof parsed.contentType === "string" ? parsed.contentType : undefined,
		};
	} catch {
		return null;
	}
};

const extractApiResultPayload = (
	item: MessageActionItem,
): ApiResultPayload | null => {
	const fromMetadata = item.metadata;
	if (fromMetadata && typeof fromMetadata.url === "string") {
		return {
			url: fromMetadata.url,
			method:
				typeof fromMetadata.method === "string"
					? fromMetadata.method
					: undefined,
			path:
				typeof fromMetadata.path === "string" ? fromMetadata.path : undefined,
			status:
				typeof fromMetadata.status === "number"
					? fromMetadata.status
					: undefined,
			ok: typeof fromMetadata.ok === "boolean" ? fromMetadata.ok : undefined,
			contentType:
				typeof fromMetadata.contentType === "string"
					? fromMetadata.contentType
					: undefined,
			responseType:
				typeof fromMetadata.responseType === "string"
					? fromMetadata.responseType
					: undefined,
			body:
				typeof fromMetadata.body === "string" ? fromMetadata.body : undefined,
		};
	}

	try {
		const parsed = JSON.parse(item.description);
		if (!isRecord(parsed) || typeof parsed.url !== "string") {
			return null;
		}
		return {
			url: parsed.url,
			method: typeof parsed.method === "string" ? parsed.method : undefined,
			path: typeof parsed.path === "string" ? parsed.path : undefined,
			status: typeof parsed.status === "number" ? parsed.status : undefined,
			ok: typeof parsed.ok === "boolean" ? parsed.ok : undefined,
			contentType:
				typeof parsed.contentType === "string" ? parsed.contentType : undefined,
			responseType:
				typeof parsed.responseType === "string"
					? parsed.responseType
					: undefined,
			body: typeof parsed.body === "string" ? parsed.body : undefined,
		};
	} catch {
		return null;
	}
};

const WebAccessPreview: React.FC<{ payload: WebAccessPayload }> = ({
	payload,
}) => {
	const { t } = useTranslation("chat");
	const previewUrl = normalizePreviewUrl(payload.url);
	const canFrameUrl = isHttpUrl(previewUrl);
	const htmlPreview = payload.html?.trim() || "";

	return (
		<div className="w-full rounded-lg border border-border/60 overflow-hidden bg-background">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
				<Globe className="w-4 h-4 text-muted-foreground shrink-0" />
				<div className="flex-1 text-xs font-mono truncate">{previewUrl}</div>
				{typeof payload.status === "number" ? (
					<span
						className={`text-[10px] px-1.5 py-0.5 rounded border ${
							payload.ok
								? "text-green-600 border-green-600/30 bg-green-600/10"
								: "text-red-600 border-red-600/30 bg-red-600/10"
						}`}
					>
						{payload.status}
					</span>
				) : null}
			</div>
			{canFrameUrl ? (
				<iframe
					title={t("actions.webAccess.iframeTitle", {
						defaultValue: "Web access preview: {{url}}",
						url: payload.url,
					})}
					src={previewUrl}
					className="w-full h-[360px] bg-white"
					sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
					referrerPolicy="no-referrer"
				/>
			) : htmlPreview ? (
				<iframe
					title={t("actions.webAccess.htmlIframeTitle", {
						defaultValue: "Web access HTML preview",
					})}
					srcDoc={htmlPreview}
					className="w-full h-[360px] bg-white"
					sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
				/>
			) : (
				<div className="px-3 py-4 text-sm text-muted-foreground">
					{t("actions.webAccess.emptyPreview", {
						defaultValue: "No renderable URL/HTML found for web preview.",
					})}
				</div>
			)}
			{htmlPreview ? (
				<details className="border-t border-border/60">
					<summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
						{t("actions.webAccess.htmlSourcePreview", {
							defaultValue: "HTML source preview",
						})}
					</summary>
					<pre className="max-h-64 overflow-auto p-3 text-xs whitespace-pre-wrap break-all bg-muted/20 border-t border-border/60">
						{htmlPreview}
					</pre>
				</details>
			) : null}
		</div>
	);
};

const webAccessRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;
	const payload = extractWebAccessPayload(item);
	if (!payload) {
		return (
			<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
				{item.description}
			</div>
		);
	}
	return <WebAccessPreview payload={payload} />;
};

ACTION_RENDERERS["container_web_access"] = webAccessRenderer;
ACTION_RENDERERS["web_access"] = webAccessRenderer;
ACTION_RENDERERS["web access"] = webAccessRenderer;
ACTION_RENDERERS["container_render_server"] = webAccessRenderer;

const ApiResultPreview: React.FC<{ payload: ApiResultPayload }> = ({
	payload,
}) => {
	const { t } = useTranslation("chat");

	return (
		<div className="w-full rounded-lg border border-border/60 overflow-hidden bg-background">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30 text-xs">
				<Database className="w-4 h-4 text-muted-foreground shrink-0" />
				<span className="font-mono">{payload.method ?? "GET"}</span>
				<span className="font-mono truncate">
					{payload.path ?? payload.url}
				</span>
				{typeof payload.status === "number" ? (
					<span
						className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
							payload.ok
								? "text-green-600 border-green-600/30 bg-green-600/10"
								: "text-red-600 border-red-600/30 bg-red-600/10"
						}`}
					>
						{payload.status}
					</span>
				) : null}
			</div>
			<div className="px-3 py-2 text-xs text-muted-foreground border-b border-border/60">
				<div className="font-mono break-all">{payload.url}</div>
				{payload.contentType ? (
					<div>
						{t("actions.apiResult.contentType", {
							defaultValue: "content-type",
						})}
						: {payload.contentType}
					</div>
				) : null}
				{payload.responseType ? (
					<div>
						{t("actions.apiResult.responseType", {
							defaultValue: "response-type",
						})}
						: {payload.responseType}
					</div>
				) : null}
			</div>
			<pre className="max-h-72 overflow-auto p-3 text-xs whitespace-pre-wrap break-all bg-muted/20">
				{payload.body ||
					t("actions.apiResult.emptyBody", { defaultValue: "(empty body)" })}
			</pre>
		</div>
	);
};

const apiResultRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;
	const payload = extractApiResultPayload(item);
	if (!payload) {
		return (
			<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
				{item.description}
			</div>
		);
	}
	return <ApiResultPreview payload={payload} />;
};

ACTION_RENDERERS["sandbox_api_result"] = apiResultRenderer;
ACTION_RENDERERS["container_request_server"] = apiResultRenderer;

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
