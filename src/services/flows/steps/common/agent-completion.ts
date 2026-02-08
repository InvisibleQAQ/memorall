import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import type { AllServices } from "@/services/flows/interfaces/tool";
import type { ChatCompletionTool, ChatMessage } from "@/types/openai";
import { AgentGraph } from "@/services/flows/graph/agent";
import { logInfo } from "@/utils/logger";
import {
	isCustomChunkPayload,
	normalizeLangGraphStreamChunk,
} from "@/services/flows/utils/langgraph-stream";

const STEP_NAME = "agent-completion" as const;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

export interface AgentCompletionStepInput {
	messages: ChatMessage[];
	tools?: ChatCompletionTool[];
	maxIterations?: number;
}

export interface AgentCompletionStepOutput {
	response: string;
}

export type AgentCompletionStepServices = AllServices;
export type AgentCompletionStepConfig = {};

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const definition = defineStep<
	AgentCompletionStepInput,
	AgentCompletionStepOutput,
	AgentCompletionStepServices,
	AgentCompletionStepConfig
>({
	name: STEP_NAME,
	execute: async ({ input, services, runConfig }) => {
		logInfo("[AGENT_COMPLETION] Running agent completion");

		const agentGraph = new AgentGraph(services);

		const stream = await agentGraph.stream(
			{
				messages: input.messages,
				maxIterations: input.maxIterations,
			},
			{
				streamMode: ["custom", "values"],
			},
		);

		let response = "";

		for await (const partial of stream) {
			const { mode, payload } = normalizeLangGraphStreamChunk(partial);

			if (mode === "custom" && isCustomChunkPayload(payload)) {
				runConfig?.writer?.(payload);
				continue;
			}

			if (mode === "values") {
				const stateValues = payload as Record<string, unknown>;
				if (stateValues?.response) {
					response = stateValues.response as string;
				}
			}
		}

		return {
			output: {
				response,
			},
		};
	},
});

type AgentCompletionSpec = StepSpecFromDefinition<typeof definition>;

export const createAgentCompletionStep: StepFactoryFromSpec<
	AgentCompletionSpec
> = (
	services: AgentCompletionStepServices,
	config?: AgentCompletionStepConfig,
) => bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createAgentCompletionStep);

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: AgentCompletionSpec;
	}
}
