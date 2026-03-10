import type { LangGraphRunnableConfig } from "@langchain/langgraph/web";
import { logError } from "@/utils/logger";

export type FlowRunFinishCallback = () => void | Promise<void>;

export interface FlowRunLifecycle {
	onFinish: (key: string, callback: FlowRunFinishCallback) => void;
	has: (key: string) => boolean;
	drain: () => Promise<void>;
}

export const FLOW_RUN_LIFECYCLE_CONFIG_KEY = "__memorallFlowRunLifecycle";

class DefaultFlowRunLifecycle implements FlowRunLifecycle {
	private readonly finishCallbacks = new Map<string, FlowRunFinishCallback>();
	private isDraining = false;

	onFinish(key: string, callback: FlowRunFinishCallback): void {
		if (this.isDraining || this.finishCallbacks.has(key)) {
			return;
		}
		this.finishCallbacks.set(key, callback);
	}

	has(key: string): boolean {
		return this.finishCallbacks.has(key);
	}

	async drain(): Promise<void> {
		if (this.isDraining) {
			return;
		}
		this.isDraining = true;

		const entries = Array.from(this.finishCallbacks.entries()).reverse();
		this.finishCallbacks.clear();

		for (const [key, callback] of entries) {
			try {
				await callback();
			} catch (error) {
				logError(`[FLOW_RUN_LIFECYCLE] Finish callback failed: ${key}`, error);
			}
		}
	}
}

const isFlowRunLifecycle = (value: unknown): value is FlowRunLifecycle => {
	if (!value || typeof value !== "object") {
		return false;
	}
	const candidate = value as Partial<FlowRunLifecycle>;
	return (
		typeof candidate.onFinish === "function" &&
		typeof candidate.has === "function" &&
		typeof candidate.drain === "function"
	);
};

export const createFlowRunLifecycle = (): FlowRunLifecycle =>
	new DefaultFlowRunLifecycle();

export const getFlowRunLifecycle = (
	runConfig?: Pick<LangGraphRunnableConfig, "configurable">,
): FlowRunLifecycle | undefined => {
	const configurable = runConfig?.configurable as
		| Record<string, unknown>
		| undefined;
	const lifecycle = configurable?.[FLOW_RUN_LIFECYCLE_CONFIG_KEY];
	return isFlowRunLifecycle(lifecycle) ? lifecycle : undefined;
};
