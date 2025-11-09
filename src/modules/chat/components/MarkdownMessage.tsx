import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
	oneDark,
	oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { MermaidRenderer } from "@/components/atoms/MermaidRenderer";
import {
	Task,
	TaskContent,
	TaskTrigger,
	TaskItem,
} from "@/components/ui/shadcn-io/ai/task";
import { Brain, ChevronDownIcon, Network, Link2, Sparkles } from "lucide-react";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/molecules/ThemeContext";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { serviceManager } from "@/services";
import { eq } from "drizzle-orm";

// Performance optimization: Define plugins and components outside component
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];
const SEPARATE_RENDER_STREAM = false;

// Citation component with popover
interface CitationProps {
	type: "node" | "edge";
	uuid: string;
	label: string;
}

const Citation: React.FC<CitationProps> = ({ type, uuid, label }) => {
	const [open, setOpen] = useState(false);
	const [data, setData] = useState<{
		name?: string;
		summary?: string;
		nodeType?: string;
		edgeType?: string;
		factText?: string;
		sourceNode?: string;
		destNode?: string;
	} | null>(null);
	const [loading, setLoading] = useState(false);

	const loadData = async () => {
		if (data || loading) return;

		setLoading(true);
		try {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				if (type === "node") {
					const result = await db
						.select({
							name: schema.nodes.name,
							summary: schema.nodes.summary,
							nodeType: schema.nodes.nodeType,
						})
						.from(schema.nodes)
						.where(eq(schema.nodes.id, uuid))
						.limit(1);

					if (result[0]) {
						setData({
							name: result[0].name,
							summary: result[0].summary || "",
							nodeType: result[0].nodeType,
						});
					}
				} else {
					// Edge
					const result = await db
						.select({
							edgeType: schema.edges.edgeType,
							factText: schema.edges.factText,
							sourceId: schema.edges.sourceId,
							destinationId: schema.edges.destinationId,
						})
						.from(schema.edges)
						.where(eq(schema.edges.id, uuid))
						.limit(1);

					if (result[0]) {
						// Get source and destination node names
						const [sourceNode, destNode] = await Promise.all([
							db
								.select({ name: schema.nodes.name })
								.from(schema.nodes)
								.where(eq(schema.nodes.id, result[0].sourceId))
								.limit(1),
							db
								.select({ name: schema.nodes.name })
								.from(schema.nodes)
								.where(eq(schema.nodes.id, result[0].destinationId))
								.limit(1),
						]);

						setData({
							edgeType: result[0].edgeType,
							factText: result[0].factText || "",
							sourceNode: sourceNode[0]?.name,
							destNode: destNode[0]?.name,
						});
					}
				}
			});
		} catch (error) {
			console.error("Failed to load citation data:", error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					className={cn(
						"inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium",
						"transition-all duration-200",
						"hover:scale-105",
						type === "node"
							? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
							: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50",
					)}
					onClick={() => {
						if (!data && !loading) {
							loadData();
						}
					}}
				>
					{type === "node" ? (
						<Network className="w-3 h-3" />
					) : (
						<Link2 className="w-3 h-3" />
					)}
					<span>{label}</span>
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-80" align="start">
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						{type === "node" ? (
							<Network className="w-4 h-4 text-blue-600 dark:text-blue-400" />
						) : (
							<Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
						)}
						<h4 className="font-semibold text-sm">
							{type === "node" ? "Knowledge Node" : "Knowledge Edge"}
						</h4>
					</div>

					{loading ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Sparkles className="w-4 h-4 animate-spin" />
							<span>Loading...</span>
						</div>
					) : data ? (
						<div className="space-y-2">
							{type === "node" ? (
								<>
									<div>
										<div className="text-xs text-muted-foreground">Name</div>
										<div className="text-sm font-medium">{data.name}</div>
									</div>
									{data.nodeType && (
										<div>
											<div className="text-xs text-muted-foreground">Type</div>
											<div className="text-sm">{data.nodeType}</div>
										</div>
									)}
									{data.summary && (
										<div>
											<div className="text-xs text-muted-foreground">
												Summary
											</div>
											<div className="text-sm text-muted-foreground line-clamp-3">
												{data.summary}
											</div>
										</div>
									)}
								</>
							) : (
								<>
									{data.sourceNode && data.destNode && (
										<div>
											<div className="text-xs text-muted-foreground">
												Connection
											</div>
											<div className="text-sm">
												<span className="font-medium">{data.sourceNode}</span>
												<span className="text-muted-foreground mx-1">→</span>
												<span className="font-medium">{data.destNode}</span>
											</div>
										</div>
									)}
									{data.edgeType && (
										<div>
											<div className="text-xs text-muted-foreground">
												Relationship
											</div>
											<div className="text-sm font-medium">{data.edgeType}</div>
										</div>
									)}
									{data.factText && (
										<div>
											<div className="text-xs text-muted-foreground">Fact</div>
											<div className="text-sm text-muted-foreground">
												{data.factText}
											</div>
										</div>
									)}
								</>
							)}
							<div className="pt-2 border-t">
								<div className="text-xs text-muted-foreground font-mono truncate">
									ID: {uuid}
								</div>
							</div>
						</div>
					) : (
						<div className="text-sm text-muted-foreground">
							Click to load details
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};

// Parse and extract <think> tags from content
interface ParsedContent {
	thinking: string[];
	content: string;
	hasIncompleteThinking: boolean;
}

const parseThinkTags = (text: string, isAnimating: boolean): ParsedContent => {
	const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
	const thinking: string[] = [];
	let match;

	// Extract all completed thinking sections
	while ((match = thinkRegex.exec(text)) !== null) {
		thinking.push(match[1].trim());
	}

	// Remove completed think tags from content
	let content = text.replace(thinkRegex, "");

	// Check for incomplete thinking tag (only when animating)
	let hasIncompleteThinking = false;
	if (isAnimating) {
		const incompleteMatch = content.match(/<think>([\s\S]*?)$/);
		if (incompleteMatch) {
			hasIncompleteThinking = true;
			// Add incomplete thinking to the beginning of thinking array
			thinking.unshift(incompleteMatch[1].trim());
			// Remove the incomplete think tag from content
			content = content.replace(/<think>([\s\S]*?)$/, "").trim();
		}
	}

	content = content.trim();

	return { thinking, content, hasIncompleteThinking };
};

const markdownComponents = {
	// Custom components for better styling
	table: ({ children, ...props }: { children?: React.ReactNode }) => (
		<div className="overflow-x-auto rounded">
			<table
				className="w-full"
				style={{ borderCollapse: "separate", borderSpacing: 0 }}
				{...props}
			>
				{children}
			</table>
		</div>
	),
	th: ({ children, ...props }: { children?: React.ReactNode }) => (
		<th
			className="border border-gray-700 dark:border-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 text-left font-semibold first:rounded-tl last:rounded-tr first:border-l last:border-r border-t"
			{...props}
		>
			{children}
		</th>
	),
	tbody: ({ children, ...props }: { children?: React.ReactNode }) => (
		<tbody {...props}>{children}</tbody>
	),
	tr: ({ children, ...props }: { children?: React.ReactNode }) => (
		<tr {...props}>{children}</tr>
	),
	td: ({ children, ...props }: { children?: React.ReactNode }) => (
		<td
			className="border-b border-gray-700 dark:border-gray-300 px-2 py-1 first:border-l last:border-r [tr:last-child_&]:first:rounded-bl [tr:last-child_&]:last:rounded-br"
			{...props}
		>
			{children}
		</td>
	),
	pre: ({ children, ...props }: { children?: React.ReactNode }) => (
		<pre className="overflow-x-auto" {...props}>
			{children}
		</pre>
	),
	// Style other elements
	blockquote: ({ children, ...props }: { children?: React.ReactNode }) => (
		<blockquote
			className="border-l-2 border-gray-700 dark:border-gray-300 pl-2 italic opacity-80 text-sm"
			{...props}
		>
			{children}
		</blockquote>
	),
	hr: ({ ...props }) => (
		<hr className="border-gray-700 dark:border-gray-300" {...props} />
	),
	// Custom link renderer to handle citations
	a: ({
		href,
		children,
		...props
	}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
		children?: React.ReactNode;
	}) => {
		// Check if this is a citation link
		// Format: #citations:node/{uuid} or #citation:edge/{uuid}
		if (
			href &&
			(href.startsWith("#citations:node/") ||
				href.startsWith("#citation:edge/"))
		) {
			const isNode = href.startsWith("#citations:node/");
			const uuid = isNode
				? href.replace("#citations:node/", "")
				: href.replace("#citation:edge/", "");
			const label = String(children || "");

			return (
				<Citation type={isNode ? "node" : "edge"} uuid={uuid} label={label} />
			);
		}

		// Regular link
		return (
			<a
				href={href}
				className="text-blue-600 dark:text-blue-400 hover:underline"
				target="_blank"
				rel="noopener noreferrer"
				{...props}
			>
				{children}
			</a>
		);
	},
};

// Lightweight components for animating state - no syntax highlighting or mermaid
const animatingComponents = {
	...markdownComponents,
	code: ({ children, className, ...props }: any) => {
		const match = /language-(\w+)/.exec(className || "");
		const isInline = !match;

		if (isInline) {
			return (
				<code
					className="rounded bg-gray-200 dark:bg-gray-700 px-0.5 text-xs font-mono"
					{...props}
				>
					{children}
				</code>
			);
		}

		// For code blocks while animating, just show plain pre/code without highlighting
		return (
			<pre className="rounded-md text-sm bg-gray-100 dark:bg-gray-800 p-4 overflow-x-auto">
				<code className="font-mono text-xs">{children}</code>
			</pre>
		);
	},
	// Citations are shown even while animating
	a: markdownComponents.a,
};

interface MarkdownMessageProps {
	className?: string;
	isStreaming?: boolean;
	children?: string;
}

const MarkdownMessageComponent: React.FC<MarkdownMessageProps> = ({
	className,
	children,
	isStreaming = false,
}) => {
	const { t } = useTranslation("chat");
	const { actualTheme } = useTheme();
	const isDark = actualTheme === "dark";

	// Parse thinking tags from content
	const { thinking, content, hasIncompleteThinking } = useMemo(() => {
		if (!children)
			return { thinking: [], content: "", hasIncompleteThinking: false };
		return parseThinkTags(children, isStreaming);
	}, [children, isStreaming]);

	// Create theme-aware markdown components with useMemo to avoid recreating on every render
	const themeAwareComponents = useMemo(() => {
		// If animating, use lightweight components
		if (isStreaming && SEPARATE_RENDER_STREAM) {
			return animatingComponents;
		}

		// Full components with syntax highlighting and mermaid
		return {
			...markdownComponents,
			code: ({ children, className, ...props }: any) => {
				const match = /language-(\w+)/.exec(className || "");
				const language = match ? match[1] : "";
				const isInline = !match;

				if (isInline) {
					return (
						<code
							className="rounded bg-gray-200 dark:bg-gray-700 px-0.5 text-xs font-mono"
							{...props}
						>
							{children}
						</code>
					);
				}

				// Handle mermaid diagrams
				if (language === "mermaid") {
					const chartContent = String(children).replace(/\n$/, "");
					return <MermaidRenderer chart={chartContent} />;
				}

				// Use syntax highlighter for code blocks with theme-aware styling
				return (
					<SyntaxHighlighter
						style={isDark ? oneDark : oneLight}
						language={language}
						PreTag="div"
						className="rounded-md text-sm"
						customStyle={{
							margin: 0,
							padding: "1rem",
							backgroundColor: isDark ? "hsl(220 13% 18%)" : "hsl(210 40% 98%)",
						}}
						{...props}
					>
						{String(children).replace(/\n$/, "")}
					</SyntaxHighlighter>
				);
			},
		};
	}, [isDark, isStreaming]);

	return (
		<div
			className={cn(
				"markdown-body",
				"[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className,
			)}
		>
			{/* Render thinking sections if present */}
			{thinking.length > 0 && (
				<div className="mb-4 space-y-2">
					{thinking.map((thinkContent, index) => {
						// First item is incomplete if hasIncompleteThinking is true
						const isIncomplete = hasIncompleteThinking && index === 0;
						const isThinking = isStreaming && isIncomplete;

						return (
							<Task key={index} defaultOpen={isIncomplete}>
								<TaskTrigger
									title={
										isThinking ? t("messages.thinking") : t("messages.thought")
									}
								>
									<div className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground">
										<Brain className="size-4" />
										<p className="text-sm">
											{isThinking
												? t("messages.thinking")
												: t("messages.thought")}
										</p>
										<ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
									</div>
								</TaskTrigger>
								<TaskContent>
									<TaskItem>
										<ReactMarkdown
											remarkPlugins={remarkPlugins}
											rehypePlugins={rehypePlugins}
											components={themeAwareComponents}
										>
											{thinkContent}
										</ReactMarkdown>
									</TaskItem>
								</TaskContent>
							</Task>
						);
					})}
				</div>
			)}

			{/* Render main content */}
			<ReactMarkdown
				remarkPlugins={remarkPlugins}
				rehypePlugins={rehypePlugins}
				components={themeAwareComponents}
			>
				{content || ""}
			</ReactMarkdown>
		</div>
	);
};

// Memoize component with custom comparison
export const MarkdownMessage = React.memo(
	MarkdownMessageComponent,
	(prevProps, nextProps) => {
		// If animating state changes, always re-render
		if (prevProps.isStreaming !== nextProps.isStreaming) {
			return false;
		}

		// If animating is true and children are the same, skip re-render
		if (prevProps.isStreaming && prevProps.children === nextProps.children) {
			return true;
		}

		// For non-animating state, re-render if children or className changed
		return (
			prevProps.children === nextProps.children &&
			prevProps.className === nextProps.className
		);
	},
);

MarkdownMessage.displayName = "MarkdownMessage";

export default MarkdownMessage;
