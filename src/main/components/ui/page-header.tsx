import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
	icon: React.ReactNode;
	title: React.ReactNode;
	description: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
	icon,
	title,
	description,
	actions,
	className,
}) => (
	<div
		className={cn(
			"shrink-0 overflow-hidden border-b border-border px-4 py-4",
			className,
		)}
	>
		<div className="flex min-w-0 items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<span className="shrink-0 text-primary">{icon}</span>
					<h1 className="truncate text-lg font-semibold tracking-normal">
						{title}
					</h1>
				</div>
				<p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
					{description}
				</p>
			</div>
			{actions ? <div className="shrink-0">{actions}</div> : null}
		</div>
	</div>
);
