import { BaseProcessHandler } from "./base-process-handler";
import type { ProcessDependencies, BaseJob, ItemHandlerResult } from "./types";
import { handlerRegistry } from "./handler-registry";
import { serviceManager } from "@/services";
import { logInfo } from "@/utils/logger";

const JOB_NAMES = {
	getPredefinedFlows: "get-predefined-flows",
} as const;

export interface GetPredefinedFlowsPayload {
	flowKey?: "foundation";
}

export interface GetPredefinedFlowsResult extends Record<string, unknown> {
	flows: Array<{ id: string; name: string }>;
}

type FlowOperationsJob = BaseJob & {
	jobType: (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
	payload: GetPredefinedFlowsPayload;
};

class FlowOperationsHandler extends BaseProcessHandler<FlowOperationsJob> {
	async process(
		_jobId: string,
		job: FlowOperationsJob,
		_dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		switch (job.jobType) {
			case JOB_NAMES.getPredefinedFlows:
				return this.handleGetPredefinedFlows(job.payload);
			default:
				throw new Error(`Unknown flow operations job type: ${job.jobType}`);
		}
	}

	private async handleGetPredefinedFlows(
		payload: GetPredefinedFlowsPayload,
	): Promise<GetPredefinedFlowsResult> {
		const flowKey = payload.flowKey ?? "foundation";
		logInfo(`[FLOW_OPERATIONS_HANDLER] Getting predefined flows: ${flowKey}`);
		const flows =
			await serviceManager.flowBuilderService.listPredefinedFlows(flowKey);
		return {
			flows: flows.map((flow) => ({ id: flow.id, name: flow.name })),
		};
	}
}

const flowOperationsHandler = new FlowOperationsHandler();
handlerRegistry.register({
	instance: flowOperationsHandler,
	jobs: [JOB_NAMES.getPredefinedFlows],
});

declare global {
	interface JobTypeRegistry {
		"get-predefined-flows": GetPredefinedFlowsPayload;
	}

	interface JobResultRegistry {
		"get-predefined-flows": GetPredefinedFlowsResult;
	}
}
