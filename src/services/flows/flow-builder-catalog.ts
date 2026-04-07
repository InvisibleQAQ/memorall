import {
	DOCUMENTS_FEATURE_DESCRIPTION,
	DOCUMENTS_FEATURE_NAME,
	DOCUMENTS_FEATURE_SYSTEM_PROMPT,
	DOCUMENTS_FEATURE_TOOLS,
} from "./steps/features/documents-feature";
import {
	DOCUMENTS_FS_FEATURE_DESCRIPTION,
	DOCUMENTS_FS_FEATURE_NAME,
	DOCUMENTS_FS_FEATURE_SYSTEM_PROMPT,
	DOCUMENTS_FS_FEATURE_TOOLS,
} from "./steps/features/documents-fs-feature";
import {
	FS_FEATURE_DESCRIPTION,
	FS_FEATURE_NAME,
	FS_FEATURE_SYSTEM_PROMPT,
	FS_FEATURE_TOOLS,
} from "./steps/features/fs-feature";
import {
	NODEJS_SANDBOX_FEATURE_DESCRIPTION,
	NODEJS_SANDBOX_FEATURE_NAME,
	NODEJS_SANDBOX_FEATURE_SYSTEM_PROMPT,
	NODEJS_SANDBOX_FEATURE_TOOLS,
} from "./steps/features/nodejs-sandbox-feature/nodejs-sandbox-feature.v2";
import {
	WEB_FEATURE_DESCRIPTION,
	WEB_FEATURE_NAME,
	WEB_FEATURE_SYSTEM_PROMPT,
	WEB_FEATURE_TOOLS,
} from "./steps/features/web-feature/web-feature.v3";
import {
	NEWS_COLLECTION_FEATURE_DESCRIPTION,
	NEWS_COLLECTION_FEATURE_NAME,
	NEWS_COLLECTION_FEATURE_SYSTEM_PROMPT,
	NEWS_COLLECTION_FEATURE_TOOLS,
} from "./steps/features/news-collection-feature";
import {
	TRAVEL_PLANNER_FEATURE_DESCRIPTION,
	TRAVEL_PLANNER_FEATURE_NAME,
	TRAVEL_PLANNER_FEATURE_SYSTEM_PROMPT,
	TRAVEL_PLANNER_FEATURE_TOOLS,
} from "./steps/features/travel-planner-feature";
import {
	MEAL_PLANNER_FEATURE_DESCRIPTION,
	MEAL_PLANNER_FEATURE_NAME,
	MEAL_PLANNER_FEATURE_SYSTEM_PROMPT,
	MEAL_PLANNER_FEATURE_TOOLS,
} from "./steps/features/meal-planner-feature";
import {
	DAILY_BRIEFING_FEATURE_DESCRIPTION,
	DAILY_BRIEFING_FEATURE_NAME,
	DAILY_BRIEFING_FEATURE_SYSTEM_PROMPT,
	DAILY_BRIEFING_FEATURE_TOOLS,
} from "./steps/features/daily-briefing-feature";
import {
	JOB_APPLICATION_FEATURE_DESCRIPTION,
	JOB_APPLICATION_FEATURE_NAME,
	JOB_APPLICATION_FEATURE_SYSTEM_PROMPT,
	JOB_APPLICATION_FEATURE_TOOLS,
} from "./steps/features/job-application-feature";
import {
	PLANNER_FEATURE_DESCRIPTION,
	PLANNER_FEATURE_NAME,
	PLANNER_FEATURE_SYSTEM_PROMPT,
	PLANNER_FEATURE_TOOLS,
} from "./steps/features/planner-feature";

/**
 * Flow Builder Catalog
 *
 * Defines the available step types and service types that can be used
 * when building flows. These are in-memory constants used for the UI palette,
 * NOT stored in the database.
 *
 * When a user places a step on the canvas, a FlowStep record is created
 * in the database with a reference to the step type name.
 */

/** Step input/output field definition */
export interface StepIOField {
	name: string;
	type: string;
	required?: boolean;
	description?: string;
}

/** Catalog service definition - available service types */
export interface CatalogService {
	id: string;
	name: string;
	type: string;
	serviceKey: string;
	metadata: Record<string, unknown>;
}

/** Catalog step definition - available step types */
export interface CatalogStep {
	id: string;
	name: string;
	type: string;
	/** Graph flow types that include this step (feature steps only). */
	graphTypes?: string[];
	inputs?: StepIOField[];
	outputs?: StepIOField[];
	metadata: Record<string, unknown>;
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
	/** Mark this feature as the recommended choice. */
	recommended?: boolean;
	/** Mark this feature as legacy — prefer a newer alternative. */
	legacy?: boolean;
}

/** In-memory catalog of available services */
export const DEFAULT_FLOW_SERVICES: CatalogService[] = [
	{
		id: "service-llm",
		name: "LLM",
		type: "llm",
		serviceKey: "llm",
		metadata: { description: "Large language model service" },
	},
	{
		id: "service-embedding",
		name: "Embedding",
		type: "embedding",
		serviceKey: "embedding",
		metadata: { description: "Embedding model service" },
	},
	{
		id: "service-database",
		name: "Database",
		type: "database",
		serviceKey: "database",
		metadata: { description: "Database service" },
	},
];

/** In-memory catalog of available step types */
export const DEFAULT_FLOW_STEPS: CatalogStep[] = [
	{
		id: "step-add-system",
		name: "add-system",
		type: "common",
		inputs: [
			{
				name: "messages",
				type: "Message[]",
				required: true,
				description: "Chat messages",
			},
			{
				name: "systemPrompt",
				type: "string",
				required: true,
				description: "System prompt to add",
			},
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description: "Messages with system prompt",
			},
		],
		metadata: { description: "Append system prompt" },
	},
	{
		id: "step-chat-completion",
		name: "chat-completion",
		type: "common",
		inputs: [
			{
				name: "messages",
				type: "Message[]",
				required: true,
				description: "Chat messages",
			},
			{
				name: "temperature",
				type: "number",
				description: "Sampling temperature",
			},
			{ name: "stream", type: "boolean", description: "Enable streaming" },
		],
		outputs: [
			{ name: "response", type: "string", description: "Generated response" },
		],
		metadata: { description: "Chat completion step" },
	},
	{
		id: "step-agent-completion",
		name: "agent-completion",
		type: "common",
		inputs: [
			{
				name: "messages",
				type: "Message[]",
				required: true,
				description: "Chat messages",
			},
			{ name: "tools", type: "Tool[]", description: "Available tools" },
			{
				name: "maxIterations",
				type: "number",
				description: "Max tool iterations",
			},
		],
		outputs: [
			{ name: "response", type: "string", description: "Agent response" },
		],
		metadata: { description: "Agent completion step with tool use" },
	},
	{
		id: "step-context-smart-retrieve",
		name: "context-smart-retrieve",
		type: "retrieval",
		inputs: [
			{
				name: "messages",
				type: "Message[]",
				required: true,
				description: "Chat messages",
			},
			{ name: "graphId", type: "string", description: "Knowledge graph ID" },
			{
				name: "contextQueries",
				type: "string[]",
				description: "Additional retrieval context queries",
			},
		],
		outputs: [
			{ name: "context", type: "string", description: "Built context for LLM" },
			{
				name: "nodeCount",
				type: "number",
				description: "Retrieved nodes count",
			},
			{
				name: "edgeCount",
				type: "number",
				description: "Retrieved edges count",
			},
		],
		metadata: {
			description: "Smart retrieval with context building",
			algorithm: "Semantic search + graph expansion + re-ranking",
		},
	},
	{
		id: "step-context-quick-retrieve",
		name: "context-quick-retrieve",
		type: "retrieval",
		inputs: [
			{
				name: "messages",
				type: "Message[]",
				required: true,
				description: "Chat messages",
			},
			{ name: "graphId", type: "string", description: "Knowledge graph ID" },
		],
		outputs: [
			{ name: "context", type: "string", description: "Built context for LLM" },
			{
				name: "nodeCount",
				type: "number",
				description: "Retrieved nodes count",
			},
			{
				name: "edgeCount",
				type: "number",
				description: "Retrieved edges count",
			},
		],
		metadata: {
			description: "Quick retrieval with context building",
			algorithm: "Semantic search + graph growth",
		},
	},
	{
		id: "step-fs-feature",
		name: FS_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description:
					"Messages with filesystem instructions for both namespaces",
			},
			{
				name: "tools",
				type: "Tool[]",
				description:
					"Tools extended with fs toolset (/documents + /workspaces)",
			},
		],
		metadata: {
			description: FS_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.fsFeature.description",
			displayName: "File System",
			nameKey: "flowBuilder.features.fsFeature.name",
			tools: [...FS_FEATURE_TOOLS],
			systemPrompt: FS_FEATURE_SYSTEM_PROMPT,
			customizable: false,
			recommended: true,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-documents-fs-feature",
		name: DOCUMENTS_FS_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description: "Messages with document filesystem instructions",
			},
			{
				name: "tools",
				type: "Tool[]",
				description: "Tools extended with fs toolset (v2)",
			},
		],
		metadata: {
			description: DOCUMENTS_FS_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.documentsFsFeature.description",
			displayName: "Documents File System",
			nameKey: "flowBuilder.features.documentsFsFeature.name",
			tools: [...DOCUMENTS_FS_FEATURE_TOOLS],
			systemPrompt: DOCUMENTS_FS_FEATURE_SYSTEM_PROMPT,
			customizable: false,
			recommended: true,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-documents-feature",
		name: DOCUMENTS_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description: "Messages with documents feature instruction",
			},
			{
				name: "tools",
				type: "Tool[]",
				description: "Tools extended with documents toolset",
			},
		],
		metadata: {
			description: `[LEGACY] ${DOCUMENTS_FEATURE_DESCRIPTION} Use "documents-fs-feature" instead.`,
			descriptionKey: "flowBuilder.features.documentsFeature.description",
			displayName: "Documents (Legacy)",
			nameKey: "flowBuilder.features.documentsFeature.name",
			tools: [...DOCUMENTS_FEATURE_TOOLS],
			systemPrompt: DOCUMENTS_FEATURE_SYSTEM_PROMPT,
			customizable: false,
			legacy: true,
			recommended: false,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-nodejs-sandbox-feature",
		name: NODEJS_SANDBOX_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description: "Messages with Node.js sandbox usage instruction",
			},
			{
				name: "tools",
				type: "Tool[]",
				description: "Tools extended with container toolset",
			},
		],
		metadata: {
			description: NODEJS_SANDBOX_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.nodejsSandboxFeature.description",
			displayName: "Node.js Sandbox",
			nameKey: "flowBuilder.features.nodejsSandboxFeature.name",
			tools: [...NODEJS_SANDBOX_FEATURE_TOOLS],
			systemPrompt: NODEJS_SANDBOX_FEATURE_SYSTEM_PROMPT,
			customizable: false,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-web-feature",
		name: WEB_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description: "Messages with web feature instructions.",
			},
			{
				name: "tools",
				type: "Tool[]",
				description: "Tools extended with web toolset.",
			},
		],
		metadata: {
			description: WEB_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.webFeature.description",
			displayName: "Web Browser",
			nameKey: "flowBuilder.features.webFeature.name",
			tools: [...WEB_FEATURE_TOOLS],
			systemPrompt: WEB_FEATURE_SYSTEM_PROMPT,
			customizable: false,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-news-collection-feature",
		name: NEWS_COLLECTION_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description:
					"Messages with news research instructions and open sessions.",
			},
			{
				name: "tools",
				type: "Tool[]",
				description: "Tools extended with web toolset for news browsing.",
			},
		],
		metadata: {
			description: NEWS_COLLECTION_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.newsCollectionFeature.description",
			displayName: "News Collection",
			nameKey: "flowBuilder.features.newsCollectionFeature.name",
			tools: [...NEWS_COLLECTION_FEATURE_TOOLS],
			systemPrompt: NEWS_COLLECTION_FEATURE_SYSTEM_PROMPT,
			customizable: false,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-travel-planner-feature",
		name: TRAVEL_PLANNER_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description:
					"Messages with travel planning instructions and open sessions.",
			},
			{
				name: "tools",
				type: "Tool[]",
				description:
					"Tools extended with web + doc toolset for travel research.",
			},
		],
		metadata: {
			description: TRAVEL_PLANNER_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.travelPlannerFeature.description",
			displayName: "Travel Planner",
			nameKey: "flowBuilder.features.travelPlannerFeature.name",
			tools: [...TRAVEL_PLANNER_FEATURE_TOOLS],
			systemPrompt: TRAVEL_PLANNER_FEATURE_SYSTEM_PROMPT,
			customizable: false,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-meal-planner-feature",
		name: MEAL_PLANNER_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description:
					"Messages with meal planning instructions and open sessions.",
			},
			{
				name: "tools",
				type: "Tool[]",
				description:
					"Tools extended with web + doc toolset for recipe research.",
			},
		],
		metadata: {
			description: MEAL_PLANNER_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.mealPlannerFeature.description",
			displayName: "Meal Planner",
			nameKey: "flowBuilder.features.mealPlannerFeature.name",
			tools: [...MEAL_PLANNER_FEATURE_TOOLS],
			systemPrompt: MEAL_PLANNER_FEATURE_SYSTEM_PROMPT,
			customizable: false,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-daily-briefing-feature",
		name: DAILY_BRIEFING_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description:
					"Messages with daily briefing instructions and open sessions.",
			},
			{
				name: "tools",
				type: "Tool[]",
				description:
					"Tools extended with web + knowledge_graph toolset for news research.",
			},
		],
		metadata: {
			description: DAILY_BRIEFING_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.dailyBriefingFeature.description",
			displayName: "Daily Briefing",
			nameKey: "flowBuilder.features.dailyBriefingFeature.name",
			tools: [...DAILY_BRIEFING_FEATURE_TOOLS],
			systemPrompt: DAILY_BRIEFING_FEATURE_SYSTEM_PROMPT,
			customizable: false,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-planner-feature",
		name: PLANNER_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description: "Messages with planner mode instructions.",
			},
			{
				name: "tools",
				type: "Tool[]",
				description: "Tools extended with planner toolset.",
			},
		],
		metadata: {
			description: PLANNER_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.plannerFeature.description",
			displayName: "Planner",
			nameKey: "flowBuilder.features.plannerFeature.name",
			tools: [...PLANNER_FEATURE_TOOLS],
			systemPrompt: PLANNER_FEATURE_SYSTEM_PROMPT,
			customizable: false,
		} satisfies FeatureCatalogMetadata,
	},
	{
		id: "step-job-application-feature",
		name: JOB_APPLICATION_FEATURE_NAME,
		type: "feature",
		graphTypes: ["knowledge-rag"],
		inputs: [
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
		],
		outputs: [
			{
				name: "messages",
				type: "Message[]",
				description:
					"Messages with job application instructions and open sessions.",
			},
			{
				name: "tools",
				type: "Tool[]",
				description:
					"Tools extended with doc + web toolset for resume and job research.",
			},
		],
		metadata: {
			description: JOB_APPLICATION_FEATURE_DESCRIPTION,
			descriptionKey: "flowBuilder.features.jobApplicationFeature.description",
			displayName: "Job Application Assistant",
			nameKey: "flowBuilder.features.jobApplicationFeature.name",
			tools: [...JOB_APPLICATION_FEATURE_TOOLS],
			systemPrompt: JOB_APPLICATION_FEATURE_SYSTEM_PROMPT,
			customizable: false,
		} satisfies FeatureCatalogMetadata,
	},
];

export function getFeatureCatalogSteps(): CatalogStep[] {
	return DEFAULT_FLOW_STEPS.filter((step) => step.type === "feature");
}

/** Get the in-memory catalog */
export function getFlowCatalog() {
	return {
		services: DEFAULT_FLOW_SERVICES,
		steps: DEFAULT_FLOW_STEPS,
	};
}

/** Find a catalog step by id */
export function findCatalogStep(stepId: string): CatalogStep | undefined {
	return DEFAULT_FLOW_STEPS.find((step) => step.id === stepId);
}

/** Find a catalog service by serviceKey */
export function findCatalogService(
	serviceKey: string,
): CatalogService | undefined {
	return DEFAULT_FLOW_SERVICES.find(
		(service) => service.serviceKey === serviceKey,
	);
}
