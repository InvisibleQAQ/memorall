/**
 * Context Quick Retrieve Step
 *
 * Combines quick-retrieve and build-context into a single step.
 * Output: "context" string ready for LLM consumption.
 */

import { logInfo, logError } from "@/utils/logger";
import {
	defineStep,
	bindStep,
	type StepOutput,
} from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import type {
	QuickRetrieveOutput,
	RelevantNode,
	RelevantEdge,
	QuickRetrieveSerices,
} from "./quick-retrieve";
import type {
	EntitiesFactsToContextOutput,
	EntitiesFactsToContextServices,
} from "./entities-facts-to-context";
import type { ChatCompletionMessageParam } from "@/types/openai";
import { extractRetrievalTextFromMessages } from "@/services/flows/utils/message-query";

const STEP_NAME = "context-quick-retrieve" as const;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

export interface ContextQuickRetrieveInput {
	messages: ChatCompletionMessageParam[];
	graphId?: string;
}

export interface ContextQuickRetrieveOutput {
	context: string;
	relevantNodes?: RelevantNode[];
	relevantEdges?: RelevantEdge[];
	nodeCount?: number;
	edgeCount?: number;
	errors?: string[];
}

export interface ContextQuickRetrieveConfig {
	maxGrowthLevels?: number;
	searchLimit?: number;
}

export type ContextQuickRetrieveServices = QuickRetrieveSerices &
	EntitiesFactsToContextServices;

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const definition = defineStep<
	ContextQuickRetrieveInput,
	ContextQuickRetrieveOutput,
	ContextQuickRetrieveServices,
	ContextQuickRetrieveConfig
>({
	name: STEP_NAME,
	execute: async ({ input, services, config, runConfig }) => {
		try {
			logInfo(
				`[CONTEXT_QUICK_RETRIEVE] Starting for graphId: ${input.graphId}`,
			);
			const query = extractRetrievalTextFromMessages(input.messages);

			// Step 1: Run quick-retrieve
			// Use getStepByName to avoid circular type reference
			const quickRetrieveStep = stepRegistry.getStepByName(
				"quick-retrieve",
				services,
				{
					maxGrowthLevels: config?.maxGrowthLevels,
					searchLimit: config?.searchLimit,
				},
			);
			const retrieveResult = (await quickRetrieveStep.execute(
				{
					query,
					graphId: input.graphId,
				},
				runConfig,
			)) as StepOutput<QuickRetrieveOutput>;

			if (retrieveResult.output.errors?.length) {
				return {
					output: {
						context: "",
						errors: retrieveResult.output.errors,
					},
				};
			}

			const relevantNodes = retrieveResult.output.relevantNodes ?? [];
			const relevantEdges = retrieveResult.output.relevantEdges ?? [];

			// Step 2: Build context
			// Use getStepByName to avoid circular type reference
			const buildContextStep = stepRegistry.getStepByName(
				"entities-facts-to-context",
				{},
			);
			const contextResult = (await buildContextStep.execute(
				{
					relevantNodes,
					relevantEdges,
					graphId: input.graphId,
				},
				runConfig,
			)) as StepOutput<EntitiesFactsToContextOutput>;

			const context = contextResult.output.knowledgeContext ?? "";

			logInfo(
				`[CONTEXT_QUICK_RETRIEVE] Complete: ${relevantNodes.length} nodes, ${relevantEdges.length} edges`,
			);

			const actions = [
				{
					id: crypto.randomUUID(),
					name: "Context Quick Retrieve Complete",
					description: `Built context from ${relevantNodes.length} nodes and ${relevantEdges.length} edges`,
					metadata: {
						nodeCount: relevantNodes.length,
						edgeCount: relevantEdges.length,
					},
				},
			];
			runConfig?.writer?.({ type: "actions", actions });

			return {
				output: {
					context,
					relevantNodes,
					relevantEdges,
					nodeCount: relevantNodes.length,
					edgeCount: relevantEdges.length,
				},
			};
		} catch (error) {
			logError("[CONTEXT_QUICK_RETRIEVE] Failed:", error);

			const actions = [
				{
					id: crypto.randomUUID(),
					name: "Context Quick Retrieve Failed",
					description: error instanceof Error ? error.message : "Unknown error",
					metadata: {},
				},
			];
			runConfig?.writer?.({ type: "actions", actions });

			return {
				output: {
					context: "",
					errors: [
						error instanceof Error
							? error.message
							: "Context quick retrieve failed",
					],
				},
			};
		}
	},
});

type ContextQuickRetrieveSpec = StepSpecFromDefinition<typeof definition>;

export const createContextQuickRetrieveStep: StepFactoryFromSpec<
	ContextQuickRetrieveSpec
> = (
	services: ContextQuickRetrieveServices,
	config?: ContextQuickRetrieveConfig,
) => bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createContextQuickRetrieveStep);

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: ContextQuickRetrieveSpec;
	}
}
