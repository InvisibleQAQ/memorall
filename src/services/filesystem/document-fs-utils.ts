import type { DocumentFileSystem } from "@/services/filesystem/document-filesystem";

export const ensureFolderExists = async (
	dfs: DocumentFileSystem,
	folderPath: string,
): Promise<void> => {
	if (folderPath === "/" || !folderPath) return;
	const segments = folderPath.split("/").filter(Boolean);
	let currentPath = "/";
	for (const segment of segments) {
		const nextPath = `${currentPath === "/" ? "" : currentPath}/${segment}`;
		try {
			await dfs.createFolder(segment, currentPath);
		} catch {
			// Folder likely already exists — continue.
		}
		currentPath = nextPath;
	}
};
