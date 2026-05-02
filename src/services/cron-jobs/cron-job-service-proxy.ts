import { backgroundJob } from "@/services/background-jobs/background-job";
import type { IDatabaseService } from "@/services/database/interfaces/database-service.interface";
import { CronJobServiceCore } from "./cron-job-service-core";
import type { CronOperationPayload } from "./types";

export class CronJobServiceProxy extends CronJobServiceCore {
	constructor(databaseService: IDatabaseService) {
		super(databaseService);
	}

	private async sendOperation(payload: CronOperationPayload): Promise<void> {
		const result = await backgroundJob.execute("cron-operation", payload, {
			stream: false,
		});
		if ("promise" in result) {
			await result.promise;
		}
	}

	async reload(id?: string): Promise<void> {
		await this.sendOperation({
			operation: id ? "reload-one" : "reload",
			cronJobId: id,
		});
	}

	async triggerNow(id: string): Promise<void> {
		await this.sendOperation({ operation: "trigger-now", cronJobId: id });
	}
}
