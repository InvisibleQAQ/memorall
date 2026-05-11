import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ControlPanelProps {
	onZoomIn: () => void;
	onZoomOut: () => void;
	onResetZoom: () => void;
	isDark: boolean;
}

export const ControlPanel = memo(
	({ onZoomIn, onZoomOut, onResetZoom, isDark }: ControlPanelProps) => {
		const { t } = useTranslation("knowledge");
		return (
			<div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
				<button
					onClick={onZoomIn}
					className={cn(
						"p-2 rounded-lg shadow-lg transition-all hover:scale-110",
						isDark
							? "bg-slate-800 text-gray-200 hover:bg-slate-700 border border-gray-700"
							: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
					)}
					title={t("visualization.zoomIn")}
				>
					<ZoomIn className="h-5 w-5" />
				</button>
				<button
					onClick={onZoomOut}
					className={cn(
						"p-2 rounded-lg shadow-lg transition-all hover:scale-110",
						isDark
							? "bg-slate-800 text-gray-200 hover:bg-slate-700 border border-gray-700"
							: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
					)}
					title={t("visualization.zoomOut")}
				>
					<ZoomOut className="h-5 w-5" />
				</button>
				<button
					onClick={onResetZoom}
					className={cn(
						"p-2 rounded-lg shadow-lg transition-all hover:scale-110",
						isDark
							? "bg-slate-800 text-gray-200 hover:bg-slate-700 border border-gray-700"
							: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
					)}
					title={t("visualization.resetView")}
				>
					<Maximize2 className="h-5 w-5" />
				</button>
			</div>
		);
	},
);
ControlPanel.displayName = "ControlPanel";
