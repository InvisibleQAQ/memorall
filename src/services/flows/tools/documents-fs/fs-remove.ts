import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { normalizeFsPath, flattenTree } from "./util";

const TOOL_NAME = "document_fs_remove" as const;

const schema = z.object({
	path: z.string().describe("Path of the file or directory to delete"),
	recursive: z
		.boolean()
		.optional()
		.describe(
			"Delete a directory and all its contents recursively (required for non-empty directories, default: false)",
		),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

export const createFsRemoveTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Delete a file or directory. For non-empty directories, set recursive: true to delete all contents.",
	schema,
	execute: async (input) => {
		const { path, recursive = false } = input;

		const dfs = services.documentFileSystem;
		if (!dfs) return "Error: documentFileSystem service not available.";

		const targetPath = normalizeFsPath(path);
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);
		const node = allNodes.find((n) => n.path === targetPath);

		if (!node) {
			return `Error: Path not found: ${path}`;
		}

		if (node.type === "file") {
			await dfs.deleteFile(targetPath);
			return `Deleted file: ${targetPath}`;
		}

		if (node.type === "folder") {
			// Check for children if non-recursive
			if (!recursive) {
				const hasChildren = allNodes.some(
					(n) => n.path !== targetPath && n.path.startsWith(`${targetPath}/`),
				);
				if (hasChildren) {
					return `Error: Directory is not empty — use recursive: true to delete it: ${targetPath}`;
				}
			}
			await dfs.deleteFolder(targetPath);
			return `Deleted directory${recursive ? " (recursive)" : ""}: ${targetPath}`;
		}

		return `Error: Unknown node type at: ${targetPath}`;
	},
});

toolRegistry.register(TOOL_NAME, createFsRemoveTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
