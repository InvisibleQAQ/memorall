/**
 * Interaction Event Renderer
 * User-friendly display for click and input activities
 */

import React from "react";
import { MousePointer, Type, Lock } from "lucide-react";
import type { Activity } from "@/types/activity-tracking";

interface InteractionEventRendererProps {
	activity: Activity;
	expanded?: boolean;
}

export const InteractionEventRenderer: React.FC<
	InteractionEventRendererProps
> = ({ activity, expanded = false }) => {
	const data = activity.data as any;
	const isInput = data.type === "user_input";
	const isClick = data.type === "click";

	// Extract common data
	const pageTitle = data.pageTitle || "Unknown Page";
	const pageUrl = data.pageUrl || "";
	const domain = pageUrl ? new URL(pageUrl).hostname : "";
	const elementInfo = data.elementInfo || {};

	// Get element description
	const getElementDescription = () => {
		if (elementInfo.label) return elementInfo.label;
		if (elementInfo.placeholder) return elementInfo.placeholder;
		if (elementInfo.ariaLabel) return elementInfo.ariaLabel;
		if (elementInfo.textContent) return elementInfo.textContent;
		if (elementInfo.name) return elementInfo.name;
		if (elementInfo.id) return `#${elementInfo.id}`;
		return elementInfo.tagName || "element";
	};

	const elementDesc = getElementDescription();

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-start gap-3">
				<div
					className={`w-10 h-10 rounded-lg ${isInput ? "bg-green-500/10" : "bg-orange-500/10"} flex items-center justify-center flex-shrink-0`}
				>
					{isInput ? (
						<Type className="w-5 h-5 text-green-500" />
					) : (
						<MousePointer className="w-5 h-5 text-orange-500" />
					)}
				</div>
				<div className="flex-1 min-w-0">
					<h4 className="font-medium text-base mb-1">
						{isInput ? "Filled in" : "Clicked on"}{" "}
						<span className="text-primary font-semibold line-clamp-1">
							{elementDesc}
						</span>
					</h4>
					<p className="text-sm text-muted-foreground truncate">{domain}</p>
				</div>
			</div>

			{/* Input Content */}
			{isInput && expanded && (
				<div className="mt-3">
					{data.isRedacted ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
							<Lock className="w-4 h-4" />
							<span>Sensitive information (hidden for privacy)</span>
						</div>
					) : (
						<div className="bg-muted/30 p-3 rounded-lg border border-muted">
							<p className="text-sm font-mono text-foreground/80 line-clamp-3">
								{data.content}
							</p>
						</div>
					)}
				</div>
			)}

			{/* Element Context */}
			{expanded && (
				<div className="text-xs text-muted-foreground space-y-1">
					{elementInfo.type && (
						<div>
							<span className="font-semibold">Type:</span> {elementInfo.type}
						</div>
					)}
					{elementInfo.name && (
						<div>
							<span className="font-semibold">Field name:</span>{" "}
							{elementInfo.name}
						</div>
					)}
					<div>
						<span className="font-semibold">On page:</span>{" "}
						<a
							href={pageUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							{pageTitle}
						</a>
					</div>
				</div>
			)}
		</div>
	);
};
