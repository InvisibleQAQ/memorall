import React, { useState } from "react";
import { Check, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemorallToolCallPayload {
	name?: string;
	args?: unknown;
	status?: string;
	notes?: unknown;
}

const TOOL_CALL_LABELS: Record<string, string> = {
	update_agent_name: "Update name",
	update_agent_description: "Update description",
	add_agent_skills: "Add skills",
	remove_agent_skills: "Remove skills",
	install_agent_skill: "Install skill",
	enable_agent_feature: "Enable feature",
	disable_agent_feature: "Disable feature",
	update_agent_instruction: "Update instructions",
	update_agent_grow_type: "Update grow type",
	update_agent_recall_type: "Update recall type",
};

const humanizeToolName = (name: string): string =>
	TOOL_CALL_LABELS[name] ??
	name
		.replace(/^update_agent_/, "Update ")
		.replace(/^enable_agent_/, "Enable ")
		.replace(/^disable_agent_/, "Disable ")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const formatToolArgValue = (value: unknown): string => {
	if (Array.isArray(value)) {
		return value.map(formatToolArgValue).join(", ");
	}
	if (isRecord(value)) {
		return Object.entries(value)
			.map(([key, item]) => `${key}: ${formatToolArgValue(item)}`)
			.join("; ");
	}
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (value == null) return "";
	return JSON.stringify(value);
};

const getToolCallSummaryItems = (
	args: unknown,
): Array<{ label: string; value: string }> => {
	if (!isRecord(args)) return [];
	return Object.entries(args)
		.map(([key, value]) => ({
			label: key
				.replace(/([A-Z])/g, " $1")
				.replace(/_/g, " ")
				.replace(/\b\w/g, (letter) => letter.toUpperCase()),
			value: formatToolArgValue(value),
		}))
		.filter((item) => item.value.trim().length > 0)
		.slice(0, 4);
};

export const MemorallToolCallCard: React.FC<{ code: string }> = React.memo(
	({ code }) => {
		const [expanded, setExpanded] = useState(false);
		let payload: MemorallToolCallPayload | null = null;
		let parseFailed = false;

		try {
			payload = JSON.parse(code) as MemorallToolCallPayload;
		} catch {
			parseFailed = true;
		}

		if (!payload || parseFailed) {
			return (
				<div className="my-2 rounded-lg border border-border bg-muted/30 p-3">
					<div className="flex items-center gap-2 text-sm font-medium">
						<Wrench className="h-4 w-4 text-muted-foreground" />
						Agent draft update
					</div>
					<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
						{code}
					</pre>
				</div>
			);
		}

		const name = payload.name ?? "agent_tool_call";
		const summaryItems = getToolCallSummaryItems(payload.args);
		const status = payload.status ?? "applied";
		const isApplied = status === "applied";

		return (
			<div className="my-2 overflow-hidden rounded-lg border border-border/70 bg-muted/25">
				<div className="flex items-start gap-3 px-3 py-2.5">
					<div
						className={cn(
							"mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
							isApplied
								? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
								: "bg-muted text-muted-foreground",
						)}
					>
						{isApplied ? (
							<Check className="h-4 w-4" />
						) : (
							<Wrench className="h-4 w-4" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-sm font-medium leading-5">
								{humanizeToolName(name)}
							</p>
							<span
								className={cn(
									"rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
									isApplied
										? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
										: "bg-muted text-muted-foreground",
								)}
							>
								{status}
							</span>
						</div>
						{summaryItems.length > 0 ? (
							<div className="mt-1.5 grid gap-1">
								{summaryItems.map((item) => (
									<div
										key={item.label}
										className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-xs"
									>
										<span className="text-muted-foreground">{item.label}</span>
										<span
											className="truncate text-foreground/90"
											title={item.value}
										>
											{item.value}
										</span>
									</div>
								))}
							</div>
						) : null}
					</div>
					<button
						type="button"
						onClick={() => setExpanded((value) => !value)}
						className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						{expanded ? "Hide JSON" : "Details"}
					</button>
				</div>
				{expanded ? (
					<pre className="max-h-64 overflow-auto border-t border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
						{JSON.stringify(payload, null, 2)}
					</pre>
				) : null}
			</div>
		);
	},
);

MemorallToolCallCard.displayName = "MemorallToolCallCard";
