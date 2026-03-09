import type { ActionRenderer } from "@/main/modules/chat/components/types";
import { extractMermaidContent, isMermaidOnly, TaskMermaidDiagram } from "./TaskMermaidDiagram";

export const defaultActionRenderer: ActionRenderer = (item, isOpen) => {
  if (!isOpen) return null;

  const trimmedDesc = item.description?.trim() || "";
  if (isMermaidOnly(trimmedDesc)) {
    return (
      <TaskMermaidDiagram
        chart={extractMermaidContent(trimmedDesc)}
        isOpen={isOpen}
      />
    );
  }

  return (
    <div className="w-full overflow-hidden whitespace-pre-wrap break-words">
      {item.description}
    </div>
  );
};
