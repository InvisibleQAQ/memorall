import React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { Brain, ChevronDownIcon } from "lucide-react";
import {
	Task,
	TaskContent,
	TaskItem,
	TaskTrigger,
} from "@/main/components/ui/shadcn-io/ai/task";
import { rehypePlugins, remarkPlugins } from "./markdownComponents";

interface ThinkingSectionsProps {
	thinking: string[];
	hasIncompleteThinking: boolean;
	isStreaming: boolean;
	components: any;
}

export const ThinkingSections: React.FC<ThinkingSectionsProps> = ({
	thinking,
	hasIncompleteThinking,
	isStreaming,
	components,
}) => {
	const { t } = useTranslation("chat");

	if (thinking.length === 0) return null;

	return (
		<div className="mb-4 space-y-2">
			{thinking.map((thinkContent, index) => {
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
									{isThinking ? t("messages.thinking") : t("messages.thought")}
								</p>
								<ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
							</div>
						</TaskTrigger>
						<TaskContent>
							<TaskItem>
								<ReactMarkdown
									remarkPlugins={remarkPlugins}
									rehypePlugins={rehypePlugins}
									components={components}
								>
									{thinkContent}
								</ReactMarkdown>
							</TaskItem>
						</TaskContent>
					</Task>
				);
			})}
		</div>
	);
};
