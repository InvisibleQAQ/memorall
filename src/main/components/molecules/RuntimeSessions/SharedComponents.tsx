import React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// KindBadge
// ---------------------------------------------------------------------------

const KIND_COLORS: Record<string, string> = {
	express:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	vite: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
	next: "bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
};

export const KindBadge: React.FC<{ kind: string }> = ({ kind }) => (
	<span
		className={cn(
			"text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
			KIND_COLORS[kind] ?? "bg-muted text-muted-foreground",
		)}
	>
		{kind}
	</span>
);

// ---------------------------------------------------------------------------
// CommandStatusBadge
// ---------------------------------------------------------------------------

const COMMAND_STATUS_COLORS: Record<string, string> = {
	running:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
	completed:
		"bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
	stopped:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

export const CommandStatusBadge: React.FC<{
	status: string;
	label: string;
}> = ({ status, label }) => (
	<span
		className={cn(
			"text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
			COMMAND_STATUS_COLORS[status] ?? "bg-muted text-muted-foreground",
		)}
	>
		{label}
	</span>
);

// ---------------------------------------------------------------------------
// RuntimeSummaryTile
// ---------------------------------------------------------------------------

export const RuntimeSummaryTile: React.FC<{
	icon: React.ReactNode;
	value: number | string;
	label: string;
}> = ({ icon, value, label }) => (
	<div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/70 bg-muted/30 px-2 py-2 text-center">
		<div className="text-muted-foreground">{icon}</div>
		<div className="text-sm font-semibold leading-none text-foreground">
			{value}
		</div>
		<div className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
			{label}
		</div>
	</div>
);

// ---------------------------------------------------------------------------
// ActionIconButton
// ---------------------------------------------------------------------------

export const ActionIconButton: React.FC<{
	title: string;
	onClick: () => void;
	icon: React.ReactNode;
	disabled?: boolean;
	variant?: "default" | "danger";
}> = ({ title, onClick, icon, disabled = false, variant = "default" }) => (
	<button
		type="button"
		title={title}
		onClick={onClick}
		disabled={disabled}
		className={cn(
			"inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-50",
			variant === "danger"
				? "border-transparent hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
				: "border-transparent hover:border-border hover:bg-muted/80 hover:text-foreground",
		)}
	>
		{icon}
	</button>
);

// ---------------------------------------------------------------------------
// VerticalResizeHandle
// ---------------------------------------------------------------------------

export const VerticalResizeHandle: React.FC<{
	onMouseDown: (e: React.MouseEvent) => void;
}> = ({ onMouseDown }) => (
	<div
		onMouseDown={onMouseDown}
		className="relative flex h-3 cursor-row-resize items-center justify-center border-t border-border/40 bg-transparent transition-colors hover:bg-primary/10 group"
	>
		<div className="flex gap-0.5 text-border group-hover:text-primary/60 transition-colors">
			<span className="block h-0.5 w-4 rounded-full bg-current" />
			<span className="block h-0.5 w-4 rounded-full bg-current" />
		</div>
	</div>
);
