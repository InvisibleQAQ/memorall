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

// ── Workspace path helpers ────────────────────────────────────────────────────

export const WORKSPACE_PREFIX = "/workspaces";
const DOCUMENTS_PREFIX = "/documents";

/** True when path addresses the workspace namespace (/workspaces or /workspaces/...). */
export function isWorkspacePath(path: string): boolean {
	return path === WORKSPACE_PREFIX || path.startsWith(WORKSPACE_PREFIX + "/");
}

/**
 * Convert a workspace tree node's logical path (e.g. /myproject/src) to its
 * display path used by the tools (e.g. /workspaces/myproject/src).
 * Workspace tree nodes use "/" as root, so we prefix with /workspaces.
 */
export function wsNodeToDisplayPath(logicalPath: string): string {
	if (logicalPath === "/") return WORKSPACE_PREFIX;
	return `${WORKSPACE_PREFIX}${logicalPath}`;
}

/**
 * Strip the /workspaces prefix to get the workspace tree logical path.
 *   /workspaces            → /
 *   /workspaces/myproject  → /myproject
 */
export function wsDisplayToLogicalPath(displayPath: string): string {
	if (displayPath === WORKSPACE_PREFIX) return "/";
	return displayPath.slice(WORKSPACE_PREFIX.length);
}

/**
 * Strip /documents prefix from a document path so it can be used with dfs.getTree().
 *   /documents/notes/todo.md → /notes/todo.md
 *   /documents               → /
 *   /notes/todo.md           → /notes/todo.md  (bare path, unchanged)
 */
export function stripDocumentsPrefix(path: string): string {
	if (path === DOCUMENTS_PREFIX) return "/";
	if (path.startsWith(DOCUMENTS_PREFIX + "/")) return path.slice(DOCUMENTS_PREFIX.length);
	return path;
}
