import React, { useState } from "react";
import { Loader2, Power } from "lucide-react";
import { useTranslation } from "react-i18next";
import { serviceManager } from "@/services";
import type { SandboxCommandInfo } from "./types";
import { ActionIconButton, CommandStatusBadge } from "./SharedComponents";
import { formatSessionTime, getCommandStatusLabel } from "./utils";

export const CommandCard: React.FC<{
	command: SandboxCommandInfo;
	onChanged: () => void | Promise<void>;
}> = ({ command, onChanged }) => {
	const { t } = useTranslation();
	const [isStopping, setIsStopping] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const handleStop = async () => {
		setIsStopping(true);
		setActionError(null);
		try {
			await serviceManager
				.getSandboxContainerService()
				.stopCommand({ commandId: command.commandId });
			void onChanged();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsStopping(false);
		}
	};

	const startedAt = formatSessionTime(command.startedAt);
	const updatedAt = formatSessionTime(command.updatedAt);

	return (
		<div className="overflow-hidden rounded-md border border-border">
			<div className="flex items-start gap-2 bg-muted/20 px-2 py-2">
				<CommandStatusBadge
					status={command.status}
					label={getCommandStatusLabel(t, command.status)}
				/>
				<div className="min-w-0 flex-1">
					<div
						className="truncate font-mono text-xs text-foreground"
						title={command.command}
					>
						{command.command}
					</div>
					<div
						className="truncate text-[10px] text-muted-foreground"
						title={command.cwd}
					>
						{`${t("sandboxPanel.commandCwd")}: ${command.cwd}`}
					</div>
				</div>
				<ActionIconButton
					title={t("sandboxPanel.stopCommand")}
					onClick={() => void handleStop()}
					disabled={isStopping}
					variant="danger"
					icon={
						isStopping ? (
							<Loader2 size={14} className="animate-spin" />
						) : (
							<Power size={14} />
						)
					}
				/>
			</div>
			<div className="space-y-2 p-2">
				<div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
					{startedAt ? (
						<span>{`${t("sandboxPanel.commandStarted")}: ${startedAt}`}</span>
					) : null}
					{updatedAt ? (
						<span>{`${t("sandboxPanel.commandLastActivity")}: ${updatedAt}`}</span>
					) : null}
				</div>
				{command.outputTail ? (
					<div className="space-y-1">
						<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							{t("sandboxPanel.commandOutputPreview")}
						</div>
						<pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
							{command.outputTail}
						</pre>
					</div>
				) : null}
				{actionError ? (
					<div className="rounded border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
						{actionError}
					</div>
				) : null}
			</div>
		</div>
	);
};
