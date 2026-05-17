import React from "react";
import { ChevronDown, ChevronRight, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";

interface WebLLMTabProps {
	model: string;
	setModel: (model: string) => void;
	webllmAvailableModels: string[];
	loading: boolean;
	ready: boolean;
	onLoadAdvancedModel: () => Promise<void>;
	onUnloadModel: () => Promise<void>;
	quickDownloads: React.ReactNode;
}

export const WebLLMTab: React.FC<WebLLMTabProps> = ({
	model,
	setModel,
	webllmAvailableModels,
	loading,
	ready,
	onLoadAdvancedModel,
	onUnloadModel,
	quickDownloads,
}) => {
	const { t } = useTranslation("llm");
	const [showAdvantages, setShowAdvantages] = React.useState(false);
	const [showAllModels, setShowAllModels] = React.useState(false);
	const [filter, setFilter] = React.useState("");

	const filteredModels = React.useMemo(() => {
		const query = filter.trim().toLowerCase();
		if (!query) return webllmAvailableModels;
		return webllmAvailableModels.filter((item) =>
			item.toLowerCase().includes(query),
		);
	}, [filter, webllmAvailableModels]);

	return (
		<div className="space-y-4">
			<section className="rounded-lg border bg-muted/20">
				<button
					type="button"
					className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium"
					onClick={() => setShowAdvantages((value) => !value)}
				>
					{showAdvantages ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
					<Zap className="h-4 w-4 text-primary" />
					WebLLM advantages
				</button>
				{showAdvantages && (
					<ul className="space-y-1 px-4 pb-3 text-xs text-muted-foreground">
						<li>WebGPU hardware acceleration - fastest in-browser inference</li>
						<li>No installation, no server - runs fully in the browser tab</li>
						<li>Supports quantized models, including 4-bit and 8-bit builds</li>
						<li>Isolated execution in offscreen iframe</li>
					</ul>
				)}
			</section>

			<section className="space-y-3">
				<div className="text-sm font-semibold">Quick download</div>
				{quickDownloads}
			</section>

			<section className="rounded-lg border">
				<button
					type="button"
					className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium"
					onClick={() => setShowAllModels((value) => !value)}
				>
					{showAllModels ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
					Advanced - All Models
				</button>
				{showAllModels && (
					<div className="space-y-3 border-t p-3">
						<Input
							value={filter}
							onChange={(event) => setFilter(event.target.value)}
							placeholder="Filter models..."
							disabled={loading}
						/>
						<div className="grid max-h-80 gap-2 overflow-y-auto">
							{filteredModels.map((modelId) => (
								<div
									key={modelId}
									className={`flex items-center justify-between rounded-lg border p-3 ${
										model === modelId ? "border-primary bg-primary/5" : ""
									}`}
								>
									<div className="min-w-0 truncate text-sm">{modelId}</div>
									<Button
										type="button"
										size="sm"
										variant={model === modelId ? "secondary" : "outline"}
										onClick={() => setModel(modelId)}
										disabled={loading}
									>
										Load
									</Button>
								</div>
							))}
						</div>
					</div>
				)}
			</section>

			<div className="flex gap-2">
				<Button
					onClick={onLoadAdvancedModel}
					disabled={loading || ready || !model}
				>
					{t("advanced.loadModel")}
				</Button>
				<Button
					onClick={onUnloadModel}
					variant="outline"
					disabled={loading || !ready}
				>
					{t("advanced.unload")}
				</Button>
			</div>
		</div>
	);
};
