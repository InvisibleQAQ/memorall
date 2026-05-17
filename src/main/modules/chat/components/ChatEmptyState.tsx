"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Brain, Database, Sparkles, Wrench } from "lucide-react";
import {
	AgentIcon,
	type AgentGreetingContext,
	type AgentScreenContent,
} from "@/components/AgentIcon";
import { cn } from "@/lib/utils";

interface ChatEmptyStateProps {
	screenContent?: AgentScreenContent;
	greetingContext: AgentGreetingContext;
	showAgentBuilderCallout: boolean;
	onOpenAgentWizard: () => void;
	compact?: boolean;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
	screenContent,
	greetingContext,
	showAgentBuilderCallout,
	onOpenAgentWizard,
	compact = false,
}) => {
	const { t } = useTranslation(["chat"]);
	const calloutHighlights = [
		{
			label: t("agentBuilderCallout.memory", "Memory"),
			icon: Database,
			className: "text-sky-200/90",
		},
		{
			label: t("agentBuilderCallout.tools", "Tools"),
			icon: Wrench,
			className: "text-blue-200/90",
		},
		{
			label: t("agentBuilderCallout.behavior", "Behavior"),
			icon: Brain,
			className: "text-indigo-200/90",
		},
	];
	const agentBuilderPrompt = t(
		"agentBuilderCallout.agentPrompt",
		"Create an agent for the work you want to solve?",
	);

	return (
		<div
			className={cn(
				"flex flex-1 flex-col items-center justify-center",
				compact
					? "min-h-0 justify-center gap-4 py-2"
					: "min-h-[calc(100vh-18rem)] gap-7 py-12",
			)}
		>
			<AgentIcon
				size={compact ? 110 : 132}
				aria-label="Agent"
				ambientScreenContent={screenContent}
				autoGreeting={!showAgentBuilderCallout}
				speechBubble={
					showAgentBuilderCallout && !compact
						? {
								message: agentBuilderPrompt,
								tone: "thinking",
								placement: "top",
								variant: "manga",
							}
						: undefined
				}
				greetingContext={greetingContext}
			/>
			{showAgentBuilderCallout ? (
				<button
					type="button"
					onClick={onOpenAgentWizard}
					className={cn(
						"group relative w-full overflow-hidden border border-sky-400/20 bg-[linear-gradient(135deg,hsl(var(--card)/0.98),hsl(214_42%_12%/0.72))] p-[1px] text-left shadow-[0_18px_60px_rgba(0,0,0,0.24),0_0_42px_rgba(56,189,248,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-300/35 hover:bg-card hover:shadow-[0_22px_70px_rgba(0,0,0,0.28),0_0_52px_rgba(56,189,248,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						compact ? "max-w-md rounded-xl" : "max-w-xl rounded-2xl",
					)}
				>
					<span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.65),transparent)]" />
					<span
						className={cn(
							"relative flex",
							compact
								? "gap-3 rounded-[calc(0.75rem-1px)] px-3.5 py-3"
								: "gap-4 rounded-[calc(1rem-1px)] px-5 py-4 sm:px-6 sm:py-5",
						)}
					>
						<span
							className={cn(
								"mt-0.5 flex shrink-0 items-center justify-center border border-sky-300/20 bg-sky-300/10 text-sky-100 shadow-inner shadow-white/5 transition duration-200 group-hover:scale-105 group-hover:bg-sky-300/15 group-hover:text-white",
								compact ? "h-9 w-9 rounded-lg" : "h-12 w-12 rounded-xl",
							)}
						>
							<Sparkles size={compact ? 17 : 22} />
						</span>
						<span
							className={cn(
								"min-w-0 flex-1",
								compact ? "space-y-2" : "space-y-3",
							)}
						>
							<span
								className={cn(
									"block font-semibold text-foreground",
									compact ? "text-sm leading-5" : "text-base leading-6",
								)}
							>
								{t("agentBuilderCallout.title")}
							</span>
							<span
								className={cn(
									"block max-w-md text-muted-foreground",
									compact
										? "overflow-hidden text-xs leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]"
										: "text-sm leading-6",
								)}
							>
								{t("agentBuilderCallout.description")}
							</span>
							<span
								className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}
							>
								{calloutHighlights.map((item) => {
									const Icon = item.icon;
									return (
										<span
											key={item.label}
											className={cn(
												"inline-flex items-center gap-1.5 rounded-full border border-sky-300/15 bg-sky-300/[0.06] font-medium text-muted-foreground",
												compact
													? "px-2 py-0.5 text-[11px]"
													: "px-2.5 py-1 text-xs",
											)}
										>
											<Icon
												size={compact ? 12 : 13}
												className={item.className}
											/>
											{item.label}
										</span>
									);
								})}
							</span>
						</span>
						<span
							className={cn(
								"flex shrink-0 items-center justify-center rounded-full border border-sky-300/20 bg-sky-300/10 text-sky-100 transition duration-200 group-hover:translate-x-1 group-hover:bg-sky-300/15 group-hover:text-white",
								compact ? "h-8 w-8" : "h-9 w-9",
							)}
						>
							<ArrowRight size={compact ? 15 : 17} />
						</span>
					</span>
				</button>
			) : null}
		</div>
	);
};
