import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
				outline: "text-foreground",
				/* Landing page pill — mono label with cyan tint */
				pill:
					"rounded-pill border-[rgba(36,199,239,0.28)] bg-[rgba(36,199,239,0.08)] text-cyan font-mono text-[0.72rem] tracking-[0.08em] uppercase",
				/* Landing page chip — page-aware assistant style */
				chip:
					"rounded-pill border-[rgba(36,199,239,0.18)] bg-[rgba(36,199,239,0.10)] text-foreground/70 font-mono text-[0.72rem]",
				/* Warm orange accent pill */
				warm:
					"rounded-pill border-[rgba(247,177,93,0.28)] bg-[rgba(247,177,93,0.10)] text-warm font-mono text-[0.72rem]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
