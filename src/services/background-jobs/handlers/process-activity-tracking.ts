import { logInfo, logError } from "@/utils/logger";
import { handlerRegistry } from "./handler-registry";
import type {
	ProcessHandler,
	ProcessDependencies,
	BaseJob,
	ItemHandlerResult,
} from "./types";
import { activityTrackingService } from "@/modules/activity-tracking/activity-tracking-service";
import type {
	Activity,
	ActivitySession,
	ActivityData,
	ActivityFilter,
	ActivityStats,
} from "@/types/activity-tracking";

const JOB_NAMES = {
	startSession: "activity-start-session",
	stopSession: "activity-stop-session",
	recordActivity: "activity-record",
	getSessions: "activity-get-sessions",
	getActivities: "activity-get-activities",
	deleteSession: "activity-delete-session",
	getSessionStats: "activity-get-stats",
} as const;

// Define payload interfaces
export interface StartSessionPayload extends Record<string, unknown> {}

export interface StopSessionPayload extends Record<string, unknown> {}

export interface RecordActivityPayload extends Record<string, unknown> {
	activityData: ActivityData;
}

export interface GetSessionsPayload extends Record<string, unknown> {}

export interface GetActivitiesPayload extends Record<string, unknown> {
	filter?: ActivityFilter;
}

export interface DeleteSessionPayload extends Record<string, unknown> {
	sessionId: string;
}

export interface GetSessionStatsPayload extends Record<string, unknown> {
	sessionId: string;
}

// Define result types
export interface StartSessionResult extends Record<string, unknown> {
	session: ActivitySession;
}

export interface StopSessionResult extends Record<string, unknown> {
	session: ActivitySession | null;
}

export interface RecordActivityResult extends Record<string, unknown> {
	activity?: Activity;
}

export interface GetSessionsResult extends Record<string, unknown> {
	sessions: ActivitySession[];
}

export interface GetActivitiesResult extends Record<string, unknown> {
	activities: Activity[];
}

export interface DeleteSessionResult extends Record<string, unknown> {
	success: boolean;
}

export interface GetSessionStatsResult extends Record<string, unknown> {
	stats: ActivityStats;
}

export type ActivityTrackingJob = BaseJob & {
	jobType: (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
	payload:
		| StartSessionPayload
		| StopSessionPayload
		| RecordActivityPayload
		| GetSessionsPayload
		| GetActivitiesPayload
		| DeleteSessionPayload
		| GetSessionStatsPayload;
};

class ActivityTrackingHandler implements ProcessHandler<BaseJob> {
	async process(
		jobId: string,
		job: BaseJob,
		dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		try {
			logInfo("[ACTIVITY_TRACKING_HANDLER] Processing job:", {
				jobId,
				jobType: job?.jobType,
			});

			switch (job.jobType) {
				case JOB_NAMES.startSession:
					return this.handleStartSession(jobId, job);
				case JOB_NAMES.stopSession:
					return this.handleStopSession(jobId, job);
				case JOB_NAMES.recordActivity:
					return this.handleRecordActivity(jobId, job);
				case JOB_NAMES.getSessions:
					return this.handleGetSessions(jobId, job);
				case JOB_NAMES.getActivities:
					return this.handleGetActivities(jobId, job);
				case JOB_NAMES.deleteSession:
					return this.handleDeleteSession(jobId, job);
				case JOB_NAMES.getSessionStats:
					return this.handleGetSessionStats(jobId, job);
				default:
					throw new Error(`Unknown activity tracking job type: ${job.jobType}`);
			}
		} catch (error) {
			logError("[ACTIVITY_TRACKING_HANDLER] Job processing failed:", error);
			throw error;
		}
	}

	private async handleStartSession(
		jobId: string,
		job: BaseJob,
	): Promise<StartSessionResult> {
		logInfo("[ACTIVITY_TRACKING_HANDLER] Starting activity tracking session");

		try {
			const session = await activityTrackingService.startSession();
			logInfo(
				"[ACTIVITY_TRACKING_HANDLER] Session started successfully:",
				session.id,
			);
			return { session };
		} catch (error) {
			logError("[ACTIVITY_TRACKING_HANDLER] Failed to start session:", error);
			throw error;
		}
	}

	private async handleStopSession(
		jobId: string,
		job: BaseJob,
	): Promise<StopSessionResult> {
		logInfo("[ACTIVITY_TRACKING_HANDLER] Stopping activity tracking session");

		const session = await activityTrackingService.stopSession();

		return { session };
	}

	private async handleRecordActivity(
		jobId: string,
		job: BaseJob,
	): Promise<RecordActivityResult> {
		const payload = job.payload as RecordActivityPayload;

		logInfo("[ACTIVITY_TRACKING_HANDLER] Recording activity", {
			type: payload.activityData.type,
		});

		const activity = await activityTrackingService.recordActivity(
			payload.activityData,
		);

		return { activity: activity || undefined };
	}

	private async handleGetSessions(
		jobId: string,
		job: BaseJob,
	): Promise<GetSessionsResult> {
		logInfo("[ACTIVITY_TRACKING_HANDLER] Fetching all sessions");

		const sessions = await activityTrackingService.getSessions();

		return { sessions };
	}

	private async handleGetActivities(
		jobId: string,
		job: BaseJob,
	): Promise<GetActivitiesResult> {
		const payload = job.payload as GetActivitiesPayload;

		logInfo("[ACTIVITY_TRACKING_HANDLER] Fetching activities", {
			filter: payload.filter,
		});

		const activities = await activityTrackingService.getActivities(
			payload.filter || {},
		);

		return { activities };
	}

	private async handleDeleteSession(
		jobId: string,
		job: BaseJob,
	): Promise<DeleteSessionResult> {
		const payload = job.payload as DeleteSessionPayload;

		logInfo("[ACTIVITY_TRACKING_HANDLER] Deleting session", {
			sessionId: payload.sessionId,
		});

		await activityTrackingService.deleteSession(payload.sessionId);

		return { success: true };
	}

	private async handleGetSessionStats(
		jobId: string,
		job: BaseJob,
	): Promise<GetSessionStatsResult> {
		const payload = job.payload as GetSessionStatsPayload;

		logInfo("[ACTIVITY_TRACKING_HANDLER] Fetching session stats", {
			sessionId: payload.sessionId,
		});

		const stats = await activityTrackingService.getSessionStats(
			payload.sessionId,
		);

		return { stats };
	}
}

// Register the handler
const handler = new ActivityTrackingHandler();
handlerRegistry.register({
	instance: handler as ProcessHandler<BaseJob>,
	jobs: [
		"activity-start-session",
		"activity-stop-session",
		"activity-record",
		"activity-get-sessions",
		"activity-get-activities",
		"activity-delete-session",
		"activity-get-stats",
	],
});

// Extend global registry for smart type inference
declare global {
	interface JobTypeRegistry {
		"activity-start-session": StartSessionPayload;
		"activity-stop-session": StopSessionPayload;
		"activity-record": RecordActivityPayload;
		"activity-get-sessions": GetSessionsPayload;
		"activity-get-activities": GetActivitiesPayload;
		"activity-delete-session": DeleteSessionPayload;
		"activity-get-stats": GetSessionStatsPayload;
	}

	interface JobResultRegistry {
		"activity-start-session": StartSessionResult;
		"activity-stop-session": StopSessionResult;
		"activity-record": RecordActivityResult;
		"activity-get-sessions": GetSessionsResult;
		"activity-get-activities": GetActivitiesResult;
		"activity-delete-session": DeleteSessionResult;
		"activity-get-stats": GetSessionStatsResult;
	}
}
