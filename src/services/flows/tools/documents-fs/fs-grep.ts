import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { normalizeFsPath, flattenTree, globToRegex, isInScope } from "./util";

const TOOL_NAME = "document_fs_grep" as const;

const schema = z.object({
	pattern: z.string().describe("Regex pattern to search for in file content"),
	path: z
		.string()
		.optional()
		.describe(
			'Directory (or exact file path) to search (default: "/"). If a file path is provided, searches only that file.',
		),
	glob: z
		.string()
		.optional()
		.describe('Glob pattern to filter filenames (e.g. "*.ts", "**/*.md")'),
	case_sensitive: z
		.boolean()
		.optional()
		.describe("Case-sensitive matching (default: false)"),
	context: z
		.number()
		.optional()
		.describe(
			"Lines of context to show before and after each match (default: 0)",
		),
	max_results: z
		.number()
		.optional()
		.describe("Maximum matching lines to return (default: 50)"),
	output_mode: z
		.enum(["content", "files_with_matches", "count"])
		.optional()
		.describe(
			'"content" shows file:line:text (default), "files_with_matches" shows only file paths, "count" shows match count per file',
		),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

export const createFsGrepTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		'Search file content with a regex pattern. Returns results in "file:line:content" ripgrep format. Supports context lines, file-glob filtering, and multiple output modes.',
	schema,
	execute: async (input) => {
		const {
			pattern,
			path = "/",
			glob,
			case_sensitive = false,
			context = 0,
			max_results = 50,
			output_mode = "content",
		} = input;

		const dfs = services.documentFileSystem;
		if (!dfs) return "Error: documentFileSystem service not available.";

		const targetPath = normalizeFsPath(path);
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);

		// Build content regex
		let contentRegex: RegExp;
		try {
			contentRegex = new RegExp(pattern, case_sensitive ? "g" : "gi");
		} catch {
			const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			contentRegex = new RegExp(escaped, case_sensitive ? "g" : "gi");
		}

		// Determine the set of file nodes to search
		const fileGlobRegex = glob ? globToRegex(glob) : null;
		const targetNode = allNodes.find((n) => n.path === targetPath);
		const isSingleFile = targetNode?.type === "file";

		const fileNodes = allNodes.filter((n) => {
			if (n.type !== "file") return false;
			if (isSingleFile) return n.path === targetPath;
			if (!isInScope(n.path, targetPath)) return false;
			if (fileGlobRegex) {
				// Test the relative path from targetPath so patterns like
				// "src/**/*.ts" or "*.md" respect directory depth correctly.
				const rel =
					targetPath === "/"
						? n.path.slice(1)
						: n.path.slice(targetPath.length + 1);
				if (!fileGlobRegex.test(rel)) return false;
			}
			return true;
		});

		if (fileNodes.length === 0) {
			return `No files found to search under "${targetPath}"${glob ? ` matching glob "${glob}"` : ""}`;
		}

		const outputLines: string[] = [];
		let totalMatches = 0;
		let filesWithMatches = 0;

		for (const node of fileNodes) {
			if (totalMatches >= max_results) break;

			let text: string;
			try {
				const raw = await dfs.getFileContent(node.path);
				text = new TextDecoder().decode(raw);
			} catch {
				continue;
			}

			const lines = text.split("\n");
			const matchingLineNums: number[] = [];

			for (let i = 0; i < lines.length; i++) {
				contentRegex.lastIndex = 0;
				if (contentRegex.test(lines[i])) {
					matchingLineNums.push(i);
				}
			}

			if (matchingLineNums.length === 0) continue;

			filesWithMatches++;

			if (output_mode === "files_with_matches") {
				outputLines.push(node.path);
				totalMatches++;
				continue;
			}

			if (output_mode === "count") {
				outputLines.push(`${node.path}:${matchingLineNums.length}`);
				totalMatches++;
				continue;
			}

			// content mode — emit lines with optional context
			const emitted = new Set<number>();
			for (let mi = 0; mi < matchingLineNums.length; mi++) {
				if (totalMatches >= max_results) break;
				const matchLine = matchingLineNums[mi];
				const start = Math.max(0, matchLine - context);
				const end = Math.min(lines.length - 1, matchLine + context);

				for (let l = start; l <= end; l++) {
					if (emitted.has(l)) continue;
					emitted.add(l);
					const sep = l === matchLine ? ":" : "-";
					outputLines.push(`${node.path}:${l + 1}${sep}${lines[l]}`);
				}

				// Separator between non-adjacent match groups
				if (
					context > 0 &&
					mi < matchingLineNums.length - 1 &&
					matchingLineNums[mi + 1] > matchLine + context + 1
				) {
					outputLines.push("--");
				}

				totalMatches++;
			}
		}

		if (outputLines.length === 0) {
			return `No matches found for "${pattern}"${glob ? ` in files matching "${glob}"` : ""} under "${targetPath}"`;
		}

		const summary =
			output_mode === "content"
				? `\n\n${totalMatches} match${totalMatches !== 1 ? "es" : ""} in ${filesWithMatches} file${filesWithMatches !== 1 ? "s" : ""}`
				: "";

		return `${outputLines.join("\n")}${summary}`;
	},
});

toolRegistry.register(TOOL_NAME, createFsGrepTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
