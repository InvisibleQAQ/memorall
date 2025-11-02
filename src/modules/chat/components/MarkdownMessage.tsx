import React, { useEffect, useMemo } from "react";
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
import { Brain, ChevronDownIcon } from "lucide-react";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

// Performance optimization: Define plugins and components outside component
const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

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
};

interface MarkdownMessageProps {
	className?: string;
	isAnimating?: boolean;
	children?: string;
}

// Hook to detect theme
const useTheme = () => {
	const [isDark, setIsDark] = React.useState(false);

	useEffect(() => {
		const checkTheme = () => {
			setIsDark(document.documentElement.classList.contains("dark"));
		};

		checkTheme();
		const observer = new MutationObserver(checkTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	return isDark;
};

const MarkdownMessageComponent: React.FC<MarkdownMessageProps> = ({
	className,
	children,
	isAnimating = false,
}) => {
	const { t } = useTranslation("chat");
	const isDark = useTheme();

	// Parse thinking tags from content
	const { thinking, content, hasIncompleteThinking } = useMemo(() => {
		if (!children)
			return { thinking: [], content: "", hasIncompleteThinking: false };
		return parseThinkTags(children, isAnimating);
	}, [children, isAnimating]);

	// Create theme-aware markdown components with useMemo to avoid recreating on every render
	const themeAwareComponents = useMemo(() => {
		// If animating, use lightweight components
		if (isAnimating) {
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
	}, [isDark, isAnimating]);

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
						const isThinking = isAnimating && isIncomplete;

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
		if (prevProps.isAnimating !== nextProps.isAnimating) {
			return false;
		}

		// If animating is true and children are the same, skip re-render
		if (prevProps.isAnimating && prevProps.children === nextProps.children) {
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
