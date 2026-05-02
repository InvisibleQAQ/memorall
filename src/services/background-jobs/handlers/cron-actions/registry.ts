import type { CronTriggerPayload } from "@/services/cron-jobs";
import type { CronJob } from "@/services/database/types";
import type {
	ItemHandlerResult,
	ProcessDependencies,
} from "@/services/background-jobs/handlers/types";

export interface CronActionContext {
	cronJob: CronJob;
	reason: CronTriggerPayload["reason"];
	dependencies: ProcessDependencies;
	jobId: string;
}

export type CronActionHandler = (
	context: CronActionContext,
) => Promise<ItemHandlerResult>;

class CronActionRegistry {
	private handlers = new Map<string, CronActionHandler>();

	register(actionType: string, handler: CronActionHandler): void {
		this.handlers.set(actionType, handler);
	}

	get(actionType: string): CronActionHandler {
		const handler = this.handlers.get(actionType);
		if (!handler) {
			throw new Error(`No cron action registered: ${actionType}`);
		}
		return handler;
	}

	list(): string[] {
		return Array.from(this.handlers.keys());
	}
}

export const cronActionRegistry = new CronActionRegistry();
