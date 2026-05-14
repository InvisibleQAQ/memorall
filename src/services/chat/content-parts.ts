import type { ComplexContent } from "@/types/chat";

export const cloneContentParts = (parts: ComplexContent): ComplexContent =>
	parts.map((part) => ({ ...part }));

export const appendTextPart = (
	parts: ComplexContent,
	text: string,
): ComplexContent => {
	if (!text) return parts;
	const next = [...parts];
	const last = next.at(-1);
	if (last?.type === "text") {
		next[next.length - 1] = {
			...last,
			text: `${last.text}${text}`,
		};
		return next;
	}
	return [...next, { type: "text", text }];
};
