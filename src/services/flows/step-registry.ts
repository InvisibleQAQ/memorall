import type { BoundStep, StepFactory } from "./interfaces/step";
import type { AllServices } from "./interfaces/tool";

// Base shape that all step registry entries must follow
export interface StepSpec {
	input: unknown;
	output: unknown;
	services: unknown;
	config: unknown;
}

// ---------------------------------------------------------------------------
// Step Metadata
// ---------------------------------------------------------------------------

/**
 * Describes a single config parameter that a step accepts.
 * Used by buildDefaultFlowConfig() to populate defaults and by the UI
 * to generate config editors without hand-written forms.
 */
export interface StepConfigParam {
	/** The key used in StepInstanceConfig.config. */
	key: string;
	type: "string" | "number" | "boolean" | "array";
	/** Value written into the config slot when buildDefaultFlowConfig() runs. */
	default?: unknown;
	description?: string;
}

/**
 * Static metadata attached to a step registration.
 * All fields are optional — steps that need no config or have trivial
 * state mappings can omit them.
 */
export interface StepMeta {
	description?: string;
	/**
	 * Config params this step accepts (beyond what comes from state).
	 * Used to populate defaults in buildDefaultFlowConfig() and to generate
	 * config UI editors.
	 */
	configParams?: StepConfigParam[];
	/**
	 * Default mapping: step-input field → graph-state field name.
	 * e.g. { messages: "messages", graphId: "graphId" }
	 *
	 * addStepNodes() uses this to auto-build mapInput for toNode().
	 * Fields absent from this map are expected to come from StepInstanceConfig.config,
	 * not from state (e.g. "content" on add-system comes from config).
	 */
	defaultStateMapping?: Record<string, string>;
	/**
	 * If true, buildDefaultFlowConfig() marks this step enabled by default
	 * when constructing a fresh flow config for its graph type.
	 */
	enabledByDefault?: boolean;
	/**
	 * When set, resolveStepOrder() automatically injects this step immediately
	 * after the named step in every graph's stepOrder (if not already present).
	 * The step does not need to be listed in any graph's stepOrder.
	 */
	injectAfter?: string;
}

// ---------------------------------------------------------------------------
// Global type registry
// ---------------------------------------------------------------------------

// Global step type registry for smart type inference.
// Step modules extend this interface to register their step types and required services.
declare global {
	interface StepTypeRegistry {
		// Empty by default — steps extend this interface.
		// Example:
		// "extract-entities": {
		//   input: ExtractInput;
		//   output: ExtractOutput;
		//   services: Pick<AllServices, "llm">;
		//   config: undefined;
		// };
	}
}

// Internal storage type — carries both factory and optional metadata
type StoredEntry = {
	factory: (services: unknown, config?: unknown) => BoundStep<unknown, unknown>;
	meta?: StepMeta;
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class StepRegistryManager {
	private static instance: StepRegistryManager;
	private entries = new Map<string, StoredEntry>();

	private constructor() {}

	static getInstance(): StepRegistryManager {
		if (!StepRegistryManager.instance) {
			StepRegistryManager.instance = new StepRegistryManager();
		}
		return StepRegistryManager.instance;
	}

	/**
	 * Register a step factory with optional metadata.
	 * Normalizes factories that don't need services (arity 0) to accept unused args.
	 */
	register<T extends keyof StepTypeRegistry & string>(
		stepName: T,
		factory: StepTypeRegistry[T] extends StepSpec
			? StepFactory<
					StepTypeRegistry[T]["input"],
					StepTypeRegistry[T]["output"],
					StepTypeRegistry[T]["services"],
					StepTypeRegistry[T]["config"]
				>
			: never,
		meta?: StepMeta,
	): void {
		const normalizedFactory = (
			services: unknown,
			config?: unknown,
		): BoundStep<unknown, unknown> => {
			if (factory.length === 0) {
				return (factory as () => BoundStep<unknown, unknown>)();
			}
			return (
				factory as (s: unknown, c?: unknown) => BoundStep<unknown, unknown>
			)(services, config);
		};
		this.entries.set(stepName as string, { factory: normalizedFactory, meta });
	}

	/**
	 * Get a bound step instance with services (type-safe version).
	 */
	getStep<T extends keyof StepTypeRegistry & string>(
		stepName: T,
		...args: StepTypeRegistry[T] extends StepSpec
			? StepTypeRegistry[T]["services"] extends undefined
				? []
				: [
						services: StepTypeRegistry[T]["services"],
						config?: StepTypeRegistry[T]["config"],
					]
			: [services?: unknown, config?: unknown]
	): StepTypeRegistry[T] extends StepSpec
		? BoundStep<StepTypeRegistry[T]["input"], StepTypeRegistry[T]["output"]>
		: BoundStep<unknown, unknown> {
		const entry = this.entries.get(stepName as string);
		if (!entry) {
			throw new Error(`No step registered for name: ${String(stepName)}`);
		}
		const [services, config] = args as [unknown, unknown];
		return entry.factory(
			services,
			config,
		) as StepTypeRegistry[T] extends StepSpec
			? BoundStep<StepTypeRegistry[T]["input"], StepTypeRegistry[T]["output"]>
			: BoundStep<unknown, unknown>;
	}

	/**
	 * Get a step by name (loose typing for dynamic/runtime access).
	 */
	getStepByName<TInput = unknown, TOutput = unknown>(
		stepName: string,
		services?: unknown,
		config?: unknown,
	): BoundStep<TInput, TOutput> {
		const entry = this.entries.get(stepName);
		if (!entry) {
			throw new Error(`No step registered for name: ${stepName}`);
		}
		return entry.factory(services, config) as BoundStep<TInput, TOutput>;
	}

	/**
	 * Retrieve the metadata registered alongside a step, if any.
	 */
	getMeta(stepName: string): StepMeta | undefined {
		return this.entries.get(stepName)?.meta;
	}

	/** Get all registered step names. */
	getRegisteredStepNames(): string[] {
		return Array.from(this.entries.keys());
	}

	/** Check if a step is registered. */
	hasStep(stepName: string): boolean {
		return this.entries.has(stepName);
	}

	/** Returns all steps that declare injectAfter, keyed by the anchor step name. */
	getInjectableSteps(): Map<string, string[]> {
		const map = new Map<string, string[]>();
		for (const [name, entry] of this.entries) {
			const anchor = entry.meta?.injectAfter;
			if (anchor) {
				const list = map.get(anchor) ?? [];
				list.push(name);
				map.set(anchor, list);
			}
		}
		return map;
	}
}

export const stepRegistry = StepRegistryManager.getInstance();
