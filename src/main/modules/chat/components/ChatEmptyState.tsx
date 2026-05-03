"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Sparkles } from "lucide-react";
import {
	AgentIcon,
	type AgentGreetingContext,
	type AgentScreenContent,
} from "@/components/AgentIcon";

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

	return (
		<div className="flex min-h-[calc(100vh-15rem)] flex-1 flex-col items-center justify-center gap-5 py-12">
			<AgentIcon
				size={132}
				aria-label="Agent"
				ambientScreenContent={screenContent}
				autoGreeting
				greetingContext={greetingContext}
			/>
			{showAgentBuilderCallout ? (
				<button
					type="button"
					onClick={onOpenAgentWizard}
					className="group w-full max-w-md rounded-lg border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-left shadow-[0_10px_30px_rgba(59,130,246,0.08)] transition-colors hover:border-blue-500/45 hover:bg-blue-500/15"
				>
					<span className="flex items-start gap-3">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-500/15 text-blue-500">
							<Sparkles size={18} />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block text-sm font-semibold text-foreground">
								{t("agentBuilderCallout.title")}
							</span>
							<span className="mt-1 block text-xs leading-5 text-muted-foreground">
								{t("agentBuilderCallout.description")}
							</span>
						</span>
						<ArrowRight
							size={16}
							className="mt-1 shrink-0 text-blue-500 transition-transform group-hover:translate-x-0.5"
						/>
					</span>
				</button>
			) : null}
		</div>
	);
};
