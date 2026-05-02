import React from "react";
import { useTranslation } from "react-i18next";
import { CursorPoint } from "@/components/AgentCursor";
import { AGENT_WIZARD_CURSOR_KEYS } from "@/main/modules/agent-wizard";
import { MCPServersSection } from "../MCPServersSection";
import { AgentCronJobsSection } from "../AgentCronJobsSection";
import type { AgentPresetDraft } from "../../types";
import type { AgentCronJobFormState } from "./types";

const SkillsSection = React.lazy(() =>
	import("../SkillsSection").then((module) => ({
		default: module.SkillsSection,
	})),
);

export const AgentIntegrationsSection: React.FC<{
	metadataDraft?: AgentPresetDraft;
	cronJobs?: AgentCronJobFormState;
}> = ({ metadataDraft, cronJobs }) => {
	const { t } = useTranslation("agents");

	return (
		<div className="space-y-1.5">
			<React.Suspense
				fallback={
					<div className="flex min-h-[32px] items-center gap-3">
						<span className="w-20 shrink-0 text-sm text-muted-foreground">
							{t("skills.label")}
						</span>
						<span className="text-[11px] text-muted-foreground/50">…</span>
					</div>
				}
			>
				<SkillsSection />
			</React.Suspense>
			<MCPServersSection />
			{metadataDraft && cronJobs ? (
				<CursorPoint cursorKey={AGENT_WIZARD_CURSOR_KEYS.cronJobs}>
					<AgentCronJobsSection
						agentStatus={metadataDraft.status}
						drafts={cronJobs.drafts}
						isLoading={cronJobs.isLoading}
						isSaving={cronJobs.isSaving}
						error={cronJobs.error}
						onAdd={cronJobs.onAdd}
						onUpdate={cronJobs.onUpdate}
						onRemove={cronJobs.onRemove}
					/>
				</CursorPoint>
			) : null}
		</div>
	);
};
