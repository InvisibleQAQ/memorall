import { logError } from "@/utils/logger";
import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import { GraphBase, type ToolName } from "@/services/flows/graph/graph.base";
import type { ChatCompletionMessageParam } from "@/types/openai";

const STEP_NAME = "documents-feature" as const;
export const DOCUMENTS_FEATURE_NAME = STEP_NAME;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

export interface DocumentsFeatureInput {
	messages: ChatCompletionMessageParam[];
	tools: `${ToolName}`[];
}

export interface DocumentsFeatureOutput {
	tools?: `${ToolName}`[];
	messages?: ChatCompletionMessageParam[];
}

export interface DocumentsFeatureConfig {}

export type DocumentsFeatureServices = {};

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const SYSTEMP_PROMPT_INSTRUCTION = `
# DOCUMENT's FILES ACCESS
You can access to a document space to handle users documents
Always use: "doc_search", "doc_read", "doc_write", "doc_edit", "doc_remove", "doc_move" tools when user mention about "documents"
`;
export const DOCUMENTS_FEATURE_SYSTEM_PROMPT =
	SYSTEMP_PROMPT_INSTRUCTION.trim();
export const DOCUMENTS_FEATURE_TOOLS = [
	"doc_search",
	"doc_read",
	"doc_write",
	"doc_edit",
	"doc_remove",
	"doc_move",
] as const;
export const DOCUMENTS_FEATURE_DESCRIPTION =
	"Enable document workspace tools for searching, reading, writing, editing, moving, and removing documents.";

const definition = defineStep<
	DocumentsFeatureInput,
	DocumentsFeatureOutput,
	DocumentsFeatureServices,
	DocumentsFeatureConfig
>({
	name: STEP_NAME,
	execute: async ({ input }) => {
		try {
			const tools = GraphBase.chat.addTool(
				input.tools,
				...DOCUMENTS_FEATURE_TOOLS,
			);
			const messages = GraphBase.chat.systemMessage(
				input.messages,
				DOCUMENTS_FEATURE_SYSTEM_PROMPT,
			);

			return {
				output: {
					tools,
					messages,
				},
			};
		} catch (error) {
			logError("[CONTEXT_RETRIEVE_KNOWLEDGE] Failed:", error);

			return {
				output: {
					tools: input.tools,
					messages: input.messages,
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

type DocumentsFeatureSpec = StepSpecFromDefinition<typeof definition>;

export const createStep: StepFactoryFromSpec<DocumentsFeatureSpec> = (
	services: DocumentsFeatureServices,
	config?: DocumentsFeatureConfig,
) => bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createStep);

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: DocumentsFeatureSpec;
	}
}
