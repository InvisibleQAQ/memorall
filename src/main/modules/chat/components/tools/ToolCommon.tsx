import React from "react";
import { Badge } from "@/main/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MessageActionItem } from "@/main/modules/chat/components/types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const getStructuredToolPayload = (
	item: MessageActionItem,
): Record<string, unknown> | null => {
	if (isRecord(item.metadata) && typeof item.metadata.actionType === "string") {
		return item.metadata;
	}

	try {
		const parsed = JSON.parse(item.description);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const hasOwnKeys = (value: Record<string, unknown>): boolean =>
	Object.keys(value).length > 0;

export const getToolCallArguments = (
	item: MessageActionItem,
): Record<string, unknown> | null => {
	if (!isRecord(item.metadata) || !isRecord(item.metadata.tool_call)) {
		return null;
	}

	const toolCall = item.metadata.tool_call;
	if (!isRecord(toolCall.function)) {
		return null;
	}

	const rawArgs = toolCall.function.arguments;
	if (typeof rawArgs !== "string") {
		return null;
	}

	try {
		const parsed = JSON.parse(rawArgs);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

export const getString = (
	value: Record<string, unknown>,
	key: string,
): string | undefined =>
	typeof value[key] === "string" ? value[key] : undefined;

export const getNumber = (
	value: Record<string, unknown>,
	key: string,
): number | undefined =>
	typeof value[key] === "number" ? value[key] : undefined;

export const getBoolean = (
	value: Record<string, unknown>,
	key: string,
): boolean | undefined =>
	typeof value[key] === "boolean" ? value[key] : undefined;

export const stringifyToolPayload = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
};

export const formatBytes = (value: number): string => {
	if (!Number.isFinite(value)) {
		return String(value);
	}

	if (value < 1024) {
		return `${value} B`;
	}

	const units = ["KB", "MB", "GB", "TB"];
	let size = value / 1024;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

export const formatIsoDate = (value: string): string => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString();
};

export const openToolUrl = (url: string): void => {
	if (typeof chrome !== "undefined" && chrome.tabs?.create) {
		chrome.tabs.create({ url });
		return;
	}

	window.open(url, "_blank", "noopener,noreferrer");
};

export const ToolSection: React.FC<{
	title?: string;
	className?: string;
	children: React.ReactNode;
}> = ({ title, className, children }) => (
	<div
		className={cn(
			"rounded-lg border border-border/60 bg-background overflow-hidden",
			className,
		)}
	>
		{title ? (
			<div className="border-b border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
				{title}
			</div>
		) : null}
		<div className="p-3">{children}</div>
	</div>
);

export const ToolDetailsGrid: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => (
	<div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
		{children}
	</div>
);

export const ToolDetail: React.FC<{
	label: string;
	value: React.ReactNode;
	mono?: boolean;
}> = ({ label, value, mono = false }) => (
	<div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
		<div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
			{label}
		</div>
		<div className={cn("break-words text-foreground", mono && "font-mono")}>
			{value}
		</div>
	</div>
);

export const ToolCodeBlock: React.FC<{
	children: React.ReactNode;
	className?: string;
}> = ({ children, className }) => (
	<pre
		className={cn(
			"max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/20 p-3 text-xs whitespace-pre-wrap break-words",
			className,
		)}
	>
		{children}
	</pre>
);

export const ToolRawIO: React.FC<{
	input?: unknown;
	output?: unknown;
}> = ({ input, output }) => {
	const [open, setOpen] = React.useState(false);
	const [tab, setTab] = React.useState<"input" | "output">("output");

	const activeValue = tab === "input" ? input : output;
	const fallbackText =
		tab === "input" ? "No raw input available." : "No raw output available.";

	const switchTo = (t: "input" | "output") => {
		setTab(t);
		setOpen(true);
	};

	return (
		<div className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden text-xs">
			<div className="flex items-center gap-2 px-3 py-2">
				<button
					type="button"
					className="flex-1 text-left text-muted-foreground hover:text-foreground transition-colors select-none"
					onClick={() => setOpen((p) => !p)}
				>
					Raw
				</button>
				<div className="flex items-center gap-0.5 rounded-md border border-border/40 p-0.5">
					<button
						type="button"
						onClick={() => switchTo("input")}
						className={cn(
							"rounded px-2 py-0.5 text-[10px] transition-colors",
							tab === "input" && open
								? "bg-muted text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						Input
					</button>
					<button
						type="button"
						onClick={() => switchTo("output")}
						className={cn(
							"rounded px-2 py-0.5 text-[10px] transition-colors",
							tab === "output" && open
								? "bg-muted text-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						Output
					</button>
				</div>
			</div>
			{open && (
				<div className="border-t border-border/60 p-3">
					<ToolCodeBlock>
						{activeValue === undefined
							? fallbackText
							: stringifyToolPayload(activeValue)}
					</ToolCodeBlock>
				</div>
			)}
		</div>
	);
};

const getDefaultToolRawOutput = (item: MessageActionItem): unknown => {
	const structuredPayload = getStructuredToolPayload(item);
	if (structuredPayload) {
		return structuredPayload;
	}

	if (isRecord(item.metadata) && hasOwnKeys(item.metadata)) {
		return item.metadata;
	}

	return item.description;
};

export const ToolItemRawIO: React.FC<{
	item: MessageActionItem;
	input?: unknown;
	output?: unknown;
}> = ({ item, input, output }) => {
	const resolvedInput =
		input === undefined ? getToolCallArguments(item) : input;
	const resolvedOutput =
		output === undefined ? getDefaultToolRawOutput(item) : output;

	return <ToolRawIO input={resolvedInput} output={resolvedOutput} />;
};

export const ToolStateBadge: React.FC<{
	ok?: boolean;
	label?: string;
}> = ({ ok, label }) => (
	<Badge
		variant="outline"
		className={cn(
			"text-[10px]",
			ok === true && "border-green-600/30 bg-green-600/10 text-green-700",
			ok === false && "border-red-600/30 bg-red-600/10 text-red-700",
		)}
	>
		{label ?? (ok === true ? "success" : ok === false ? "failed" : "unknown")}
	</Badge>
);
