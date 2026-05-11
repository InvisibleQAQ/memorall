import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	Loader2,
} from "lucide-react";
import type { ComplexContentPartTool } from "@/types/chat";
import { cn } from "@/lib/utils";
import {
	getActionIcon,
	ToolActionDetails,
	translateActionName,
} from "../MessageActions";

export const AssistantToolTimelinePart: React.FC<{
	part: ComplexContentPartTool;
	isLast: boolean;
}> = ({ part, isLast }) => {
	const { t } = useTranslation("chat");
	const [isOpen, setIsOpen] = useState(false);
	const actionName = part.name;
	const title = translateActionName(t, actionName);
	const Icon = getActionIcon(actionName);
	const isRunning = part.state === "running";
	const isError = part.state === "error";
	const actionItem = {
		name: part.name,
		description: part.description,
		metadata: part.metadata,
	};

	return (
		<div className="grid min-w-[34rem] max-w-full grid-cols-[1rem_minmax(0,1fr)] gap-2.5">
			<div className="relative flex h-11 justify-center">
				{!isLast ? (
					<div className="absolute left-1/2 top-[1.375rem] h-[calc(100%+0.75rem)] w-px -translate-x-1/2 bg-border/70" />
				) : (
					<div className="absolute left-1/2 top-[1.375rem] h-8 w-px -translate-x-1/2 bg-gradient-to-b from-border/70 to-transparent" />
				)}
				<span
					className={cn(
						"absolute top-[1.125rem] z-10 h-2 w-2 rounded-full border bg-background",
						isError
							? "border-destructive bg-destructive"
							: isRunning
								? "border-primary bg-primary"
								: "border-emerald-500 bg-emerald-500",
					)}
				/>
			</div>
			<div className="min-w-0">
				<button
					type="button"
					className={cn(
						"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
						isOpen ? "bg-muted/35" : "hover:bg-muted/20",
					)}
					onClick={() => setIsOpen((value) => !value)}
				>
					<span
						className={cn(
							"flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background/70",
							isError
								? "border-destructive/25 text-destructive"
								: isRunning
									? "border-primary/25 text-primary"
									: "border-border/60 text-muted-foreground",
						)}
					>
						<Icon className="h-4 w-4" />
					</span>
					<span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
						{title}
					</span>
					<span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
						{isRunning ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : isError ? (
							<AlertTriangle className="h-3.5 w-3.5 text-destructive" />
						) : (
							<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
						)}
						{isRunning ? "Running" : isError ? "Error" : "Done"}
					</span>
					<ChevronDown
						className={cn(
							"h-4 w-4 shrink-0 text-muted-foreground transition-transform",
							isOpen && "rotate-180 text-foreground",
						)}
					/>
				</button>
				{isOpen ? (
					<div className="mt-2 border-l border-border/60 pl-3 text-sm">
						<ToolActionDetails item={actionItem} isOpen={isOpen} />
					</div>
				) : null}
			</div>
		</div>
	);
};
