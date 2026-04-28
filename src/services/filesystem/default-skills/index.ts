import { ALIREZAREZVANI_DEFAULT_SKILLS } from "./alirezarezvani";
import { ANTHROPIC_DEFAULT_SKILLS } from "./anthropic";
import { BUNDLED_DEFAULT_SKILLS } from "./bundled";
import { SECONDSKY_DEFAULT_SKILLS } from "./secondsky";
import type { DefaultSkillManifestEntry } from "./types";

const DEFAULT_SKILLS_LOGICAL_ROOT = "/skills/default";
const DEFAULT_SKILL_MANIFEST = [
	...ANTHROPIC_DEFAULT_SKILLS,
	...SECONDSKY_DEFAULT_SKILLS,
	...ALIREZAREZVANI_DEFAULT_SKILLS,
	...BUNDLED_DEFAULT_SKILLS,
];

const defaultSkillIndex = new Map(
	DEFAULT_SKILL_MANIFEST.map((entry) => [entry.name, entry]),
);
const defaultSkillCache = new Map<string, Promise<DefaultSkill>>();

export interface DefaultSkillSummary {
	name: string;
	description: string;
	path: string;
	publisher: string;
	collection: string;
	repo: string;
	sourceUrl: string;
	origin: "default";
	readOnly: true;
}

export interface DefaultSkill extends DefaultSkillSummary {
	body: string;
}

const toSummary = (entry: DefaultSkillManifestEntry): DefaultSkillSummary => ({
	name: entry.name,
	description: entry.description,
	path: `${DEFAULT_SKILLS_LOGICAL_ROOT}/${entry.name}.md`,
	publisher: entry.publisher,
	collection: entry.collection,
	repo: entry.repo,
	sourceUrl: entry.sourceUrl,
	origin: "default",
	readOnly: true,
});

const stripFrontmatter = (raw: string): string => {
	const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
	return match ? match[1].trim() : raw.trim();
};

export const listDefaultSkills = (): DefaultSkillSummary[] =>
	DEFAULT_SKILL_MANIFEST.map(toSummary);

export const hasDefaultSkill = (name: string): boolean =>
	defaultSkillIndex.has(name);

export const readDefaultSkill = async (
	name: string,
): Promise<DefaultSkill | null> => {
	const manifestEntry = defaultSkillIndex.get(name);
	if (!manifestEntry) return null;

	const cached = defaultSkillCache.get(name);
	if (cached) {
		return cached;
	}

	const pendingSkill = (async () => {
		if (manifestEntry.body !== undefined) {
			return {
				...toSummary(manifestEntry),
				body: manifestEntry.body,
			};
		}

		const response = await fetch(manifestEntry.rawUrl!);
		if (!response.ok) {
			throw new Error(
				`Failed to load default skill "${name}" from ${manifestEntry.repo}: HTTP ${response.status}`,
			);
		}

		const text = await response.text();
		return {
			...toSummary(manifestEntry),
			body: stripFrontmatter(text),
		};
	})();

	defaultSkillCache.set(name, pendingSkill);

	try {
		return await pendingSkill;
	} catch (error) {
		defaultSkillCache.delete(name);
		throw error;
	}
};
