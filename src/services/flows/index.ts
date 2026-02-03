// Import flows to trigger self-registration
import "./graph";
import "./steps";
import "./tools";

// Re-export registry utilities
export { stepRegistry } from "./step-registry";
export type {
	StepOutput,
	StepExecuteParams,
	StepDefinition,
	BoundStep,
	StepFactory,
	StepNodeMapping,
} from "./interfaces/step";
export { defineStep, bindStep } from "./interfaces/step";
export type {
	FlowDefinition,
	FlowDraftInput,
	FlowStateInput,
	FlowStepInput,
	FlowConnectionInput,
	FlowCatalog,
	FlowLayout,
	FlowLayoutNode,
} from "./interfaces/flow-builder";
export { FlowBuilderService } from "./flow-builder-service";
export type { CatalogService, CatalogStep } from "./flow-builder-catalog";
export {
	DEFAULT_FLOW_SERVICES,
	DEFAULT_FLOW_STEPS,
	getFlowCatalog,
	findCatalogStep,
	findCatalogService,
} from "./flow-builder-catalog";

// Re-export registry utilities
export { toolRegistry, convertToolsToOpenAI } from "./tool-registry";
export type {
	BaseTool,
	Tool,
	ToolFactory,
	AllServices,
} from "./interfaces/tool";

export { FlowsService } from "./flows-service";
