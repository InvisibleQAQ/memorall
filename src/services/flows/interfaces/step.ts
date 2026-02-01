import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseStateBase } from "../graph/graph.base";

// ============================================================================
// Core Step Types
// ============================================================================

/** Output returned by a step's execute function */
export interface StepOutput<TOutput> {
	output: TOutput;
	metadata?: Record<string, unknown>;
	actions?: BaseStateBase["actions"];
}

/** Parameters passed to a step's execute function */
export interface StepExecuteParams<
	TInput,
	TServices = undefined,
	TConfig = undefined,
> {
	input: TInput;
	services: TServices;
	config: TConfig;
	metadata?: Record<string, unknown>;
	runConfig?: RunnableConfig;
}

/** A step definition: name + execute function */
export interface StepDefinition<
	TInput,
	TOutput,
	TServices = undefined,
	TConfig = undefined,
> {
	name: string;
	execute: (
		params: StepExecuteParams<TInput, TServices, TConfig>,
	) => Promise<StepOutput<TOutput>>;
}

/** A step with services and config already bound */
export interface BoundStep<TInput, TOutput> {
	name: string;
	execute: (
		input: TInput,
		runConfig?: RunnableConfig,
		metadata?: Record<string, unknown>,
	) => Promise<StepOutput<TOutput>>;
}

/** Factory function type — conditional on whether services are needed */
export type StepFactory<
	TInput,
	TOutput,
	TServices = undefined,
	TConfig = undefined,
> = TServices extends undefined
	? () => BoundStep<TInput, TOutput>
	: (services: TServices, config?: TConfig) => BoundStep<TInput, TOutput>;

/** Mapping functions that bridge step I/O to graph state */
export interface StepNodeMapping<TState, TInput, TOutput> {
	mapInput: (state: TState) => TInput;
	mapOutput: (result: StepOutput<TOutput>, state: TState) => Partial<TState>;
	metadata?:
		| Record<string, unknown>
		| ((state: TState, runConfig?: RunnableConfig) => Record<string, unknown>);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Identity function for TypeScript generic inference on step definitions.
 * Analogous to Vue's `defineComponent` — provides inference without runtime cost.
 */
export function defineStep<
	TInput,
	TOutput,
	TServices = undefined,
	TConfig = undefined,
>(
	definition: StepDefinition<TInput, TOutput, TServices, TConfig>,
): StepDefinition<TInput, TOutput, TServices, TConfig> {
	return definition;
}

/**
 * Closes over services and config, returning a BoundStep that only needs input.
 */
export function bindStep<
	TInput,
	TOutput,
	TServices = undefined,
	TConfig = undefined,
>(
	definition: StepDefinition<TInput, TOutput, TServices, TConfig>,
	services: TServices,
	config?: TConfig,
): BoundStep<TInput, TOutput> {
	return {
		name: definition.name,
		execute: (
			input: TInput,
			runConfig?: RunnableConfig,
			metadata?: Record<string, unknown>,
		) =>
			definition.execute({
				input,
				services,
				config: config as TConfig,
				metadata,
				runConfig,
			}),
	};
}

/**
 * Bridges a BoundStep to a LangGraph node function: `(state) => Partial<state>`.
 *
 * Uses `mapInput` to extract step input from state, runs the step,
 * then uses `mapOutput` to merge results back into state.
 */
export function toGraphNode<TState extends BaseStateBase, TInput, TOutput>(
	step: BoundStep<TInput, TOutput>,
	mapping: StepNodeMapping<TState, TInput, TOutput>,
): (state: TState, runConfig?: RunnableConfig) => Promise<Partial<TState>> {
	return async (state: TState, runConfig?: RunnableConfig): Promise<Partial<TState>> => {
		const metadata =
			typeof mapping.metadata === "function"
				? mapping.metadata(state, runConfig)
				: mapping.metadata;

		const input = mapping.mapInput(state);
		const result = await step.execute(input, runConfig, metadata);

		const stateUpdate = mapping.mapOutput(result, state);

		// Merge actions from step output into state update if present
		if (result.actions?.length) {
			const existing = (stateUpdate as BaseStateBase).actions;
			(stateUpdate as BaseStateBase).actions = existing
				? [...existing, ...result.actions]
				: result.actions;
		}

		return stateUpdate;
	};
}

export type StepSpecFromDefinition<T> =
  T extends StepDefinition<infer TInput, infer TOutput, infer TServices, infer TConfig>
    ? {
        input: TInput;
        output: TOutput;
        services: TServices;
        config: TConfig;
      }
    : never;

export type StepFactoryFromSpec<T extends { input: unknown; output: unknown; services: unknown; config: unknown }> =
  StepFactory<T["input"], T["output"], T["services"], T["config"]>;
