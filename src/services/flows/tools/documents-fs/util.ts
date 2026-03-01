import type { DocumentTreeNode } from "@/types/document-library";

/**
 * Normalize a logical document path (same rules as the documents/ util,
 * but kept local so documents-fs stays self-contained).
 */
export function normalizeFsPath(inputPath: string): string {
	const raw = inputPath.trim().replace(/\\/g, "/");
	if (!raw) return "/";
	const candidate = raw.startsWith("/") ? raw : `/${raw}`;
	const parts = candidate.split("/").filter(Boolean);
	const resolved: string[] = [];
	for (const part of parts) {
		if (part === ".") continue;
		if (part === "..") {
			resolved.pop();
			continue;
		}
		resolved.push(part);
	}
	let normalized = resolved.length ? `/${resolved.join("/")}` : "/";
	// Strip leading "/documents" prefix so callers can use either form
	if (normalized === "/documents") return "/";
	if (normalized.startsWith("/documents/")) {
		normalized = normalized.slice("/documents".length) || "/";
	}
	return normalized;
}

/** Flatten the recursive document tree into a single list of nodes. */
export function flattenTree(nodes: DocumentTreeNode[]): DocumentTreeNode[] {
	const result: DocumentTreeNode[] = [];
	for (const node of nodes) {
		result.push(node);
		if (node.children?.length) {
			result.push(...flattenTree(node.children));
		}
	}
	return result;
}

/**
 * Convert a glob pattern to a RegExp.
 * - `**` matches any path segment including `/`
 * - `*`  matches any character except `/`
 * - `?`  matches any single character except `/`
 */
export function globToRegex(pattern: string): RegExp {
	const specialChars = /[.+^${}()|[\]\\]/g;
	let regexStr = "";
	let i = 0;
	while (i < pattern.length) {
		const ch = pattern[i];
		if (ch === "*" && pattern[i + 1] === "*") {
			regexStr += ".*";
			i += 2;
			if (pattern[i] === "/") i++;
		} else if (ch === "*") {
			regexStr += "[^/]*";
			i++;
		} else if (ch === "?") {
			regexStr += "[^/]";
			i++;
		} else {
			regexStr += ch.replace(specialChars, "\\$&");
			i++;
		}
	}
	return new RegExp(`^${regexStr}$`, "i");
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Return true when nodePath is inside (or equal to) scopePath. */
export function isInScope(nodePath: string, scopePath: string): boolean {
	if (scopePath === "/") return true;
	return nodePath === scopePath || nodePath.startsWith(`${scopePath}/`);
}
