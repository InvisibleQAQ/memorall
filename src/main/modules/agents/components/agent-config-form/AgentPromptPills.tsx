import React from "react";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/main/components/ui/hover-card";
import { CursorPoint } from "@/components/AgentCursor";
import { AGENT_WIZARD_CURSOR_KEYS } from "@/main/modules/agent-wizard";
import type { AgentConfigSummary } from "../../types";

const PromptPill: React.FC<{
	label: string;
	value: string;
	preview: string;
}> = ({ label, value, preview }) => (
	<HoverCard openDelay={120} closeDelay={60}>
		<HoverCardTrigger asChild>
			<button
				type="button"
				className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
			>
				<FileText size={11} />
				<span>
					{label} · {value}
				</span>
			</button>
		</HoverCardTrigger>
		<HoverCardContent
			align="start"
			className="w-[min(42rem,calc(100vw-2rem))] p-3"
		>
			<div className="space-y-2">
				<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
					{label}
				</p>
				<pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed text-foreground">
					{preview}
				</pre>
			</div>
		</HoverCardContent>
	</HoverCard>
);

export const AgentPromptPills: React.FC<{
	configSummary?: AgentConfigSummary | null;
}> = ({ configSummary }) => {
	const { t } = useTranslation("agents");

	return (
		<CursorPoint
			cursorKey={AGENT_WIZARD_CURSOR_KEYS.contextPrompt}
			className="flex flex-wrap gap-2"
		>
			<PromptPill
				label={t("summary.systemPrompt")}
				value={
					configSummary
						? t("summary.systemPromptValue", {
								count: configSummary.systemPromptLength,
								mode: configSummary.hasCustomSystemPrompt
									? t("summary.custom")
									: t("summary.default"),
							})
						: t("state.loading")
				}
				preview={configSummary?.systemPromptPreview ?? t("state.loading")}
			/>
			<PromptPill
				label={t("summary.contextPrompt")}
				value={
					configSummary
						? t("summary.contextPromptValue", {
								count: configSummary.contextPromptLength,
								mode: configSummary.hasCustomContextPrompt
									? t("summary.custom")
									: t("summary.default"),
							})
						: t("state.loading")
				}
				preview={configSummary?.contextPromptPreview ?? t("state.loading")}
			/>
		</CursorPoint>
	);
};
