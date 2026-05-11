import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface StatsPanelProps {
	nodeCount: number;
	edgeCount: number;
	isDark: boolean;
}

export const StatsPanel = memo(
	({ nodeCount, edgeCount, isDark }: StatsPanelProps) => {
		const { t } = useTranslation("knowledge");
		return (
			<div
				className={cn(
					"absolute bottom-4 right-4 p-3 rounded-lg shadow-lg z-20",
					isDark
						? "bg-slate-800/95 backdrop-blur text-gray-300 border border-gray-700"
						: "bg-white/95 backdrop-blur text-gray-700 border border-gray-200",
				)}
			>
				<div className="text-xs space-y-1">
					<div className="flex items-center gap-2">
						<span className="font-semibold">{t("stats.nodes")}:</span>
						<span
							className={cn(
								"font-mono",
								isDark ? "text-blue-400" : "text-blue-600",
							)}
						>
							{nodeCount}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="font-semibold">{t("stats.edges")}:</span>
						<span
							className={cn(
								"font-mono",
								isDark ? "text-green-400" : "text-green-600",
							)}
						>
							{edgeCount}
						</span>
					</div>
				</div>
			</div>
		);
	},
);
StatsPanel.displayName = "StatsPanel";
