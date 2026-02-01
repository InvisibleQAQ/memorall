import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import type { AllServices } from "@/services/flows/interfaces/tool";
import type {
	ChatCompletionChunk,
	ChatCompletionResponse,
	ChatMessage,
} from "@/types/openai";

const STEP_NAME = "chat-completion" as const;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

export interface ChatCompletionInput {
	messages: ChatMessage[];
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
}

export interface ChatCompletionOutput {
	finalMessage: string;
}

export type ChatCompletionServices = Pick<AllServices, "llm">;
export type ChatCompletionConfig = {
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
};

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const definition = defineStep<
	ChatCompletionInput,
	ChatCompletionOutput,
	ChatCompletionServices,
	ChatCompletionConfig
>({
	name: STEP_NAME,
	execute: async ({ input, services, config, runConfig }) => {
		const llm = services.llm;

		if (!llm.isReady()) {
			throw new Error("LLM service is not ready");
		}

		const temperature = input.temperature ?? config?.temperature ?? 0.2;
		const maxTokens = input.maxTokens ?? config?.maxTokens;
		const stream = input.stream ?? config?.stream ?? true;

		const llmResponse = await llm.chatCompletions({
			messages: input.messages,
			temperature,
			max_tokens: maxTokens,
			stream,
		});

		let responseContent = "";
		if (stream && Symbol.asyncIterator in llmResponse) {
			for await (const chunk of llmResponse as AsyncIterableIterator<ChatCompletionChunk>) {
				responseContent += chunk.choices[0].delta.content || "";
				runConfig?.writer?.({ type: "llm", chunk });
			}
		} else {
			const response = llmResponse as ChatCompletionResponse;
			responseContent = response.choices[0].message.content || "";
		}

		return {
			output: {
				finalMessage: responseContent,
			},
		};
	},
});

type ChatCompletionSpec = StepSpecFromDefinition<typeof definition>;

export const createChatCompletionStep: StepFactoryFromSpec<ChatCompletionSpec> = (
	services: ChatCompletionServices,
	config?: ChatCompletionConfig,
) => bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createChatCompletionStep);

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: ChatCompletionSpec;
	}
}
