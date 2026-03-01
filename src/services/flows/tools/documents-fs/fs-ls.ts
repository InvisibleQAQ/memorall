import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { normalizeFsPath, flattenTree, isInScope, formatFileSize } from "./util";

const TOOL_NAME = "fs_ls" as const;

const schema = z.object({
	path: z
		.string()
		.optional()
		.describe('Directory path to list (default: "/")'),
	recursive: z
		.boolean()
		.optional()
		.describe("List all subdirectory contents recursively (default: false)"),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

export const createFsLsTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"List files and directories. Without recursive, shows only immediate children. With recursive: true, shows the full subtree.",
	schema,
	execute: async (input) => {
		const { path = "/", recursive = false } = input;

		const dfs = services.documentFileSystem;
		if (!dfs) return "Error: documentFileSystem service not available.";

		const dirPath = normalizeFsPath(path);
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);

		// Verify path exists and is a directory (or is root)
		if (dirPath !== "/") {
			const dirNode = allNodes.find((n) => n.path === dirPath);
			if (!dirNode) return `Error: Path not found: ${path}`;
			if (dirNode.type !== "folder")
				return `Error: Path is not a directory: ${path}`;
		}

		const candidates = allNodes.filter(
			(n) => n.path !== dirPath && isInScope(n.path, dirPath),
		);

		// For non-recursive mode, keep only direct children
		const items = recursive
			? candidates
			: candidates.filter((n) => {
					const rel =
						dirPath === "/"
							? n.path.slice(1)
							: n.path.slice(dirPath.length + 1);
					return !rel.includes("/");
				});

		if (items.length === 0) {
			return `Empty directory: ${dirPath}`;
		}

		const lines = items.map((n) => {
			if (n.type === "folder") {
				return `${n.path}/`;
			}
			const sizeStr =
				n.file?.size !== undefined
					? `  (${formatFileSize(n.file.size)})`
					: "";
			return `${n.path}${sizeStr}`;
		});

		return `${lines.length} item${lines.length !== 1 ? "s" : ""} in ${dirPath}:\n${lines.join("\n")}`;
	},
});

toolRegistry.register(TOOL_NAME, createFsLsTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
