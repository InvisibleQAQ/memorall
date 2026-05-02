export interface ParsedContent {
	thinking: string[];
	content: string;
	hasIncompleteThinking: boolean;
}

export const parseThinkTags = (
	text: string,
	isAnimating: boolean,
): ParsedContent => {
	const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
	const thinking: string[] = [];
	let match;

	while ((match = thinkRegex.exec(text)) !== null) {
		thinking.push(match[1].trim());
	}

	let content = text.replace(thinkRegex, "");

	let hasIncompleteThinking = false;
	if (isAnimating) {
		const incompleteMatch = content.match(/<think>([\s\S]*?)$/);
		if (incompleteMatch) {
			hasIncompleteThinking = true;
			thinking.unshift(incompleteMatch[1].trim());
			content = content.replace(/<think>([\s\S]*?)$/, "").trim();
		}
	}

	content = content.trim();

	return { thinking, content, hasIncompleteThinking };
};
