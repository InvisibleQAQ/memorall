import type { AllServices } from "./interfaces/tool";
import type { GraphBase, BaseStateBase } from "./graph/graph.base";

// Base interface for all flows - any class extending GraphBase
export type BaseFlow = GraphBase<string, BaseStateBase, AllServices>;

// ---------------------------------------------------------------------------
// Step order
// ---------------------------------------------------------------------------

export const FEATURE_SLOT = "__features__" as const;
export type StepSlot = string | typeof FEATURE_SLOT;

// ---------------------------------------------------------------------------
// Flow type registry
// ---------------------------------------------------------------------------

type FlowConfig<T extends keyof FlowTypeRegistry> =
	FlowTypeRegistry[T] extends { config: infer C } ? C : undefined;

// Global flow type registry for smart type inference
// Flow modules extend this interface to register their flow types and required services
declare global {
	interface FlowTypeRegistry {
		// Empty by default - flows will extend this interface
		// Example: 'knowledge': { services: AllServices; flow: KnowledgeGraphFlow };
	}
}

// Registration interface
export interface FlowRegistration<T extends keyof FlowTypeRegistry> {
	flowType: T;
	stepOrder: readonly StepSlot[];
	/** Per-step default config values, merged on top of each step's StepMeta defaults. */
	stepDefaults?: Record<string, Record<string, unknown>>;
	factory: (
		services: FlowTypeRegistry[T]["services"],
		config?: FlowConfig<T>,
	) => FlowTypeRegistry[T]["flow"];
}

// Registry class using singleton pattern
export class FlowRegistryManager {
	private static instance: FlowRegistryManager;
	private factories = new Map<
		string,
		(services: AllServices, config?: unknown) => BaseFlow
	>();
	private stepOrders = new Map<string, readonly StepSlot[]>();
	private stepDefaultsMap = new Map<
		string,
		Record<string, Record<string, unknown>>
	>();

	private constructor() {}

	static getInstance(): FlowRegistryManager {
		if (!FlowRegistryManager.instance) {
			FlowRegistryManager.instance = new FlowRegistryManager();
		}
		return FlowRegistryManager.instance;
	}

	register<T extends keyof FlowTypeRegistry>(
		registration: FlowRegistration<T>,
	): void {
		const flowType = registration.flowType as string;
		this.factories.set(
			flowType,
			registration.factory as (
				services: AllServices,
				config?: unknown,
			) => BaseFlow,
		);
		this.stepOrders.set(flowType, registration.stepOrder);
		if (registration.stepDefaults) {
			this.stepDefaultsMap.set(flowType, registration.stepDefaults);
		}
	}

	createFlow<T extends keyof FlowTypeRegistry>(
		flowType: T,
		services: FlowTypeRegistry[T]["services"],
		config?: FlowConfig<T>,
	): FlowTypeRegistry[T]["flow"] {
		const factory = this.factories.get(flowType as string);
		if (!factory) {
			throw new Error(`No flow registered for type: ${String(flowType)}`);
		}
		return factory(
			services as AllServices,
			config,
		) as FlowTypeRegistry[T]["flow"];
	}

	getStepOrder(graphType: string): readonly StepSlot[] {
		return this.stepOrders.get(graphType) ?? [];
	}

	getStepDefaults(
		graphType: string,
		stepName: string,
	): Record<string, unknown> {
		return this.stepDefaultsMap.get(graphType)?.[stepName] ?? {};
	}

	getRegisteredFlowTypes(): string[] {
		return Array.from(this.factories.keys());
	}

	hasFlow(flowType: string): boolean {
		return this.factories.has(flowType);
	}
}

export const flowRegistry = FlowRegistryManager.getInstance();
