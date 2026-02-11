import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import type { DocumentTreeNode } from "@/types/document-library";
import { normalizeDocumentPath } from "./util";

const TOOL_NAME = "doc_remove" as const;

const schema = z.object({
	path: z.string().describe("File or folder path to delete"),
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

export const createDocRemoveTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Delete a document file or folder. Folders are deleted recursively.",
	schema,
	execute: async (input) => {
		const { path } = input;
		const filePath = normalizeDocumentPath(path);

		const dfs = services.documentFileSystem;
		if (!dfs) {
			return "Documents not existe.";
		}
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);
		const node = allNodes.find((n) => n.path === filePath);

		if (!node) {
			return `Error: Path not found: ${filePath}`;
		}

		if (node.type === "file") {
			await dfs.deleteFile(node.path);
			return `Deleted file: ${filePath}`;
		}

		await dfs.deleteFolder(node.path);
		return `Deleted folder: ${filePath}`;
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createDocRemoveTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
