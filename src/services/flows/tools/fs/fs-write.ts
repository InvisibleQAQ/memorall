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
	isWorkspacePath,
	stripDocumentsPrefix,
} from "./util";

const TOOL_NAME = "fs_write" as const;

const schema = z.object({
	file_path: z.string().describe("Path of the file to create or overwrite"),
	content: z.string().describe("Text content to write"),
	create_dirs: z
		.boolean()
		.optional()
		.describe(
			"Auto-create parent directories if they do not exist (default: true)",
		),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

export const createFsWriteTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Create or overwrite a text file. If the file exists its content is replaced. Parent directories are created automatically by default.",
	schema,
	execute: async (input) => {
		const { file_path, content, create_dirs = true } = input;

		const dfs = services.documentFileSystem;
		if (!dfs) return "Error: documentFileSystem service not available.";

		const filePath = normalizeFsPath(file_path);

		if (isWorkspacePath(filePath)) {
			// writeWorkspaceFile always creates parent directories
			await dfs.writeWorkspaceFile(filePath, content);
			return `Written file: ${filePath} (${content.length} characters)`;
		}

		// Document namespace
		const docPath = stripDocumentsPrefix(filePath);
		const lastSlash = docPath.lastIndexOf("/");
		const parentPath = lastSlash > 0 ? docPath.slice(0, lastSlash) : "/";
		const fileName = docPath.slice(lastSlash + 1);

		if (!fileName) {
			return `Error: Invalid file path — no filename provided: ${file_path}`;
		}

		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);
		const existingNode = allNodes.find(
			(n) => n.path === docPath && n.type === "file",
		);

		const encoded = new TextEncoder().encode(content);

		if (existingNode) {
			await dfs.updateFileContent(docPath, encoded);
			return `Updated file: ${docPath} (${content.length} characters)`;
		}

		// Create parent folders if needed
		if (create_dirs && parentPath !== "/") {
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

		return `Created file: ${docPath} (${content.length} characters)`;
	},
});

toolRegistry.register(TOOL_NAME, createFsWriteTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
