import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { useTheme } from "@/main/components/molecules/ThemeContext";
import {
	createMarkdownComponents,
	rehypePlugins,
	remarkPlugins,
} from "./message/markdownComponents";
import { parseThinkTags } from "./message/parseThinkTags";
import { ThinkingSections } from "./message/ThinkingSections";

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
	const { actualTheme } = useTheme();
	const isDark = actualTheme === "dark";

	const { thinking, content, hasIncompleteThinking } = useMemo(() => {
		if (!children)
			return { thinking: [], content: "", hasIncompleteThinking: false };
		return parseThinkTags(children, isStreaming);
	}, [children, isStreaming]);

	const themeAwareComponents = useMemo(
		() => createMarkdownComponents({ isDark, isStreaming }),
		[isDark, isStreaming],
	);

	return (
		<div
			className={cn(
				"markdown-body",
				"[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
				className,
			)}
		>
			<ThinkingSections
				thinking={thinking}
				hasIncompleteThinking={hasIncompleteThinking}
				isStreaming={isStreaming}
				components={themeAwareComponents}
			/>

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

export const MarkdownMessage = React.memo(
	MarkdownMessageComponent,
	(prevProps, nextProps) => {
		if (prevProps.isStreaming !== nextProps.isStreaming) {
			return false;
		}

		if (prevProps.isStreaming && prevProps.children === nextProps.children) {
			return true;
		}

		return (
			prevProps.children === nextProps.children &&
			prevProps.className === nextProps.className
		);
	},
);

MarkdownMessage.displayName = "MarkdownMessage";

export default MarkdownMessage;
