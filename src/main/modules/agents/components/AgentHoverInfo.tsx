import React from "react";
import { Badge } from "@/main/components/ui/badge";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/main/components/ui/hover-card";
import { cn } from "@/lib/utils";

type HoverAlign = React.ComponentProps<typeof HoverCardContent>["align"];
type TruncatedElement = "div" | "h2" | "p" | "span";

interface TruncatedHoverTextProps {
	text: string;
	as?: TruncatedElement;
	className?: string;
	contentClassName?: string;
	align?: HoverAlign;
	lines?: 1 | 2;
}

export const TruncatedHoverText: React.FC<TruncatedHoverTextProps> = ({
	text,
	as = "span",
	className,
	contentClassName,
	align = "start",
	lines = 1,
}) => {
	const Tag = as;

	return (
		<HoverCard openDelay={120} closeDelay={60}>
			<HoverCardTrigger asChild>
				<Tag
					title={text}
					className={cn(
						"min-w-0",
						lines === 1 ? "truncate" : "line-clamp-2",
						className,
					)}
				>
					{text}
				</Tag>
			</HoverCardTrigger>
			<HoverCardContent
				align={align}
				className={cn("w-80 p-3", contentClassName)}
			>
				<p className="text-sm leading-relaxed break-words">{text}</p>
			</HoverCardContent>
		</HoverCard>
	);
};

interface HoverBadgeListProps {
	children: React.ReactElement;
	title: string;
	items: string[];
	emptyLabel: string;
	align?: HoverAlign;
	contentClassName?: string;
	badgeClassName?: string;
	badgeVariant?: React.ComponentProps<typeof Badge>["variant"];
}

export const HoverBadgeList: React.FC<HoverBadgeListProps> = ({
	children,
	title,
	items,
	emptyLabel,
	align = "start",
	contentClassName,
	badgeClassName,
	badgeVariant = "secondary",
}) => (
	<HoverCard openDelay={120} closeDelay={60}>
		<HoverCardTrigger asChild>{children}</HoverCardTrigger>
		<HoverCardContent
			align={align}
			className={cn("w-80 space-y-3 p-3", contentClassName)}
		>
			<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
				{title}
			</p>
			{items.length > 0 ? (
				<div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
					{items.map((item) => (
						<Badge
							key={item}
							variant={badgeVariant}
							className={cn(
								"max-w-[15rem] truncate text-[10px]",
								badgeClassName,
							)}
							title={item}
						>
							{item}
						</Badge>
					))}
				</div>
			) : (
				<p className="text-xs text-muted-foreground">{emptyLabel}</p>
			)}
		</HoverCardContent>
	</HoverCard>
);
