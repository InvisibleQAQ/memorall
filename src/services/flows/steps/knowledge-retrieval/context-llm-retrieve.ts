/**
 * Context Retrieve Knowledge Step
 *
 * Combines analyze-query, retrieve-knowledge and entities-facts-to-context into a single step.
 * Output: "context" string ready for LLM consumption, plus relevantNodes/relevantEdges for citation.
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
	RetrieveKnowledgeOutput,
	RelevantNode,
	RelevantEdge,
	RetrieveKnowledgeServices,
} from "./retrieve-knowledge";
import type { AnalyzeQueryOutput, } from "./analyze-query";
import type { EntitiesFactsToContextOutput, EntitiesFactsToContextServices } from "./entities-facts-to-context";

const STEP_NAME = "context-llm-retrieve" as const;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

export interface ContextLLMRetrieveInput {
	query: string;
	graphId?: string;
}

export interface ContextLLMRetrieveOutput {
	context: string;
	relevantNodes?: RelevantNode[];
	relevantEdges?: RelevantEdge[];
	nodeCount?: number;
	edgeCount?: number;
	errors?: string[];
}

export interface ContextLLMRetrieveConfig {}

export type ContextLLMRetrieveServices = RetrieveKnowledgeServices & EntitiesFactsToContextServices

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const definition = defineStep<
	ContextLLMRetrieveInput,
	ContextLLMRetrieveOutput,
	ContextLLMRetrieveServices,
	ContextLLMRetrieveConfig
>({
	name: STEP_NAME,
	execute: async ({ input, services, config, runConfig }) => {
		try {
			logInfo(
				`[CONTEXT_RETRIEVE_KNOWLEDGE] Starting for graphId: ${input.graphId}`,
			);

			// Step 1: Analyze query to extract entities
			const analyzeQueryStep = stepRegistry.getStepByName(
				"analyze-query",
				services,
			);
			const analyzeResult = (await analyzeQueryStep.execute(
				{
					query: input.query,
				},
				runConfig,
			)) as StepOutput<AnalyzeQueryOutput>;

			if (analyzeResult.output.errors?.length) {
				return {
					output: {
						context: "",
						errors: analyzeResult.output.errors,
					},
				};
			}

			const extractedEntities = analyzeResult.output.extractedEntities ?? [];

			// Step 2: Run retrieve-knowledge
			const retrieveKnowledgeStep = stepRegistry.getStepByName(
				"retrieve-knowledge",
				services,
			);
			const retrieveResult = (await retrieveKnowledgeStep.execute(
				{
					extractedEntities,
					graphId: input.graphId,
				},
				runConfig,
			)) as StepOutput<RetrieveKnowledgeOutput>;

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

			// Step 3: Build context
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
				`[CONTEXT_RETRIEVE_KNOWLEDGE] Complete: ${relevantNodes.length} nodes, ${relevantEdges.length} edges`,
			);

			const actions = [
				{
					id: crypto.randomUUID(),
					name: "Context Retrieve Knowledge Complete",
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
			logError("[CONTEXT_RETRIEVE_KNOWLEDGE] Failed:", error);

			const actions = [
				{
					id: crypto.randomUUID(),
					name: "Context Retrieve Knowledge Failed",
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
							: "Context retrieve knowledge failed",
					],
				},
			};
		}
	},
});

type ContextLLMRetrieveSpec = StepSpecFromDefinition<typeof definition>;

export const createContextLLMRetrieveStep: StepFactoryFromSpec<
	ContextLLMRetrieveSpec
> = (services: ContextLLMRetrieveServices, config?: ContextLLMRetrieveConfig) =>
	bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createContextLLMRetrieveStep);

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: ContextLLMRetrieveSpec;
	}
}
