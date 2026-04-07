import { logError } from "@/utils/logger";
import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import { GraphBase, type ToolName } from "@/services/flows/graph/graph.base";
import type { ChatCompletionMessageParam } from "@/types/openai";

const STEP_NAME = "planner-feature" as const;
export const PLANNER_FEATURE_NAME = STEP_NAME;

export interface PlannerFeatureInput {
	messages: ChatCompletionMessageParam[];
	tools: `${ToolName}`[];
}

export interface PlannerFeatureOutput {
	tools?: `${ToolName}`[];
	messages?: ChatCompletionMessageParam[];
}

export interface PlannerFeatureConfig {}

export type PlannerFeatureServices = undefined;

const SYSTEM_PROMPT_INSTRUCTION = `
# PLANNER MODE

You are operating in PLANNER MODE. You must use planner tools to track work from start to finish.

## REQUIRED WORKFLOW

1. Call \`planner_create\` before using other tools or giving any real answer.
2. Keep the \`planner_create\` payload simple:
   - \`title\`: a short plan title
   - \`items\`: an array of short step strings
   - Example: \`["Inspect logs", "Patch planner_create", "Verify the result"]\`
3. Make each step short, concrete, and action-oriented.
4. If new work appears, call \`planner_add_item\`.
5. If a step becomes irrelevant, call \`planner_remove_item\`.
6. After finishing a step, immediately call \`planner_check_item\`.
7. Before the final answer, call \`planner_get\`.
8. If any item is still unchecked, continue working.
9. Only finish when all plan items are checked.

## TOOL REFERENCE

- \`planner_create\` — Create the initial plan. Use a short title and an \`items\` array of short steps.
- \`planner_get\` — Read the current plan and completion status.
- \`planner_check_item\` — Mark an item done after completing it.
- \`planner_add_item\` — Add newly discovered work.
- \`planner_remove_item\` — Remove work that is no longer needed.
`;

export const PLANNER_FEATURE_SYSTEM_PROMPT = SYSTEM_PROMPT_INSTRUCTION.trim();

export const PLANNER_FEATURE_TOOLS = [
	"planner_create",
	"planner_get",
	"planner_check_item",
	"planner_add_item",
	"planner_remove_item",
] as const;

export const PLANNER_FEATURE_DESCRIPTION =
	"Forces structured planning with item-by-item completion tracking. Agent must check all items before finishing.";

const definition = defineStep<
	PlannerFeatureInput,
	PlannerFeatureOutput,
	PlannerFeatureServices,
	PlannerFeatureConfig
>({
	name: STEP_NAME,
	execute: async ({ input }) => {
		try {
			const tools = GraphBase.chat.addTool(
				input.tools,
				...PLANNER_FEATURE_TOOLS,
			);
			const messages = GraphBase.chat.systemMessage(
				input.messages,
				PLANNER_FEATURE_SYSTEM_PROMPT,
			);
			return {
				output: {
					tools,
					messages,
				},
			};
		} catch (error) {
			logError("[PLANNER_FEATURE] Failed:", error);
			return {
				output: {
					tools: input.tools,
					messages: input.messages,
					errors: [
						error instanceof Error
							? error.message
							: "Planner feature step failed",
					],
				},
			};
		}
	},
});

type PlannerFeatureSpec = StepSpecFromDefinition<typeof definition>;
export const createPlannerFeatureStep: StepFactoryFromSpec<
	PlannerFeatureSpec
> = () => bindStep(definition, undefined, undefined);

stepRegistry.register(STEP_NAME, createPlannerFeatureStep, {
	description: PLANNER_FEATURE_DESCRIPTION,
	defaultStateMapping: { messages: "messages", tools: "tools" },
	enabledByDefault: false,
});

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: PlannerFeatureSpec;
	}
}
