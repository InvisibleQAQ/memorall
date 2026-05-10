import React from "react";
import { Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RuntimeSessionsSectionList } from "@/main/components/molecules/RuntimeSessions/RuntimeSessionsSectionList";
import { useRuntimeSessionsStore } from "@/main/stores/runtime-sessions";

export const RuntimePage: React.FC = () => {
	const { t } = useTranslation();
	const commands = useRuntimeSessionsStore((state) => state.commands);
	const servers = useRuntimeSessionsStore((state) => state.servers);
	const activeWebSession = useRuntimeSessionsStore(
		(state) => state.activeWebSession,
	);
	const refreshRuntimeSessions = useRuntimeSessionsStore(
		(state) => state.refresh,
	);
	const hasRuntime =
		commands.length > 0 || servers.length > 0 || activeWebSession.isOpen;

	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<div className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-4">
				<Server size={18} className="text-muted-foreground" />
				<div>
					<h1 className="text-lg font-semibold">{t("sandboxPanel.title")}</h1>
					<p className="text-sm text-muted-foreground">
						{t("sandboxPanel.description", {
							defaultValue: "Web sessions, servers, and running commands.",
						})}
					</p>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-4">
				{hasRuntime ? (
					<RuntimeSessionsSectionList
						commands={commands}
						servers={servers}
						activeWebSession={activeWebSession}
						onRefresh={refreshRuntimeSessions}
						variant="docked"
					/>
				) : (
					<div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/70 text-sm text-muted-foreground">
						{t("sandboxPanel.empty", {
							defaultValue: "No active runtime sessions",
						})}
					</div>
				)}
			</div>
		</div>
	);
};
