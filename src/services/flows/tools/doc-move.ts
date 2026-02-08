import z from "zod";
import type { Tool, ToolFactory, AllServices } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import type { DocumentTreeNode } from "@/types/document-library";

const TOOL_NAME = "doc_move" as const;

const schema = z
	.object({
		source_path: z.string().describe("Current file or folder path"),
		new_name: z.string().optional().describe("New name (rename mode)"),
		target_folder: z
			.string()
			.optional()
			.describe("Destination folder path (move mode)"),
	})
	.refine((data) => data.new_name || data.target_folder, {
		message: "At least one of new_name or target_folder must be provided",
	});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

function flattenTree(nodes: DocumentTreeNode[]): DocumentTreeNode[] {
	const result: DocumentTreeNode[] = [];
	for (const node of nodes) {
		result.push(node);
		if (node.children?.length) {
			result.push(...flattenTree(node.children));
		}
	}
	return result;
}

export const createDocMoveTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Move or rename a document file or folder. Provide new_name to rename, target_folder to move, or both to move and rename.",
	schema,
	execute: async (input) => {
		const { source_path, new_name, target_folder } = input;

		const dfs = services.documentFileSystem;
		if (!dfs) {
			return 'Documents not existe.'
		}
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);
		const node = allNodes.find((n) => n.path === source_path);

		if (!node) {
			return `Error: Path not found: ${source_path}`;
		}

		const isFile = node.type === "file";
		let currentPath = source_path;
		const actions: string[] = [];

		// Move first (if target_folder provided)
		if (target_folder) {
			if (isFile) {
				const result = await dfs.moveFile(currentPath, target_folder);
				currentPath = result.path;
			} else {
				const result = await dfs.moveFolder(currentPath, target_folder);
				currentPath = result.path;
			}
			actions.push(`moved to ${target_folder}`);
		}

		// Then rename (if new_name provided)
		if (new_name) {
			if (isFile) {
				const result = await dfs.renameFile(currentPath, new_name);
				currentPath = result.path;
			} else {
				const result = await dfs.renameFolder(currentPath, new_name);
				currentPath = result.path;
			}
			actions.push(`renamed to "${new_name}"`);
		}

		return `${isFile ? "File" : "Folder"} ${source_path}: ${actions.join(", ")} → ${currentPath}`;
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createDocMoveTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
