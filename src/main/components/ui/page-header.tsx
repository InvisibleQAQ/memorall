import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
	icon: React.ReactNode;
	title: React.ReactNode;
	description: React.ReactNode;
	actions?: React.ReactNode;
	actionsPlacement?: "inline" | "bottom" | "title";
	className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
	icon,
	title,
	description,
	actions,
	actionsPlacement = "inline",
	className,
}) => (
	<div
		className={cn(
			"shrink-0 overflow-hidden border-b border-border px-4 py-4",
			className,
		)}
	>
		<div className="flex min-w-0 items-start justify-between gap-3">
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<span className="shrink-0 text-primary">{icon}</span>
						<h1 className="truncate text-lg font-semibold tracking-normal">
							{title}
						</h1>
					</div>
					{actions && actionsPlacement === "title" ? (
						<div className="shrink-0">{actions}</div>
					) : null}
				</div>
				<p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
					{description}
				</p>
			</div>
			{actions && actionsPlacement === "inline" ? (
				<div className="shrink-0">{actions}</div>
			) : null}
		</div>
		{actions && actionsPlacement === "bottom" ? (
			<div className="mt-3 flex min-w-0 justify-start">{actions}</div>
		) : null}
	</div>
);
