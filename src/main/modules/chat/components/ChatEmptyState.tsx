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
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({
	screenContent,
	greetingContext,
	showAgentBuilderCallout,
	onOpenAgentWizard,
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
		<div className="flex min-h-[calc(100vh-18rem)] flex-1 flex-col items-center justify-center gap-7 py-12">
			<AgentIcon
				size={132}
				aria-label="Agent"
				ambientScreenContent={screenContent}
				autoGreeting={!showAgentBuilderCallout}
				speechBubble={
					showAgentBuilderCallout
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
					className="group relative w-full max-w-xl overflow-hidden rounded-2xl border border-sky-400/20 bg-[linear-gradient(135deg,hsl(var(--card)/0.98),hsl(214_42%_12%/0.72))] p-[1px] text-left shadow-[0_18px_60px_rgba(0,0,0,0.24),0_0_42px_rgba(56,189,248,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-300/35 hover:bg-card hover:shadow-[0_22px_70px_rgba(0,0,0,0.28),0_0_52px_rgba(56,189,248,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.65),transparent)]" />
					<span className="relative flex gap-4 rounded-[calc(1rem-1px)] px-5 py-4 sm:px-6 sm:py-5">
						<span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-100 shadow-inner shadow-white/5 transition duration-200 group-hover:scale-105 group-hover:bg-sky-300/15 group-hover:text-white">
							<Sparkles size={22} />
						</span>
						<span className="min-w-0 flex-1 space-y-3">
							<span className="block text-base font-semibold leading-6 text-foreground">
								{t("agentBuilderCallout.title")}
							</span>
							<span className="block max-w-md text-sm leading-6 text-muted-foreground">
								{t("agentBuilderCallout.description")}
							</span>
							<span className="flex flex-wrap gap-2">
								{calloutHighlights.map((item) => {
									const Icon = item.icon;
									return (
										<span
											key={item.label}
											className={cn(
												"inline-flex items-center gap-1.5 rounded-full border border-sky-300/15 bg-sky-300/[0.06] px-2.5 py-1 text-xs font-medium text-muted-foreground",
											)}
										>
											<Icon size={13} className={item.className} />
											{item.label}
										</span>
									);
								})}
							</span>
						</span>
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300/20 bg-sky-300/10 text-sky-100 transition duration-200 group-hover:translate-x-1 group-hover:bg-sky-300/15 group-hover:text-white">
							<ArrowRight size={17} />
						</span>
					</span>
				</button>
			) : null}
		</div>
	);
};
