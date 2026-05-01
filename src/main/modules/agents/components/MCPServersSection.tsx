import React from "react";
import NiceModal from "@ebay/nice-modal-react";
import { useTranslation } from "react-i18next";
import { Plug, Plus } from "lucide-react";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import { MCPServersModal } from "../modals/MCPServersModal";
import { CursorPoint } from "@/components/AgentCursor";
import { AGENT_WIZARD_CURSOR_KEYS } from "@/main/modules/agent-wizard";

export const MCPServersSection: React.FC = () => {
	const { t } = useTranslation(["agents"]);
	const draftMCPServers = useAgentConfigStore((state) => state.draftMCPServers);

	const openMCPServersModal = () => {
		void NiceModal.show(MCPServersModal);
	};

	return (
		<CursorPoint
			cursorKey={AGENT_WIZARD_CURSOR_KEYS.mcpServers}
			className="flex min-h-[32px] items-center gap-3"
		>
			<span className="w-12 shrink-0 text-sm text-muted-foreground">
				{t("mcps.label")}
			</span>
			<div className="flex flex-wrap items-center gap-1.5">
				{draftMCPServers.map((server) => (
					<button
						key={server.name}
						type="button"
						onClick={openMCPServersModal}
						className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
					>
						<Plug size={10} className="text-muted-foreground" />
						<span className="font-mono">{server.name}</span>
					</button>
				))}
				<button
					type="button"
					onClick={openMCPServersModal}
					className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<Plus size={12} />
					{t("mcps.manage")}
				</button>
			</div>
		</CursorPoint>
	);
};
