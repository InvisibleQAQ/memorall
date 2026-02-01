// Import flows to trigger self-registration
import "./graph/knowledge/graph";
import "./graph/simple/graph";
import "./graph/knowledge-rag/graph";
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
export { defineStep, bindStep, toGraphNode } from "./interfaces/step";

// Re-export registry utilities
export { toolRegistry, convertToolsToOpenAI } from "./tool-registry";
export type { BaseTool, Tool, ToolFactory, AllServices } from "./interfaces/tool";

export { FlowsService } from "./flows-service";
