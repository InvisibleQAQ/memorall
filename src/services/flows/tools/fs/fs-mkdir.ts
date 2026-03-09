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
	wsDisplayToLogicalPath,
	WORKSPACE_PREFIX,
	stripDocumentsPrefix,
} from "./util";

const TOOL_NAME = "fs_mkdir" as const;

const schema = z.object({
	path: z.string().describe("Directory path to create"),
	recursive: z
		.boolean()
		.optional()
		.describe(
			"Create all missing parent directories automatically (default: true)",
		),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

export const createFsMkdirTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Create a directory. By default creates all missing parent directories. Does nothing if the directory already exists.",
	schema,
	execute: async (input) => {
		const { path, recursive = true } = input;

		const dfs = services.documentFileSystem;
		if (!dfs) return "Error: documentFileSystem service not available.";

		const dirPath = normalizeFsPath(path);

		if (isWorkspacePath(dirPath)) {
			if (dirPath === WORKSPACE_PREFIX) {
				return "Error: Cannot create the workspace root.";
			}

			const wsLogical = wsDisplayToLogicalPath(dirPath);
			const tree = await dfs.getWorkspaceTree();
			const allNodes = flattenTree(tree);

			const existing = allNodes.find((n) => n.path === wsLogical);
			if (existing) {
				if (existing.type === "folder")
					return `Directory already exists: ${dirPath}`;
				return `Error: Path exists but is not a directory: ${dirPath}`;
			}

			// mkdirWorkspace always creates parent directories
			await dfs.mkdirWorkspace(dirPath);
			return `Created directory: ${dirPath}`;
		}

		// Document namespace
		const docPath = stripDocumentsPrefix(dirPath);

		if (docPath === "/") {
			return "Error: Cannot create the root directory.";
		}

		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);

		// Check if already exists
		const existing = allNodes.find((n) => n.path === docPath);
		if (existing) {
			if (existing.type === "folder") {
				return `Directory already exists: ${docPath}`;
			}
			return `Error: Path exists but is not a directory: ${docPath}`;
		}

		const segments = docPath.split("/").filter(Boolean);

		if (recursive) {
			// Create each missing segment from root down
			let currentPath = "/";
			for (const segment of segments) {
				const segPath =
					currentPath === "/" ? `/${segment}` : `${currentPath}/${segment}`;
				const exists = allNodes.some(
					(n) => n.path === segPath && n.type === "folder",
				);
				if (!exists) {
					await dfs.createFolder(segment, currentPath);
					// Push a stub so subsequent iterations see it as existing
					allNodes.push({
						id: segPath,
						name: segment,
						path: segPath,
						type: "folder",
						isExpanded: false,
						children: [],
					});
				}
				currentPath = segPath;
			}
		} else {
			// Non-recursive: parent must already exist
			const parentPath =
				segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : "/";
			const parentExists =
				parentPath === "/" ||
				allNodes.some((n) => n.path === parentPath && n.type === "folder");
			if (!parentExists) {
				return `Error: Parent directory does not exist: ${parentPath}. Use recursive: true to create it.`;
			}
			const folderName = segments.at(-1)!;
			await dfs.createFolder(folderName, parentPath);
		}

		return `Created directory: ${docPath}`;
	},
});

toolRegistry.register(TOOL_NAME, createFsMkdirTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
