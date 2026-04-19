import fs, { initializeFs } from "@/services/filesystem/fs";
import { logError, logInfo } from "@/utils/logger";

const SKILLS_FS_ROOT = "/home/documents/skills";
const SKILLS_LOGICAL_ROOT = "/skills";

export interface SkillSummary {
	name: string;
	description: string;
	path: string;
}

export interface Skill extends SkillSummary {
	/** Body content only — frontmatter is stripped */
	body: string;
}

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

interface FrontmatterResult {
	meta: Record<string, string>;
	body: string;
}

function parseFrontmatter(raw: string): FrontmatterResult {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return { meta: {}, body: raw.trim() };

	const meta: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx > 0) {
			const key = line.slice(0, colonIdx).trim();
			const value = line.slice(colonIdx + 1).trim();
			if (key) meta[key] = value;
		}
	}

	return { meta, body: match[2].trim() };
}

function buildContent(name: string, description: string, body: string): string {
	return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;
}

function filenameToName(filename: string): string {
	return filename.replace(/\.md$/i, "");
}

function nameToFilename(name: string): string {
	// Sanitize: lowercase, replace spaces/special chars with hyphens
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-_]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function toRawGithubUrl(url: string): string {
	// Already a raw URL
	if (url.includes("raw.githubusercontent.com")) return url;

	// Convert github.com blob URL to raw
	// https://github.com/user/repo/blob/branch/path → https://raw.githubusercontent.com/user/repo/branch/path
	const match = url.match(
		/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/,
	);
	if (match) {
		return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`;
	}

	throw new Error(
		"Unsupported URL format. Use a GitHub file URL (github.com/.../blob/...) or raw URL (raw.githubusercontent.com).",
	);
}

function rawUrlToName(rawUrl: string): string {
	const parts = rawUrl.split("/");
	const filename = parts[parts.length - 1] ?? "skill";
	return filenameToName(filename);
}

// ---------------------------------------------------------------------------
// SkillFileSystem
// ---------------------------------------------------------------------------

export class SkillFileSystem {
	private static instance: SkillFileSystem;
	private initialized = false;

	private constructor() {}

	static getInstance(): SkillFileSystem {
		if (!SkillFileSystem.instance) {
			SkillFileSystem.instance = new SkillFileSystem();
		}
		return SkillFileSystem.instance;
	}

	private async initialize(): Promise<void> {
		if (this.initialized) return;
		await initializeFs();
		await this.ensureDir(SKILLS_FS_ROOT);
		this.initialized = true;
	}

	private async ensureDir(path: string): Promise<void> {
		try {
			await fs.promises.mkdir(path, { recursive: true });
		} catch (err) {
			const e = err as { code?: string };
			if (e.code !== "EEXIST") throw err;
		}
	}

	private fsPath(name: string): string {
		return `${SKILLS_FS_ROOT}/${nameToFilename(name)}.md`;
	}

	private logicalPath(name: string): string {
		return `${SKILLS_LOGICAL_ROOT}/${nameToFilename(name)}.md`;
	}

	/**
	 * List all skills (reads only frontmatter — efficient for large skill sets).
	 */
	async listSkills(): Promise<SkillSummary[]> {
		await this.initialize();

		let entries: string[];
		try {
			entries = await fs.promises.readdir(SKILLS_FS_ROOT);
		} catch {
			return [];
		}

		const results: SkillSummary[] = [];

		for (const entry of entries) {
			if (!entry.endsWith(".md")) continue;

			try {
				const raw = await fs.promises.readFile(`${SKILLS_FS_ROOT}/${entry}`);
				const text = new TextDecoder().decode(raw);
				const { meta } = parseFrontmatter(text);
				const name = meta.name ?? filenameToName(entry);
				results.push({
					name,
					description: meta.description ?? "",
					path: `${SKILLS_LOGICAL_ROOT}/${entry}`,
				});
			} catch (err) {
				logError(`Failed to read skill ${entry}:`, err);
			}
		}

		return results;
	}

	/**
	 * Read a full skill by name (includes body content).
	 */
	async readSkill(name: string): Promise<Skill> {
		await this.initialize();

		const path = this.fsPath(name);
		let raw: Uint8Array;

		try {
			raw = await fs.promises.readFile(path);
		} catch {
			throw new Error(`Skill not found: ${name}`);
		}

		const text = new TextDecoder().decode(raw);
		const { meta, body } = parseFrontmatter(text);
		const resolvedName = meta.name ?? name;

		return {
			name: resolvedName,
			description: meta.description ?? "",
			body,
			path: this.logicalPath(name),
		};
	}

	/**
	 * Create or overwrite a skill. Caller provides name, description, and body separately;
	 * frontmatter is built internally.
	 */
	async writeSkill(
		name: string,
		description: string,
		body: string,
	): Promise<SkillSummary> {
		await this.initialize();

		const sanitized = nameToFilename(name);
		if (!sanitized) throw new Error("Invalid skill name");

		const content = buildContent(name, description, body);
		const path = `${SKILLS_FS_ROOT}/${sanitized}.md`;
		await fs.promises.writeFile(path, new TextEncoder().encode(content));

		logInfo(`Skill written: ${path}`);

		return {
			name,
			description,
			path: this.logicalPath(name),
		};
	}

	/**
	 * Delete a skill by name.
	 */
	async deleteSkill(name: string): Promise<void> {
		await this.initialize();

		const path = this.fsPath(name);
		try {
			await fs.promises.unlink(path);
			logInfo(`Skill deleted: ${path}`);
		} catch {
			throw new Error(`Skill not found: ${name}`);
		}
	}

	/**
	 * Fetch a skill file from a GitHub URL and save it.
	 * Accepts github.com blob URLs or raw.githubusercontent.com URLs.
	 */
	async importFromGithub(url: string): Promise<SkillSummary> {
		const rawUrl = toRawGithubUrl(url.trim());

		let text: string;
		try {
			const response = await fetch(rawUrl);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			text = await response.text();
		} catch (err) {
			throw new Error(
				`Failed to fetch from GitHub: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		const { meta, body } = parseFrontmatter(text);
		const name = meta.name ?? rawUrlToName(rawUrl);
		const description = meta.description ?? "";

		return this.writeSkill(name, description, body);
	}
}

export const skillFileSystemService = SkillFileSystem.getInstance();
