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
	metadata: Record<string, unknown>;
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
		metadata: { description: "Addpend system prompt" },
	},
	{
		id: "step-chat-completion",
		name: "chat-completion",
		type: "common",
		metadata: { description: "Chat completion step" },
	},
	{
		id: "step-agent-completion",
		name: "agent-completion",
		type: "common",
		metadata: { description: "Agent completion step" },
	},
	{
		id: "step-analyze-query",
		name: "analyze-query",
		type: "rag",
		metadata: { description: "Analyze query for retrieval" },
	},
	{
		id: "step-retrieve-knowledge",
		name: "retrieve-knowledge",
		type: "rag",
		metadata: { description: "Retrieve knowledge from graph" },
	},
	{
		id: "step-quick-retrieve",
		name: "quick-retrieve",
		type: "rag",
		metadata: { description: "Quick retrieval step" },
	},
	{
		id: "step-smart-retrieve",
		name: "smart-retrieve",
		type: "rag",
		metadata: { description: "Smart retrieval step" },
	},
	{
		id: "step-entities-facts-to-context",
		name: "entities-facts-to-context",
		type: "rag",
		metadata: { description: "Build context from entities/facts" },
	},
	{
		id: "step-entities-facts-citation",
		name: "entities-facts-citation",
		type: "rag",
		metadata: { description: "Generate citations" },
	},
	{
		id: "step-entity-extraction",
		name: "entity-extraction",
		type: "knowledge",
		metadata: { description: "Extract entities" },
	},
	{
		id: "step-entity-resolution",
		name: "entity-resolution",
		type: "knowledge",
		metadata: { description: "Resolve entities" },
	},
	{
		id: "step-fact-extraction",
		name: "fact-extraction",
		type: "knowledge",
		metadata: { description: "Extract facts" },
	},
	{
		id: "step-fact-extraction-v2",
		name: "fact-extraction-v2",
		type: "knowledge",
		metadata: { description: "Extract facts v2" },
	},
	{
		id: "step-fact-resolution",
		name: "fact-resolution",
		type: "knowledge",
		metadata: { description: "Resolve facts" },
	},
	{
		id: "step-edge-enrichment",
		name: "edge-enrichment",
		type: "knowledge",
		metadata: { description: "Enrich edges" },
	},
	{
		id: "step-temporal-extraction",
		name: "temporal-extraction",
		type: "knowledge",
		metadata: { description: "Extract temporal data" },
	},
	{
		id: "step-database-save",
		name: "database-save",
		type: "knowledge",
		metadata: { description: "Persist to database" },
	},
	{
		id: "step-load-entities",
		name: "load-entities",
		type: "knowledge",
		metadata: { description: "Load entities from database" },
	},
	{
		id: "step-load-facts",
		name: "load-facts",
		type: "knowledge",
		metadata: { description: "Load facts from database" },
	},
];

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
export function findCatalogService(serviceKey: string): CatalogService | undefined {
	return DEFAULT_FLOW_SERVICES.find((service) => service.serviceKey === serviceKey);
}
