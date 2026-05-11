import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LegendProps {
	nodeColors: Record<string, string>;
	uniqueNodeTypes: string[];
	isDark: boolean;
}

export const Legend = memo(
	({ nodeColors, uniqueNodeTypes, isDark }: LegendProps) => {
		const { t } = useTranslation("knowledge");
		const [isVisible, setIsVisible] = useState(true);

		return (
			<div
				className={cn(
					"absolute bottom-4 left-4 rounded-lg shadow-lg z-20",
					isDark
						? "bg-slate-800/95 backdrop-blur border border-gray-700"
						: "bg-white/95 backdrop-blur border border-gray-200",
				)}
			>
				<button
					onClick={() => setIsVisible(!isVisible)}
					className={cn(
						"w-full px-3 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide hover:bg-accent transition-colors rounded-t-lg",
						isDark
							? "text-gray-400 hover:text-gray-200"
							: "text-gray-500 hover:text-gray-700",
					)}
				>
					<span>
						{t("legend.nodeTypes")} ({uniqueNodeTypes.length})
					</span>
					<svg
						className={cn(
							"w-4 h-4 transition-transform",
							isVisible ? "rotate-180" : "",
						)}
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</button>
				{isVisible && (
					<div className="px-3 pb-3 max-h-64 overflow-y-auto space-y-2">
						{Object.entries(nodeColors)
							.filter(([type]) => type !== "default")
							.map(([type, color]) => (
								<div key={type} className="flex items-center gap-2">
									<div
										className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
										style={{
											background: `radial-gradient(circle at 30% 30%, ${color}, ${color}dd)`,
										}}
									/>
									<span
										className={cn(
											"text-xs capitalize",
											isDark ? "text-gray-300" : "text-gray-700",
										)}
									>
										{type}
									</span>
								</div>
							))}
					</div>
				)}
			</div>
		);
	},
);
Legend.displayName = "Legend";
