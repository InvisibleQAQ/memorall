import React, { useState } from "react";
import { RefreshCw, Server, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/main/components/ui/popover";
import { useRuntimeSessionsStore } from "@/main/stores/runtime-sessions";
import { buildRuntimeSummaryLabel } from "./utils";
import { RuntimeSessionsSectionList } from "./RuntimeSessionsSectionList";

export const RuntimeSessionsPopover: React.FC = () => {
	const commands = useRuntimeSessionsStore((state) => state.commands);
	const servers = useRuntimeSessionsStore((state) => state.servers);
	const activeWebSession = useRuntimeSessionsStore(
		(state) => state.activeWebSession,
	);
	const refreshRuntimeSessions = useRuntimeSessionsStore(
		(state) => state.refresh,
	);
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const hasWebSession = Boolean(activeWebSession.isOpen);
	const itemCount = commands.length + servers.length + Number(hasWebSession);
	const summaryLabel = buildRuntimeSummaryLabel(
		t,
		commands.length,
		servers.length,
		hasWebSession,
	);

	if (itemCount === 0) {
		return null;
	}

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) void refreshRuntimeSessions();
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					title={summaryLabel}
					aria-label={summaryLabel}
					className="relative inline-flex h-9 w-9 items-center justify-center rounded-md p-2 text-sm font-medium text-muted-foreground transition-all duration-200 ease-in-out hover:bg-muted/50 hover:text-foreground"
				>
					<Server size={16} />
					<span className="absolute -right-1 -top-1 inline-flex p-1 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground min-w-4 h-4">
						{itemCount > 9 ? "9+" : itemCount}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-screen max-h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border/70 bg-background p-0 shadow-xl"
			>
				<div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2.5">
					<div className="min-w-0 flex flex-1 items-center gap-2">
						<Server size={14} className="shrink-0 text-muted-foreground" />
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold text-foreground">
								{t("sandboxPanel.title")}
							</p>
							<p className="truncate text-[11px] text-muted-foreground">
								{summaryLabel}
							</p>
						</div>
					</div>
					<button
						type="button"
						title={t("sandboxPanel.refresh")}
						onClick={() => void refreshRuntimeSessions()}
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<RefreshCw size={14} />
					</button>
					<button
						type="button"
						title="Close"
						onClick={() => setOpen(false)}
						className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<X size={14} />
					</button>
				</div>
				<div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-3">
					<RuntimeSessionsSectionList
						commands={commands}
						servers={servers}
						activeWebSession={activeWebSession}
						onRefresh={refreshRuntimeSessions}
						variant="compact"
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
};
