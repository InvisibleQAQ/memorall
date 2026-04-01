import React from "react";
import {
	Check,
	Copy,
	LoaderCircle,
	TerminalSquare,
	XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
	ActionRenderer,
	MessageActionItem,
} from "@/main/modules/chat/components/types";
import { defaultActionRenderer } from "./DefaultActionRenderer";
import { getToolCallArguments, ToolItemRawIO } from "./ToolCommon";

type CommandStatus = "running" | "completed" | "failed" | "stopped";

interface CommandExecutionPayload {
	commandId?: string;
	command?: string;
	cwd?: string;
	status?: CommandStatus;
	completed?: boolean;
	offset?: number;
	exitCode?: number;
	started?: string;
	updated?: string;
	stdout?: string;
	stderr?: string;
}

interface CommandListEntry {
	commandId?: string;
	command?: string;
	cwd?: string;
	status?: CommandStatus;
	offset?: number;
	updated?: string;
	tail?: string;
}

const OUTPUT_MARKER = /\r?\noutput:\r?\n/;
const COPY_RESET_DELAY_MS = 1200;

const parseBoolean = (value?: string): boolean | undefined => {
	if (value === "true") return true;
	if (value === "false") return false;
	return undefined;
};

const parseNumber = (value?: string): number | undefined => {
	if (!value) return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

const parseTokenLine = (line: string): Record<string, string> => {
	const result: Record<string, string> = {};
	for (const token of line.trim().split(/\s+/)) {
		const separatorIndex = token.indexOf("=");
		if (separatorIndex <= 0) {
			continue;
		}

		const key = token.slice(0, separatorIndex);
		const value = token.slice(separatorIndex + 1);
		if (key) {
			result[key] = value;
		}
	}
	return result;
};

const extractOutputSection = (description: string): string => {
	const parts = description.split(OUTPUT_MARKER);
	if (parts.length < 2) {
		return description.trim();
	}
	return parts.slice(1).join("\noutput:\n").trim();
};

const parseCommandExecutionOutput = (
	output: string,
	args: Record<string, unknown> | null,
): CommandExecutionPayload | null => {
	const lines = output.split(/\r?\n/);
	const firstLine = lines[0]?.trim();
	if (
		!firstLine ||
		!firstLine.includes("id=") ||
		!firstLine.includes("status=")
	) {
		return null;
	}

	const summary = parseTokenLine(firstLine);
	const payload: CommandExecutionPayload = {
		commandId: summary.id,
		status: (summary.status as CommandStatus | undefined) ?? undefined,
		completed: parseBoolean(summary.completed),
		offset: parseNumber(summary.offset),
		exitCode: parseNumber(summary.exit),
		command:
			typeof args?.command === "string"
				? args.command
				: typeof args?.input === "string"
					? args.input
					: undefined,
		cwd: typeof args?.cwd === "string" ? args.cwd : undefined,
		stdout: "",
		stderr: "",
	};

	let activeSection: "stdout" | "stderr" | null = null;
	const stdoutLines: string[] = [];
	const stderrLines: string[] = [];

	for (const rawLine of lines.slice(1)) {
		const line = rawLine ?? "";
		if (line === "stdout:") {
			activeSection = "stdout";
			continue;
		}
		if (line === "stderr:") {
			activeSection = "stderr";
			continue;
		}
		if (line.startsWith("command=")) {
			payload.command = line.slice("command=".length);
			continue;
		}
		if (line.startsWith("cwd=")) {
			payload.cwd = line.slice("cwd=".length);
			continue;
		}
		if (line.startsWith("started=")) {
			payload.started = line.slice("started=".length);
			continue;
		}
		if (line.startsWith("updated=")) {
			payload.updated = line.slice("updated=".length);
			continue;
		}

		if (activeSection === "stdout") {
			stdoutLines.push(line);
		} else if (activeSection === "stderr") {
			stderrLines.push(line);
		}
	}

	payload.stdout = stdoutLines.join("\n").trimEnd();
	payload.stderr = stderrLines.join("\n").trimEnd();
	return payload;
};

const parseCommandListOutput = (output: string): CommandListEntry[] | null => {
	if (!output || output === "No running commands.") {
		return [];
	}

	const blocks = output
		.trim()
		.split(/\r?\n\r?\n+/)
		.map((block) => block.trim())
		.filter(Boolean);
	if (blocks.length === 0) {
		return [];
	}

	const entries = blocks
		.map((block) => {
			const lines = block.split(/\r?\n/);
			const summary = parseTokenLine(lines[0] ?? "");
			if (!summary.id) {
				return null;
			}

			const entry: CommandListEntry = {
				commandId: summary.id,
				status: (summary.status as CommandStatus | undefined) ?? undefined,
				offset: parseNumber(summary.offset),
			};

			let collectingTail = false;
			const tailLines: string[] = [];

			for (const rawLine of lines.slice(1)) {
				const line = rawLine ?? "";
				if (line === "tail:") {
					collectingTail = true;
					continue;
				}
				if (line.startsWith("cwd=")) {
					entry.cwd = line.slice("cwd=".length);
					continue;
				}
				if (line.startsWith("updated=")) {
					entry.updated = line.slice("updated=".length);
					continue;
				}
				if (line.startsWith("command=")) {
					entry.command = line.slice("command=".length);
					continue;
				}
				if (collectingTail) {
					tailLines.push(line);
				}
			}

			entry.tail = tailLines.join("\n").trimEnd();
			return entry;
		})
		.filter((value): value is CommandListEntry => value !== null);

	return entries.length > 0 ? entries : null;
};

const formatTime = (value?: string): string | null => {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
};

const STATUS_BADGE_CLASSES: Record<CommandStatus, string> = {
	running: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
	completed: "border-sky-500/30 bg-sky-500/10 text-sky-300",
	failed: "border-red-500/30 bg-red-500/10 text-red-300",
	stopped: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

const renderStatusIcon = (status?: CommandStatus) => {
	if (status === "running") {
		return <LoaderCircle className="h-3.5 w-3.5 animate-spin" />;
	}
	if (status === "failed") {
		return <XCircle className="h-3.5 w-3.5" />;
	}
	return <Check className="h-3.5 w-3.5" />;
};

const TerminalCopyButton: React.FC<{ value: string }> = ({ value }) => {
	const [copied, setCopied] = React.useState(false);

	const handleCopy = async () => {
		if (!value || !navigator.clipboard?.writeText) {
			return;
		}

		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), COPY_RESET_DELAY_MS);
		} catch {
			setCopied(false);
		}
	};

	return (
		<button
			type="button"
			onClick={() => void handleCopy()}
			className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-900/70 px-2 text-[11px] text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
		>
			{copied ? (
				<Check className="h-3.5 w-3.5" />
			) : (
				<Copy className="h-3.5 w-3.5" />
			)}
			<span>{copied ? "Copied" : "Copy"}</span>
		</button>
	);
};

const TerminalStreamBlock: React.FC<{
	label: string;
	value?: string;
	tone?: "default" | "danger";
	emptyLabel: string;
}> = ({ label, value, tone = "default", emptyLabel }) => {
	const text = value?.trimEnd() ?? "";
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between gap-2">
				<div
					className={cn(
						"text-[11px] font-semibold uppercase tracking-[0.16em]",
						tone === "danger" ? "text-red-300" : "text-zinc-400",
					)}
				>
					{label}
				</div>
				{text ? <TerminalCopyButton value={text} /> : null}
			</div>
			<pre
				className={cn(
					"max-h-80 overflow-auto rounded-lg border p-3 text-xs whitespace-pre-wrap break-words font-mono",
					tone === "danger"
						? "border-red-500/20 bg-red-950/20 text-red-100"
						: "border-zinc-800 bg-zinc-950/80 text-zinc-100",
				)}
			>
				{text || emptyLabel}
			</pre>
		</div>
	);
};

const TerminalExecutionPreview: React.FC<{
	payload: CommandExecutionPayload;
	toolName: string;
}> = ({ payload, toolName }) => {
	const started = formatTime(payload.started);
	const updated = formatTime(payload.updated);
	const commandLine =
		payload.command ||
		(toolName === "container_listen_command"
			? `listen ${payload.commandId ?? ""}`
			: "command");
	const combinedOutput = [payload.stdout, payload.stderr]
		.filter((value) => typeof value === "string" && value.length > 0)
		.join("\n\n");

	return (
		<div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
			<div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/90 px-3 py-2">
				<div className="flex items-center gap-1.5">
					<span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
					<span className="h-2.5 w-2.5 rounded-full bg-amber-300/90" />
					<span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
				</div>
				<div className="flex min-w-0 flex-1 items-center gap-2 text-zinc-100">
					<TerminalSquare className="h-4 w-4 shrink-0 text-zinc-400" />
					<div className="min-w-0">
						<div className="truncate font-mono text-xs">{commandLine}</div>
						{payload.cwd ? (
							<div className="truncate text-[11px] text-zinc-400">
								{payload.cwd}
							</div>
						) : null}
					</div>
				</div>
				{combinedOutput ? <TerminalCopyButton value={combinedOutput} /> : null}
				{payload.status ? (
					<div
						className={cn(
							"inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
							STATUS_BADGE_CLASSES[payload.status],
						)}
					>
						{renderStatusIcon(payload.status)}
						<span>{payload.status}</span>
					</div>
				) : null}
			</div>
			<div className="space-y-3 p-3">
				<div className="grid gap-2 text-[11px] text-zinc-400 sm:grid-cols-2">
					{payload.commandId ? (
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
							<div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
								Command ID
							</div>
							<div className="break-all font-mono text-zinc-200">
								{payload.commandId}
							</div>
						</div>
					) : null}
					{typeof payload.offset === "number" ? (
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
							<div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
								Offset
							</div>
							<div className="font-mono text-zinc-200">{payload.offset}</div>
						</div>
					) : null}
					{typeof payload.exitCode === "number" ? (
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
							<div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
								Exit Code
							</div>
							<div className="font-mono text-zinc-200">{payload.exitCode}</div>
						</div>
					) : null}
					{started ? (
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
							<div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
								Started
							</div>
							<div className="font-mono text-zinc-200">{started}</div>
						</div>
					) : null}
					{updated ? (
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
							<div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
								Updated
							</div>
							<div className="font-mono text-zinc-200">{updated}</div>
						</div>
					) : null}
					{typeof payload.completed === "boolean" ? (
						<div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
							<div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
								Completed
							</div>
							<div className="font-mono text-zinc-200">
								{payload.completed ? "true" : "false"}
							</div>
						</div>
					) : null}
				</div>
				<TerminalStreamBlock
					label="stdout"
					value={payload.stdout}
					emptyLabel="(no stdout)"
				/>
				{payload.stderr ? (
					<TerminalStreamBlock
						label="stderr"
						value={payload.stderr}
						tone="danger"
						emptyLabel="(no stderr)"
					/>
				) : null}
			</div>
		</div>
	);
};

const TerminalListPreview: React.FC<{ entries: CommandListEntry[] }> = ({
	entries,
}) => {
	return (
		<div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
			<div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/90 px-3 py-2 text-zinc-100">
				<TerminalSquare className="h-4 w-4 text-zinc-400" />
				<div className="text-xs font-semibold">Running Commands</div>
			</div>
			<div className="space-y-3 p-3">
				{entries.length === 0 ? (
					<pre className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-xs font-mono text-zinc-400">
						No running commands.
					</pre>
				) : (
					entries.map((entry, index) => (
						<div
							key={entry.commandId ?? `${entry.command ?? "command"}-${index}`}
							className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
						>
							<div className="mb-2 flex items-start gap-2">
								<div className="min-w-0 flex-1">
									<div className="truncate font-mono text-xs text-zinc-100">
										{entry.command || entry.commandId || "command"}
									</div>
									{entry.cwd ? (
										<div className="truncate text-[11px] text-zinc-400">
											{entry.cwd}
										</div>
									) : null}
								</div>
								{entry.status ? (
									<div
										className={cn(
											"inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
											STATUS_BADGE_CLASSES[entry.status],
										)}
									>
										{renderStatusIcon(entry.status)}
										<span>{entry.status}</span>
									</div>
								) : null}
							</div>
							<div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
								{entry.commandId ? (
									<span className="font-mono">{entry.commandId}</span>
								) : null}
								{typeof entry.offset === "number" ? (
									<span className="font-mono">{`offset ${entry.offset}`}</span>
								) : null}
								{entry.updated ? (
									<span className="font-mono">{formatTime(entry.updated)}</span>
								) : null}
							</div>
							{entry.tail ? (
								<pre className="max-h-56 overflow-auto rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-xs whitespace-pre-wrap break-words font-mono text-zinc-100">
									{entry.tail}
								</pre>
							) : null}
						</div>
					))
				)}
			</div>
		</div>
	);
};

const TerminalFallback: React.FC<{
	item: MessageActionItem;
	output: string;
}> = ({ item, output }) => (
	<div className="space-y-3">
		<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
			{item.description}
		</div>
		<ToolItemRawIO item={item} output={output} />
	</div>
);

export const terminalToolRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const args = getToolCallArguments(item);
	const output = extractOutputSection(item.description);

	if (item.name === "container_list_commands") {
		const listEntries = parseCommandListOutput(output);
		if (listEntries) {
			return (
				<div className="space-y-3">
					<TerminalListPreview entries={listEntries} />
					<ToolItemRawIO item={item} output={output} />
				</div>
			);
		}
		return <TerminalFallback item={item} output={output} />;
	}

	if (
		item.name === "container_execute_command" ||
		item.name === "container_listen_command"
	) {
		const executionPayload = parseCommandExecutionOutput(output, args);
		if (executionPayload) {
			return (
				<div className="space-y-3">
					<TerminalExecutionPreview
						payload={executionPayload}
						toolName={item.name}
					/>
					<ToolItemRawIO item={item} output={output} />
				</div>
			);
		}
	}

	if (!output || output === item.description) {
		return defaultActionRenderer(item, isOpen);
	}

	return <TerminalFallback item={item} output={output} />;
};
