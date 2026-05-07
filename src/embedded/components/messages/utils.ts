import type { ChatMessage } from "@/embedded/types";
import { EMBEDDED_CONTEXT_TAG_CONFIG } from "@/embedded/context-items";

export const translateActionName = (
	actionName: string,
	actions: Record<string, string>,
): string => {
	if (actions[actionName]) {
		return actions[actionName];
	}
	return actionName.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

export const getTextContent = (content: ChatMessage["content"]): string => {
	if (typeof content === "string") {
		return content;
	}
	return content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
};

export const formatJsonPreview = (value: unknown, maxLength = 180): string => {
	if (value === undefined || value === null) return "";
	const raw =
		typeof value === "string" ? value : JSON.stringify(value, null, 2) || "";
	return raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const getCoAgentHoverAnchor = (
	metadata: ChatMessage["metadata"],
): Record<string, unknown> | null => {
	if (!isRecord(metadata) || metadata.source !== "co-agent") return null;
	return isRecord(metadata.anchor) ? metadata.anchor : null;
};

export const getAnchorTextPreview = (
	anchor: Record<string, unknown>,
): string => {
	const text =
		typeof anchor.text === "string" && anchor.text.trim()
			? anchor.text
			: typeof anchor.nearbyText === "string"
				? anchor.nearbyText
				: "";
	return text.replace(/\s+/g, " ").trim();
};

export const getToolCallSummary = (toolCall: unknown, index: number) => {
	if (typeof toolCall !== "object" || toolCall === null) {
		return {
			id: `tool-${index}`,
			name: `Tool ${index + 1}`,
			argumentsText: formatJsonPreview(toolCall),
		};
	}

	const record = toolCall as Record<string, unknown>;
	const fn =
		typeof record.function === "object" && record.function !== null
			? (record.function as Record<string, unknown>)
			: undefined;

	return {
		id: typeof record.id === "string" ? record.id : `tool-${index}`,
		name:
			(typeof fn?.name === "string" && fn.name) ||
			(typeof record.name === "string" && record.name) ||
			"",
		argumentsText:
			(typeof fn?.arguments === "string" && fn.arguments) ||
			formatJsonPreview(record.arguments ?? record.args ?? record),
	};
};

export type ParsedContextSections =
	| {
			hasContext: false;
			plainText: string;
			sections: never[];
	  }
	| {
			hasContext: true;
			websiteInfo: { title: string; url: string } | null;
			sections: Array<{ type: string; content: string; label: string }>;
			userMessage: string;
	  };

const labelPrefixByType: Record<string, string> = {
	text: "📝",
	html: "🏗️",
	screenshot: "📸",
};

export const parseContextSections = (
	content: string,
): ParsedContextSections => {
	const sections: Array<{ type: string; content: string; label: string }> = [];

	const contextMatch = content.match(/<context>([\s\S]*?)<\/context>/);
	if (!contextMatch) {
		return { hasContext: false, plainText: content, sections: [] };
	}

	const contextContent = contextMatch[1];
	const beforeContext = content.slice(0, contextMatch.index);
	const afterContext = content.slice(
		contextMatch.index! + contextMatch[0].length,
	);

	const websiteMatch = contextContent.match(/<website>([\s\S]*?)<\/website>/);
	let websiteInfo = null;
	if (websiteMatch) {
		const titleMatch = websiteMatch[1].match(/<title>(.*?)<\/title>/);
		const urlMatch = websiteMatch[1].match(/<url>(.*?)<\/url>/);
		websiteInfo = {
			title: titleMatch?.[1]?.trim() || "",
			url: urlMatch?.[1]?.trim() || "",
		};
	}

	const tagPattern = Object.keys(EMBEDDED_CONTEXT_TAG_CONFIG).join("|");
	const sectionRegex = new RegExp(`<(${tagPattern})>([\\s\\S]*?)<\\/\\1>`, "g");

	for (const match of contextContent.matchAll(sectionRegex)) {
		const tag = match[1];
		const sectionConfig = EMBEDDED_CONTEXT_TAG_CONFIG[tag];
		if (!sectionConfig) continue;

		sections.push({
			type: sectionConfig.displayType,
			content: match[2].trim(),
			label: `${labelPrefixByType[sectionConfig.displayType]} ${sectionConfig.renderLabel}`,
		});
	}

	return {
		hasContext: true,
		websiteInfo,
		sections,
		userMessage: (beforeContext + afterContext).trim(),
	};
};
