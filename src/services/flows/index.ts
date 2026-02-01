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

// Re-export registry utilities
export { toolRegistry, convertToolsToOpenAI } from "./tool-registry";
export type {
	BaseTool,
	Tool,
	ToolFactory,
	AllServices,
} from "./interfaces/tool";

export { FlowsService } from "./flows-service";
