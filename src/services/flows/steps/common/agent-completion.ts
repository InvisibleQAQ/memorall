import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import type { AllServices } from "@/services/flows/interfaces/tool";
import type { ChatMessage } from "@/types/openai";
import { AgentGraph } from "@/services/flows/graph/agent";
import { logInfo } from "@/utils/logger";
import {
	isCustomChunkPayload,
	normalizeLangGraphStreamChunk,
} from "@/services/flows/utils/langgraph-stream";
import type { ToolName } from "../../graph/graph.base";

export const AGENT_COMPLETION_STEP_NAME = "agent-completion" as const;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

export interface AgentCompletionStepInput {
	messages: ChatMessage[];
	maxIterations?: number;
	/**
	 * Tools accumulated in graph state by feature steps (e.g. fs-feature).
	 * These are merged with config.tools so both base tools and feature tools run.
	 */
	tools?: `${ToolName}`[];
}

export interface AgentCompletionStepOutput {
	response: string;
}

export type AgentCompletionStepServices = AllServices;

export interface AgentCompletionStepConfig {
	/**
	 * Base tools always available to the agent regardless of feature steps.
	 * Merged (union) with input.tools at runtime.
	 */
	tools?: `${ToolName}`[];
}

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const definition = defineStep<
	AgentCompletionStepInput,
	AgentCompletionStepOutput,
	AgentCompletionStepServices,
	AgentCompletionStepConfig
>({
	name: AGENT_COMPLETION_STEP_NAME,
	execute: async ({ input, services, runConfig, config }) => {
		logInfo("[AGENT_COMPLETION] Running agent completion");

		// Merge config base tools with state-accumulated feature tools.
		// Deduplicate so the same tool isn't registered twice in AgentGraph.
		const mergedTools: `${ToolName}`[] = [
			...new Set([...(config?.tools ?? []), ...(input.tools ?? [])]),
		];

		const agentGraph = new AgentGraph(services, {
			tools: mergedTools.length > 0 ? mergedTools : undefined,
		});

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

		return { output: { response } };
	},
});

type AgentCompletionSpec = StepSpecFromDefinition<typeof definition>;

export const createAgentCompletionStep: StepFactoryFromSpec<
	AgentCompletionSpec
> = (
	services: AgentCompletionStepServices,
	config?: AgentCompletionStepConfig,
) => bindStep(definition, services, config);

stepRegistry.register(AGENT_COMPLETION_STEP_NAME, createAgentCompletionStep, {
	description: "Run an agentic tool-calling loop and produce a final response",
	configParams: [
		{
			key: "tools",
			type: "array",
			default: [],
			description: "Base tool names always available to the agent",
		},
	],
	defaultStateMapping: {
		messages: "messages",
		tools: "tools",
		maxIterations: "maxIterations",
	},
	enabledByDefault: true,
});

declare global {
	interface StepTypeRegistry {
		[AGENT_COMPLETION_STEP_NAME]: AgentCompletionSpec;
	}
}
