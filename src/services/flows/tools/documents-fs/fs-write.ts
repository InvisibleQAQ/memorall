import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { normalizeFsPath, flattenTree } from "./util";

const TOOL_NAME = "document_fs_write" as const;

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
		"Create or overwrite a text file. If the file exists its content is replaced. Parent directories are created automatically by default. After using this tool, assistant messages should mention only the created or updated file path, not the file content.",
	schema,
	execute: async (input) => {
		const { file_path, content, create_dirs = true } = input;

		const dfs = services.documentFileSystem;
		if (!dfs) return "Error: documentFileSystem service not available.";

		const filePath = normalizeFsPath(file_path);
		const lastSlash = filePath.lastIndexOf("/");
		const parentPath = lastSlash > 0 ? filePath.slice(0, lastSlash) : "/";
		const fileName = filePath.slice(lastSlash + 1);

		if (!fileName) {
			return `Error: Invalid file path — no filename provided: ${file_path}`;
		}

		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);
		const existingNode = allNodes.find(
			(n) => n.path === filePath && n.type === "file",
		);

		const encoded = new TextEncoder().encode(content);

		if (existingNode) {
			await dfs.updateFileContent(filePath, encoded);
			return `Updated file: ${filePath} (${content.length} characters)`;
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

		return `Created file: ${filePath} (${content.length} characters)`;
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
