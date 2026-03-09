import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	normalizeFsPath,
	flattenTree,
	globToRegex,
	isInScope,
	isWorkspacePath,
	wsNodeToDisplayPath,
	wsDisplayToLogicalPath,
	stripDocumentsPrefix,
} from "./util";

const TOOL_NAME = "fs_glob" as const;

const schema = z.object({
	pattern: z
		.string()
		.describe(
			'Glob pattern to match file paths (e.g. "**/*.md", "notes/**/*.txt", "*.json")',
		),
	path: z
		.string()
		.optional()
		.describe('Base directory to search under (default: "/")'),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

export const createFsGlobTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Find files whose paths match a glob pattern. Supports ** (recursive), * (single-level wildcard), ? (single character). Returns matching paths sorted by modification time (newest first).",
	schema,
	execute: async (input) => {
		const { pattern, path = "/" } = input;

		const dfs = services.documentFileSystem;
		if (!dfs) return "Error: documentFileSystem service not available.";

		const basePath = normalizeFsPath(path);
		const regex = globToRegex(pattern);

		if (isWorkspacePath(basePath)) {
			const wsLogical = wsDisplayToLogicalPath(basePath);
			const tree = await dfs.getWorkspaceTree();
			const allNodes = flattenTree(tree);

			const candidates = allNodes.filter((n) => isInScope(n.path, wsLogical));

			const matches = candidates.filter((n) => {
				const rel =
					wsLogical === "/"
						? n.path.slice(1)
						: n.path.slice(wsLogical.length + 1);
				return rel.length > 0 && regex.test(rel);
			});

			if (matches.length === 0) {
				return `No files found matching "${pattern}" under "${basePath}"`;
			}

			matches.sort((a, b) => {
				const ta = a.file?.modifiedAt?.getTime() ?? 0;
				const tb = b.file?.modifiedAt?.getTime() ?? 0;
				return tb - ta;
			});

			return matches.map((n) => wsNodeToDisplayPath(n.path)).join("\n");
		}

		// Document namespace
		const docBasePath = stripDocumentsPrefix(basePath);
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);

		const candidates = allNodes.filter((n) => isInScope(n.path, docBasePath));

		const matches = candidates.filter((n) => {
			const rel =
				docBasePath === "/"
					? n.path.slice(1)
					: n.path.slice(docBasePath.length + 1);
			return rel.length > 0 && regex.test(rel);
		});

		if (matches.length === 0) {
			return `No files found matching "${pattern}" under "${basePath}"`;
		}

		matches.sort((a, b) => {
			const ta = a.file?.modifiedAt?.getTime() ?? 0;
			const tb = b.file?.modifiedAt?.getTime() ?? 0;
			return tb - ta;
		});

		return matches.map((n) => n.path).join("\n");
	},
});

toolRegistry.register(TOOL_NAME, createFsGlobTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
