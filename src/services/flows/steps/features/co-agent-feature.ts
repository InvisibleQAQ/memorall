import { logError } from "@/utils/logger";
import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import {
	featureCatalogRegistry,
	FEATURE_DEFAULT_INPUTS,
	type FeatureCatalogMetadata,
} from "@/services/flows/feature-catalog-registry";
import { GraphBase, type GraphTool } from "@/services/flows/graph/graph.base";
import type { ChatCompletionMessageParam } from "@/types/openai";
import { CO_AGENT_TOOLS } from "@/services/flows/tools/co-agent";

export const CO_AGENT_FEATURE_STEP_NAME = "co-agent-feature" as const;

export const CO_AGENT_SYSTEM_PROMPT = `
# CO-AGENT BROWSER FEATURE
You are controlling the user's currently enabled browser tab through visible co-agent tools.

Rules:
- Always start by calling co_agent_observe.
- Use co_agent_query before interacting with a specific element.
- Use co_agent_move and co_agent_scroll to visibly show where evidence or targets are on the page.
- Use only selectors returned by tools, especially stableSelector values. Never invent selectors.
- Answer from page evidence after observing/interacting.
- If a tool returns blocked=true or requiresUserAction=true, stop that browser action and ask the user to do it manually.
- Do not attempt form submission, uploads, payments, account/security changes, credential entry, password handling, or browser permission acceptance.
`.trim();

interface CoAgentFeatureInput {
	messages: ChatCompletionMessageParam[];
	tools: GraphTool[];
}

interface CoAgentFeatureOutput {
	messages?: ChatCompletionMessageParam[];
	tools?: GraphTool[];
}

type CoAgentFeatureServices = Record<string, never>;
interface CoAgentFeatureConfig {}

const definition = defineStep<
	CoAgentFeatureInput,
	CoAgentFeatureOutput,
	CoAgentFeatureServices,
	CoAgentFeatureConfig
>({
	name: CO_AGENT_FEATURE_STEP_NAME,
	execute: async ({ input }) => {
		try {
			return {
				output: {
					tools: GraphBase.chat.addTool(input.tools, ...CO_AGENT_TOOLS),
					messages: GraphBase.chat.systemMessage(
						input.messages,
						CO_AGENT_SYSTEM_PROMPT,
					),
				},
			};
		} catch (error) {
			logError("[CO_AGENT_FEATURE] Failed:", error);
			return {
				output: {
					tools: input.tools,
					messages: input.messages,
				},
			};
		}
	},
});

type CoAgentFeatureSpec = StepSpecFromDefinition<typeof definition>;

const createCoAgentFeatureStep: StepFactoryFromSpec<CoAgentFeatureSpec> = (
	services: CoAgentFeatureServices,
	config?: CoAgentFeatureConfig,
) => bindStep(definition, services, config);

stepRegistry.register(CO_AGENT_FEATURE_STEP_NAME, createCoAgentFeatureStep, {
	description:
		"Enable current-tab co-agent browser tooling and co-agent instructions.",
	defaultStateMapping: { messages: "messages", tools: "tools" },
	enabledByDefault: false,
});

featureCatalogRegistry.register({
	id: "step-co-agent-feature",
	name: CO_AGENT_FEATURE_STEP_NAME,
	type: "feature",
	graphTypes: ["foundation", "agent"],
	inputs: FEATURE_DEFAULT_INPUTS,
	outputs: [
		{
			name: "messages",
			type: "Message[]",
			description: "Messages with co-agent instructions.",
		},
		{
			name: "tools",
			type: "Tool[]",
			description: "Tools extended with current-tab co-agent controls.",
		},
	],
	metadata: {
		description:
			"Enable visible current-tab co-agent controls, cursor movement, page observation, and safe DOM interaction.",
		displayName: "Co-agent",
		tools: [...CO_AGENT_TOOLS],
		systemPrompt: CO_AGENT_SYSTEM_PROMPT,
		customizable: false,
		icon: { name: "Bot", type: "lucide" },
	} satisfies FeatureCatalogMetadata,
});

declare global {
	interface StepTypeRegistry {
		[CO_AGENT_FEATURE_STEP_NAME]: CoAgentFeatureSpec;
	}
}
