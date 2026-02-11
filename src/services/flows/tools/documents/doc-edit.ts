import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import type { DocumentTreeNode, DocumentType } from "@/types/document-library";
import { normalizeDocumentPath } from "./util";

const TOOL_NAME = "doc_edit" as const;

const schema = z.object({
	file_path: z.string().describe("File to edit"),
	old_string: z.string().describe("Text to find"),
	new_string: z.string().describe("Replacement text"),
	replace_all: z
		.boolean()
		.optional()
		.describe("Replace all occurrences (default: false)"),
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

function isTextFile(type: DocumentType): boolean {
	return type === "text" || type === "markdown" || type === "other";
}

export const createDocEditTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Edit a document file by replacing text. Finds old_string in the file and replaces it with new_string. Only works on text-based files.",
	schema,
	execute: async (input) => {
		const { file_path, old_string, new_string, replace_all = false } = input;
		const filePath = normalizeDocumentPath(file_path);

		const dfs = services.documentFileSystem;
		if (!dfs) {
			return "Documents not existe.";
		}
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);
		const node = allNodes.find((n) => n.path === filePath && n.type === "file");

		if (!node || !node.file) {
			return `Error: File not found: ${filePath}`;
		}

		if (!isTextFile(node.file.type)) {
			return `Error: Cannot edit binary file (${node.file.type}): ${file_path}. Only text, markdown, and other text-based files can be edited.`;
		}

		const content = await dfs.getFileContent(filePath);
		const text = new TextDecoder().decode(content);

		if (!text.includes(old_string)) {
			return `Error: old_string not found in ${filePath}`;
		}

		let newText: string;
		let count: number;

		if (replace_all) {
			// Count occurrences
			count = text.split(old_string).length - 1;
			newText = text.split(old_string).join(new_string);
		} else {
			count = 1;
			newText = text.replace(old_string, new_string);
		}

		const encoded = new TextEncoder().encode(newText);
		await dfs.updateFileContent(filePath, encoded);

		return `Edited ${filePath}: ${count} replacement${count !== 1 ? "s" : ""} made`;
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createDocEditTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
