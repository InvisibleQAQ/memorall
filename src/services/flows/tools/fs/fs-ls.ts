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
	isInScope,
	formatFileSize,
	isWorkspacePath,
	wsNodeToDisplayPath,
	wsDisplayToLogicalPath,
	stripDocumentsPrefix,
} from "./util";

const TOOL_NAME = "fs_ls" as const;

const schema = z.object({
	path: z.string().optional().describe('Directory path to list (default: "/")'),
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

		if (isWorkspacePath(dirPath)) {
			const wsLogical = wsDisplayToLogicalPath(dirPath);
			const tree = await dfs.getWorkspaceTree();
			const allNodes = flattenTree(tree);

			if (wsLogical !== "/") {
				const dirNode = allNodes.find((n) => n.path === wsLogical);
				if (!dirNode) return `Error: Path not found: ${dirPath}`;
				if (dirNode.type !== "folder")
					return `Error: Path is not a directory: ${dirPath}`;
			}

			const candidates = allNodes.filter(
				(n) => n.path !== wsLogical && isInScope(n.path, wsLogical),
			);

			const items = recursive
				? candidates
				: candidates.filter((n) => {
						const rel =
							wsLogical === "/"
								? n.path.slice(1)
								: n.path.slice(wsLogical.length + 1);
						return !rel.includes("/");
					});

			if (items.length === 0) {
				return `Empty directory: ${dirPath}`;
			}

			const lines = items.map((n) => {
				const displayPath = wsNodeToDisplayPath(n.path);
				if (n.type === "folder") return `${displayPath}/`;
				const sizeStr =
					n.file?.size !== undefined
						? `  (${formatFileSize(n.file.size)})`
						: "";
				return `${displayPath}${sizeStr}`;
			});

			return `${lines.length} item${lines.length !== 1 ? "s" : ""} in ${dirPath}:\n${lines.join("\n")}`;
		}

		// Document namespace (bare paths or /documents/... prefix)
		const docPath = stripDocumentsPrefix(dirPath);
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);

		if (docPath !== "/") {
			const dirNode = allNodes.find((n) => n.path === docPath);
			if (!dirNode) return `Error: Path not found: ${path}`;
			if (dirNode.type !== "folder")
				return `Error: Path is not a directory: ${path}`;
		}

		const candidates = allNodes.filter(
			(n) => n.path !== docPath && isInScope(n.path, docPath),
		);

		const items = recursive
			? candidates
			: candidates.filter((n) => {
					const rel =
						docPath === "/"
							? n.path.slice(1)
							: n.path.slice(docPath.length + 1);
					return !rel.includes("/");
				});

		if (items.length === 0) {
			return `Empty directory: ${docPath}`;
		}

		const lines = items.map((n) => {
			if (n.type === "folder") {
				return `${n.path}/`;
			}
			const sizeStr =
				n.file?.size !== undefined ? `  (${formatFileSize(n.file.size)})` : "";
			return `${n.path}${sizeStr}`;
		});

		return `${lines.length} item${lines.length !== 1 ? "s" : ""} in ${docPath}:\n${lines.join("\n")}`;
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
