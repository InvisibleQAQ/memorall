import { memo } from "react";
import { cn } from "@/lib/utils";
import type { D3Node } from "./types";

interface HoverTooltipProps {
	node: D3Node;
	isDark: boolean;
}

export const HoverTooltip = memo(({ node, isDark }: HoverTooltipProps) => (
	<div
		className={cn(
			"absolute pointer-events-none px-3 py-2 rounded-lg shadow-xl text-sm font-medium max-w-xs z-50",
			isDark
				? "bg-slate-900/95 text-gray-100 border border-gray-700"
				: "bg-white/95 text-gray-900 border border-gray-200",
		)}
		style={{
			left: "50%",
			top: "20%",
			transform: "translateX(-50%)",
		}}
	>
		<div className="font-bold">{node.name}</div>
		<div
			className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-gray-500")}
		>
			{node.nodeType}
		</div>
	</div>
));
HoverTooltip.displayName = "HoverTooltip";
