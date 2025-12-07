/**
 * Model Downloading Screen Component
 * Reusable component to show model download progress
 * Used in ChatPage and other places where model download feedback is needed
 */

import React from "react";
import { Brain } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { DownloadProgress } from "../hooks/use-download-progress";

interface ModelDownloadingScreenProps {
	/** Download progress data */
	downloadProgress: DownloadProgress;
	/** Model name being downloaded */
	modelName?: string | null;
	/** Optional title override */
	title?: string;
	/** Optional description override */
	description?: string;
}

export const ModelDownloadingScreen: React.FC<ModelDownloadingScreenProps> = ({
	downloadProgress,
	modelName,
	title = "Downloading Model",
	description,
}) => {
	const defaultDescription = modelName
		? `${modelName} is being downloaded...`
		: "Model is being downloaded...";

	return (
		<div className="flex flex-col h-full bg-background items-center justify-center p-8">
			<div className="w-full max-w-md space-y-6">
				{/* Header */}
				<div className="text-center space-y-2">
					<Brain className="w-16 h-16 mx-auto mb-4 text-primary animate-pulse" />
					<h3 className="text-xl font-semibold">{title}</h3>
					<p className="text-sm text-muted-foreground">
						{description || defaultDescription}
					</p>
				</div>

				{/* Progress Section */}
				<div className="space-y-3 p-4 border rounded-lg bg-muted/50">
					<div className="flex items-center justify-between text-sm">
						<span className="font-medium">
							Loading {modelName || "model"}
						</span>
						<span className="text-muted-foreground">
							{downloadProgress.percent}%
						</span>
					</div>
					<Progress value={downloadProgress.percent} className="h-2" />
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>{downloadProgress.text || "Initializing..."}</span>
						{downloadProgress.loaded > 0 && downloadProgress.total > 0 && (
							<span>
								{(downloadProgress.loaded / 1024 / 1024).toFixed(2)} MB /{" "}
								{(downloadProgress.total / 1024 / 1024).toFixed(2)} MB
							</span>
						)}
					</div>
				</div>

				{/* Helper Text */}
				<p className="text-xs text-center text-muted-foreground">
					Please wait while the model is being downloaded. This may take a few
					minutes.
				</p>
			</div>
		</div>
	);
};
