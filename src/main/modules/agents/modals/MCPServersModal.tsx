import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useTranslation } from "react-i18next";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import { MCPServersEditor } from "../components/MCPServersEditor";

export const MCPServersModal = NiceModal.create(() => {
	const modal = useModal();
	const { t } = useTranslation(["agents"]);
	const { draftMCPServers, setMCPServers } = useAgentConfigStore();

	return (
		<Dialog open={modal.visible} onOpenChange={(open) => !open && modal.hide()}>
			<DialogContent className="flex max-h-[min(90dvh,760px)] w-[calc(100vw-1rem)] max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 p-0 shadow-2xl sm:w-[min(94vw,760px)]">
				<DialogHeader className="border-b px-5 pb-4 pt-5">
					<DialogTitle className="text-base">
						{t("mcps.manageTitle")}
					</DialogTitle>
				</DialogHeader>
				<div className="flex-1 overflow-y-auto px-5 py-4">
					<MCPServersEditor
						servers={draftMCPServers}
						onChange={setMCPServers}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
});
