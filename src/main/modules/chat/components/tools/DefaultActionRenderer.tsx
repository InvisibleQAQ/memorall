import type { ActionRenderer } from "@/main/modules/chat/components/types";
import {
	extractMermaidContent,
	isMermaidOnly,
	TaskMermaidDiagram,
} from "./TaskMermaidDiagram";
import { ToolItemRawIO } from "./ToolCommon";

export const defaultActionRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const trimmedDesc = item.description?.trim() || "";
	if (isMermaidOnly(trimmedDesc)) {
		return (
			<div className="space-y-3">
				<TaskMermaidDiagram
					chart={extractMermaidContent(trimmedDesc)}
					isOpen={isOpen}
				/>
				<ToolItemRawIO item={item} />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
				{item.description}
			</div>
			<ToolItemRawIO item={item} />
		</div>
	);
};
