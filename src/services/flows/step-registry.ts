import type { BoundStep, StepFactory } from "./interfaces/step";

// Base shape that all step registry entries must follow
export interface StepSpec {
	input: unknown;
	output: unknown;
	services: unknown;
	config: unknown;
}

// Global step type registry for smart type inference
// Step modules extend this interface to register their step types and required services
declare global {
	interface StepTypeRegistry {
		// Empty by default - steps will extend this interface
		// Example:
		// "extract-entities": {
		//   input: ExtractInput;
		//   output: ExtractOutput;
		//   services: Pick<AllServices, "llm">;
		//   config: undefined;
		// };
	}
}

// Internal factory storage type
type StoredFactory = (
	services: unknown,
	config?: unknown,
) => BoundStep<unknown, unknown>;

// Registry class using singleton pattern
export class StepRegistryManager {
	private static instance: StepRegistryManager;
	private factories = new Map<string, StoredFactory>();

	private constructor() {}

	static getInstance(): StepRegistryManager {
		if (!StepRegistryManager.instance) {
			StepRegistryManager.instance = new StepRegistryManager();
		}
		return StepRegistryManager.instance;
	}

	/**
	 * Register a step factory.
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
	): void {
		const normalizedFactory: StoredFactory = (
			services: unknown,
			config?: unknown,
		) => {
			if (factory.length === 0) {
				return (factory as () => BoundStep<unknown, unknown>)();
			}
			return (
				factory as (s: unknown, c?: unknown) => BoundStep<unknown, unknown>
			)(services, config);
		};
		this.factories.set(stepName as string, normalizedFactory);
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
		const factory = this.factories.get(stepName as string);
		if (!factory) {
			throw new Error(`No step registered for name: ${String(stepName)}`);
		}
		const [services, config] = args as [unknown, unknown];
		return factory(services, config) as StepTypeRegistry[T] extends StepSpec
			? BoundStep<StepTypeRegistry[T]["input"], StepTypeRegistry[T]["output"]>
			: BoundStep<unknown, unknown>;
	}

	/**
	 * Get a step by name (loose typing for dynamic/runtime access).
	 */
	getStepByName(
		stepName: string,
		services?: unknown,
		config?: unknown,
	): BoundStep<unknown, unknown> {
		const factory = this.factories.get(stepName);
		if (!factory) {
			throw new Error(`No step registered for name: ${stepName}`);
		}
		return factory(services, config);
	}

	/**
	 * Get all registered step names.
	 */
	getRegisteredStepNames(): string[] {
		return Array.from(this.factories.keys());
	}

	/**
	 * Check if a step is registered.
	 */
	hasStep(stepName: string): boolean {
		return this.factories.has(stepName);
	}
}

export const stepRegistry = StepRegistryManager.getInstance();
