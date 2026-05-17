const OPENUI_ASSIGNMENT_PATTERN = /^\w+\s*=\s*\w+\(/;

export function isOpenUILang(content: string): boolean {
	const firstLine = content.trimStart().split("\n")[0] ?? "";
	return OPENUI_ASSIGNMENT_PATTERN.test(firstLine.trim());
}
