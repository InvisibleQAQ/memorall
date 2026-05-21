import { FILESYSTEM_MOUNT_PATH } from "@/services/filesystem/filesystem-paths";

/** Strip trailing slashes for consistent path handling. */
const normalize = (p: string): string =>
	p.trim().replace(/\\/g, "/").replace(/\/+$/, "");

const INTERNAL_WORKSPACE_LEGACY_PREFIX = `/home/${FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY}`;
const INTERNAL_WORKSPACE_PREFIX = `/home/${FILESYSTEM_MOUNT_PATH.WORKSPACES}`;

/** Normalize project paths into the public workspace namespace. */
export const normalizeProjectPath = (projectPath: string): string => {
	const normalized = normalize(projectPath);
	if (!normalized) return FILESYSTEM_MOUNT_PATH.WORKSPACES;
	if (normalized === INTERNAL_WORKSPACE_PREFIX)
		return FILESYSTEM_MOUNT_PATH.WORKSPACES;
	if (normalized.startsWith(`${INTERNAL_WORKSPACE_PREFIX}/`)) {
		return `${FILESYSTEM_MOUNT_PATH.WORKSPACES}${normalized.slice(
			INTERNAL_WORKSPACE_PREFIX.length,
		)}`;
	}

	if (normalized === INTERNAL_WORKSPACE_LEGACY_PREFIX)
		return FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY;
	if (normalized.startsWith(`${INTERNAL_WORKSPACE_LEGACY_PREFIX}/`)) {
		return `${FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY}${normalized.slice(
			INTERNAL_WORKSPACE_LEGACY_PREFIX.length,
		)}`;
	}

	if (normalized === FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY)
		return FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY;
	if (normalized.startsWith(`${FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY}/`)) {
		return `${FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY}${normalized.slice(
			FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY.length,
		)}`;
	}
	if (normalized === FILESYSTEM_MOUNT_PATH.WORKSPACES)
		return FILESYSTEM_MOUNT_PATH.WORKSPACES;
	if (normalized.startsWith(`${FILESYSTEM_MOUNT_PATH.WORKSPACES}/`))
		return `${FILESYSTEM_MOUNT_PATH.WORKSPACES}${normalized.slice(FILESYSTEM_MOUNT_PATH.WORKSPACES.length)}`;
	return `${FILESYSTEM_MOUNT_PATH.WORKSPACES}/${normalized.replace(/^\/+/, "")}`;
};

/** The composition HTML file inside a project directory. */
export const compositionFile = (projectPath: string): string =>
	`${normalizeProjectPath(projectPath)}/index.html`;
