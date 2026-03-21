import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { normalizeFsPath, flattenTree, globToRegex, isInScope } from "./util";

const TOOL_NAME = "document_fs_glob" as const;

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
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);

		// Only files, scoped to the requested directory
		const fileNodes = allNodes.filter(
			(n) => n.type === "file" && isInScope(n.path, basePath),
		);

		const regex = globToRegex(pattern);

		// Match only against the relative path from basePath.
		// Do NOT fall back to testing n.name — that would make "*.md" match
		// deep/nested/file.md, breaking single-level glob semantics.
		const matches = fileNodes.filter((n) => {
			const rel =
				basePath === "/"
					? n.path.slice(1) // strip leading "/"
					: n.path.slice(basePath.length + 1);
			return regex.test(rel);
		});

		if (matches.length === 0) {
			return `No files found matching "${pattern}" under "${basePath}"`;
		}

		// Sort by modification time, newest first (fall back to path order)
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
