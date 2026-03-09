import React, { useRef } from "react";
import { MermaidRenderer } from "@/main/components/atoms/MermaidRenderer";

export const isMermaidOnly = (content: string): boolean => {
	const trimmed = content.trim();
	const mermaidRegex = /^```mermaid\s*\n([\s\S]*?)\n```$/;
	return mermaidRegex.test(trimmed);
};

export const extractMermaidContent = (content: string): string => {
	const trimmed = content.trim();
	const mermaidRegex = /^```mermaid\s*\n([\s\S]*?)\n```$/;
	const match = trimmed.match(mermaidRegex);
	return match ? match[1].trim() : "";
};

export const TaskMermaidDiagram: React.FC<{ chart: string; isOpen: boolean }> = ({
  chart,
  isOpen,
}) => {
  const hasRendered = useRef(false);

  if (!isOpen) {
    return null;
  }

  if (!hasRendered.current) {
    hasRendered.current = true;
  }

  return <MermaidRenderer chart={chart} />;
};
