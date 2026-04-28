/** Step input/output field definition */
export interface StepIOField {
	name: string;
	type: string;
	required?: boolean;
	description?: string;
}

export interface FeatureIcon {
	/** Lucide icon component name (e.g. "Globe") or an emoji character (e.g. "🌐"). */
	name: string;
	type: "emoji" | "lucide";
}

export interface FeatureCatalogMetadata extends Record<string, unknown> {
	description: string;
	/** i18n key for the description. UI prefers this over `description`. */
	descriptionKey?: string;
	/** Human-readable display name (English). */
	displayName?: string;
	/** i18n key for the display name. UI prefers this over `displayName`. */
	nameKey?: string;
	tools: string[];
	systemPrompt: string;
	customizable: boolean;
	/** Icon shown in the feature card. */
	icon?: FeatureIcon;
	/** Mark this feature as the recommended choice. */
	recommended?: boolean;
	/** Mark this feature as legacy — prefer a newer alternative. */
	legacy?: boolean;
}

export interface FeatureCatalogStep {
	id: string;
	name: string;
	type: "feature";
	/** Graph flow types that include this step. */
	graphTypes?: string[];
	inputs?: StepIOField[];
	outputs?: StepIOField[];
	metadata: FeatureCatalogMetadata;
}

/** Common inputs shared by every feature step. */
export const FEATURE_DEFAULT_INPUTS: StepIOField[] = [
	{
		name: "messages",
		type: "Message[]",
		required: true,
		description: "Current chat messages",
	},
	{
		name: "tools",
		type: "Tool[]",
		required: true,
		description: "Current available tools",
	},
];

/** Common outputs shared by every feature step. */
export const FEATURE_DEFAULT_OUTPUTS: StepIOField[] = [
	{
		name: "messages",
		type: "Message[]",
		description: "Messages updated by the feature.",
	},
	{
		name: "tools",
		type: "Tool[]",
		description: "Tools extended by the feature.",
	},
];

const entries: FeatureCatalogStep[] = [];

export const featureCatalogRegistry = {
	register(entry: FeatureCatalogStep): void {
		entries.push(entry);
	},
	getAll(): FeatureCatalogStep[] {
		return entries;
	},
};
