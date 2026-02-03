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
export function findCatalogService(
	serviceKey: string,
): CatalogService | undefined {
	return DEFAULT_FLOW_SERVICES.find(
		(service) => service.serviceKey === serviceKey,
	);
}
