import { logError } from "@/utils/logger";
import {
  defineStep,
  bindStep,
} from "@/services/flows/interfaces/step";
import type {
  StepFactoryFromSpec,
  StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import { GraphBase, type ToolName } from "@/services/flows/graph/graph.base";

const STEP_NAME = "documents-feature" as const;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

export interface DocumentsFeatureInput {
  tools: `${ToolName}`[]
}

export interface DocumentsFeatureOutput {
  tools: `${ToolName}`[]
}

export interface DocumentsFeatureConfig {}

export type DocumentsFeatureServices = {}

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const definition = defineStep<
  DocumentsFeatureInput,
  DocumentsFeatureOutput,
  DocumentsFeatureServices,
  DocumentsFeatureConfig
>({
  name: STEP_NAME,
  execute: async ({ input, runConfig }) => {
    try {
      const tools = GraphBase.chat.addTool(
        input.tools,
        "doc_search" as const,
        "doc_read" as const,
        "doc_write" as const,
        "doc_edit" as const,
        "doc_remove" as const,
        "doc_move" as const,
      )

      return {
        output: {
          tools
        },
      };
    } catch (error) {
      logError("[CONTEXT_RETRIEVE_KNOWLEDGE] Failed:", error);

      return {
        output: {
          tools: input.tools,
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

export const createStep: StepFactoryFromSpec<
  DocumentsFeatureSpec
> = (services: DocumentsFeatureServices, config?: DocumentsFeatureConfig) =>
  bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createStep);

declare global {
  interface StepTypeRegistry {
    [STEP_NAME]: DocumentsFeatureSpec;
  }
}
