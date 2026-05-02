import type {
	AgentChatCronPayload,
	CronJob,
	CronJobActionType,
	CronJobStatus,
} from "@/services/database/types";

export type { AgentChatCronPayload, CronJob, CronJobActionType, CronJobStatus };

export interface CronJobDraft {
	id?: string;
	name: string;
	status: CronJobStatus;
	scheduleExpression: string;
	timezone?: string;
	actionType: CronJobActionType;
	actionPayload: Record<string, unknown>;
	agentFlowId?: string | null;
	conversationId?: string | null;
	allowOverlap?: boolean;
	metadata?: Record<string, unknown>;
}

export interface CronJobSaveInput extends CronJobDraft {
	id?: string;
}

export interface CronJobValidation {
	valid: boolean;
	error?: string;
	nextRunAt?: Date;
}

export interface CronOperationPayload {
	operation: "reload" | "reload-one" | "delete-one" | "trigger-now";
	cronJobId?: string;
}

export interface CronTriggerPayload {
	cronJobId: string;
	reason: "schedule" | "manual";
}

export interface ICronJobService {
	initialize(): Promise<void>;
	validateSchedule(expression: string, from?: Date): CronJobValidation;
	getNextRunAt(expression: string, from?: Date): Date;
	listByAgent(agentFlowId: string): Promise<CronJob[]>;
	save(input: CronJobSaveInput): Promise<CronJob>;
	saveManyForAgent(
		agentFlowId: string,
		jobs: CronJobSaveInput[],
		options?: { activateDrafts?: boolean },
	): Promise<CronJob[]>;
	delete(id: string): Promise<void>;
	triggerNow(id: string): Promise<void>;
	reload(id?: string): Promise<void>;
}
