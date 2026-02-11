import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import type { DocumentTreeNode } from "@/types/document-library";
import { normalizeDocumentPath } from "./util";

const TOOL_NAME = "doc_write" as const;

const schema = z.object({
	file_path: z.string().describe("Target file path"),
	content: z.string().describe("Text content to write"),
	create_folders: z
		.boolean()
		.optional()
		.describe("Auto-create parent folders (default: true)"),
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

export const createDocWriteTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Create or overwrite a document file. If the file exists, updates its content. If new, creates it (with parent folders by default). Only supports text-based files; PDF/Excel are not supported for writing.",
	schema,
	execute: async (input) => {
		const { file_path, content, create_folders = true } = input;
		const filePath = normalizeDocumentPath(file_path);

		const dfs = services.documentFileSystem;
		if (!dfs) {
			return "Documents not existe.";
		}
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);
		const existingNode = allNodes.find(
			(n) => n.path === filePath && n.type === "file",
		);

		const lowerPath = filePath.toLowerCase();
		const isPdfPath = lowerPath.endsWith(".pdf");
		const isExcelPath =
			lowerPath.endsWith(".xls") ||
			lowerPath.endsWith(".xlsx") ||
			lowerPath.endsWith(".xlsm");

		if (existingNode) {
			const fileType = existingNode.file?.type;
			if (fileType === "pdf" || fileType === "excel") {
				return `Error: Writing ${fileType.toUpperCase()} files is not supported yet: ${file_path}`;
			}
			// Update existing file
			const encoded = new TextEncoder().encode(content);
			await dfs.updateFileContent(filePath, encoded);
			return `Updated file: ${filePath} (${content.length} characters)`;
		}

		if (isPdfPath || isExcelPath) {
			return `Error: Writing PDF/Excel files is not supported yet: ${file_path}`;
		}

		// Create new file
		const lastSlash = filePath.lastIndexOf("/");
		const parentPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : "/";
		const fileName = filePath.substring(lastSlash + 1);

		if (!fileName) {
			return "Error: Invalid file path - no filename provided";
		}

		// Create parent folders if needed
		if (create_folders && parentPath !== "/") {
			const segments = parentPath.split("/").filter(Boolean);
			let currentPath = "/";
			for (const segment of segments) {
				const folderPath =
					currentPath === "/" ? `/${segment}` : `${currentPath}/${segment}`;
				const folderExists = allNodes.some(
					(n) => n.path === folderPath && n.type === "folder",
				);
				if (!folderExists) {
					await dfs.createFolder(segment, currentPath);
				}
				currentPath = folderPath;
			}
		}

		const file = new File([content], fileName, { type: "text/plain" });
		await dfs.uploadFile(file, parentPath);

		return `Created file: ${filePath} (${content.length} characters)`;
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createDocWriteTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
