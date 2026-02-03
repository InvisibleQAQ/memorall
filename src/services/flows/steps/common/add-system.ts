import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import type { ChatMessage } from "@/types/openai";
import { GraphBase } from "@/services/flows/graph/graph.base";

const STEP_NAME = "add-system" as const;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

interface Input {
	messages: ChatMessage[];
	content: string;
}

interface Output {
	messages?: ChatMessage[];
}

type Services = {};
type Config = {};

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const definition = defineStep<Input, Output, Services, Config>({
	name: STEP_NAME,
	execute: async ({ input }) => {
		if (!input?.content) {
			return {
				output: {},
			};
		}

		const updatedMessages = GraphBase.chat.system(
			input.messages || [],
			input.content,
		);

		return {
			output: {
				messages: updatedMessages,
			},
		};
	},
});

type Spec = StepSpecFromDefinition<typeof definition>;

const createStep: StepFactoryFromSpec<Spec> = (
	services: Services,
	config?: Config,
) => bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createStep);

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: Spec;
	}
}
