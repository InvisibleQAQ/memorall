export interface DefaultSkillManifestEntry {
	name: string;
	description: string;
	publisher: string;
	collection: string;
	repo: string;
	sourceUrl: string;
	/** Remote raw URL to fetch skill body from. Omit when `body` is provided. */
	rawUrl?: string;
	/** Inline skill body — skips remote fetch when present. */
	body?: string;
}
