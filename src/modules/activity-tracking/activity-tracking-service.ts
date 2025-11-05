/**
 * Activity Tracking Service
 * High-quality, type-safe service for capturing and storing user activities
 */

import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { serviceManager } from "@/services";
import { sharedStorageService } from "@/services/shared-storage";
import { logInfo, logError, logWarn } from "@/utils/logger";
import { DEFAULT_CAPTURE_CONFIG } from "@/types/activity-tracking";
import type {
	Activity,
	ActivitySession,
	ActivityData,
	ActivityFilter,
	ActivityStats,
	ActivityCaptureConfig,
	ActivityType,
} from "@/types/activity-tracking";

// Storage keys
const STORAGE_KEYS = {
	CURRENT_SESSION: "activity_current_session",
	CONFIG: "activity_capture_config",
} as const;

class ActivityTrackingService {
	private currentSession: ActivitySession | null = null;
	private config: ActivityCaptureConfig;
	private activityBuffer: Activity[] = [];
	private flushInterval: NodeJS.Timeout | null = null;
	private readonly BUFFER_SIZE = 50; // Flush to DB every 50 activities
	private readonly FLUSH_INTERVAL_MS = 30000; // Or every 30 seconds
	private initialized = false;
	private initPromise: Promise<void> | null = null;

	constructor() {
		this.config = DEFAULT_CAPTURE_CONFIG;
		// Don't initialize in constructor - do it lazily when first needed
	}

	/**
	 * Initialize the service (called lazily on first use)
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return;

		// Prevent multiple concurrent initializations
		if (this.initPromise) {
			await this.initPromise;
			return;
		}

		this.initPromise = this.initialize();
		await this.initPromise;
	}

	/**
	 * Initialize the service
	 */
	private async initialize(): Promise<void> {
		try {
			// Load configuration
			await this.loadConfig();

			// Check for active session and restore if needed
			await this.restoreActiveSession();

			this.initialized = true;
			logInfo("Activity tracking service initialized");
		} catch (error) {
			logError("Failed to initialize activity tracking service:", error);
			throw error;
		}
	}

	/**
	 * Load configuration from storage
	 */
	private async loadConfig(): Promise<void> {
		try {
			const result = await sharedStorageService.get(STORAGE_KEYS.CONFIG);
			if (result) {
				this.config = {
					...DEFAULT_CAPTURE_CONFIG,
					...result,
				};
			}
		} catch (error) {
			logWarn("Failed to load activity capture config:", error);
		}
	}

	/**
	 * Save configuration to storage
	 */
	private async saveConfig(): Promise<void> {
		try {
			await sharedStorageService.set(STORAGE_KEYS.CONFIG, this.config);
		} catch (error) {
			logWarn("Failed to save activity capture config:", error);
		}
	}

	/**
	 * Restore active session from storage
	 */
	private async restoreActiveSession(): Promise<void> {
		try {
			const sessionData = await sharedStorageService.get(
				STORAGE_KEYS.CURRENT_SESSION,
			);

			if (sessionData && sessionData.status === "active") {
				this.currentSession = sessionData;
				this.startFlushInterval();
				logInfo("Restored active activity tracking session:", sessionData.id);
			}
		} catch (error) {
			logWarn("Failed to restore active session:", error);
		}
	}

	/**
	 * Start a new activity tracking session
	 */
	async startSession(): Promise<ActivitySession> {
		await this.ensureInitialized();

		// Stop existing session if any
		if (this.currentSession && this.currentSession.status === "active") {
			await this.stopSession();
		}

		// Create new session
		const session: ActivitySession = {
			id: nanoid(),
			startTime: Date.now(),
			endTime: null,
			totalActivities: 0,
			status: "active",
			metadata: {
				browserVersion: navigator.userAgent,
				platform: navigator.platform,
			},
		};

		this.currentSession = session;

		// Save to storage
		await sharedStorageService.set(STORAGE_KEYS.CURRENT_SESSION, session);

		// Store session in database
		await this.saveSessionToDatabase(session);

		// Start periodic flush
		this.startFlushInterval();

		logInfo("Started activity tracking session:", session.id);

		return session;
	}

	/**
	 * Stop the current activity tracking session
	 */
	async stopSession(): Promise<ActivitySession | null> {
		await this.ensureInitialized();

		if (!this.currentSession) {
			logWarn("No active session to stop");
			return null;
		}

		// Update session
		this.currentSession.endTime = Date.now();
		this.currentSession.status = "stopped";

		// Flush any remaining activities
		await this.flushActivities();

		// Stop flush interval
		this.stopFlushInterval();

		// Update in database
		await this.saveSessionToDatabase(this.currentSession);

		// Clear from storage
		await sharedStorageService.remove(STORAGE_KEYS.CURRENT_SESSION);

		const stoppedSession = this.currentSession;
		this.currentSession = null;

		logInfo("Stopped activity tracking session:", stoppedSession.id);

		return stoppedSession;
	}

	/**
	 * Record a new activity
	 */
	async recordActivity(data: ActivityData): Promise<Activity | null> {
		await this.ensureInitialized();

		if (!this.currentSession || this.currentSession.status !== "active") {
			throw new Error("No active session. Start a session first.");
		}

		// Check if this activity type is enabled
		if (!this.isActivityTypeEnabled(data.type)) {
			logInfo(`Activity type ${data.type} is disabled, skipping`);
			return null; // This won't be used since we return early
		}

		const activity: Activity = {
			id: nanoid(),
			sessionId: this.currentSession.id,
			type: data.type,
			timestamp: Date.now(),
			data,
		};

		// Add to buffer
		this.activityBuffer.push(activity);

		// Update session total
		this.currentSession.totalActivities++;
		await sharedStorageService.set(
			STORAGE_KEYS.CURRENT_SESSION,
			this.currentSession,
		);

		// Flush if buffer is full
		if (this.activityBuffer.length >= this.BUFFER_SIZE) {
			await this.flushActivities();
		}

		return activity;
	}

	/**
	 * Check if an activity type is enabled in config
	 */
	private isActivityTypeEnabled(type: ActivityData["type"]): boolean {
		const typeToConfigMap: Record<string, keyof ActivityCaptureConfig> = {
			page_visit: "trackPageVisits",
			network_request: "trackNetworkRequests",
			user_input: "trackUserInputs",
			click: "trackClicks",
			scroll: "trackScrolls",
			form_submit: "trackFormSubmits",
			text_reading: "trackTextReading",
		};

		const configKey = typeToConfigMap[type];
		return configKey ? this.config[configKey] === true : false;
	}

	/**
	 * Flush buffered activities to database
	 */
	private async flushActivities(): Promise<void> {
		if (this.activityBuffer.length === 0) return;

		const activitiesToFlush = [...this.activityBuffer];
		this.activityBuffer = [];

		try {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				// Store activities in dedicated activities table
				for (const activity of activitiesToFlush) {
					await db.insert(schema.activities).values({
						id: activity.id,
						sessionId: activity.sessionId,
						type: activity.type,
						timestamp: new Date(activity.timestamp),
						data: activity.data as unknown as Record<string, unknown>,
						createdAt: new Date(activity.timestamp),
						updatedAt: new Date(activity.timestamp),
					});
				}
			});

			logInfo(`Flushed ${activitiesToFlush.length} activities to database`);
		} catch (error) {
			logError("Failed to flush activities:", error);
			// Re-add failed activities to buffer (at the front)
			this.activityBuffer.unshift(...activitiesToFlush);
		}
	}

	/**
	 * Save session to database
	 */
	private async saveSessionToDatabase(session: ActivitySession): Promise<void> {
		try {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				// Check if exists
				const existing = await db
					.select()
					.from(schema.activitySessions)
					.where(eq(schema.activitySessions.id, session.id))
					.limit(1);

				if (existing.length > 0) {
					// Update
					await db
						.update(schema.activitySessions)
						.set({
							endTime: session.endTime ? new Date(session.endTime) : null,
							totalActivities: session.totalActivities,
							status: session.status,
							metadata: session.metadata,
							updatedAt: new Date(),
						})
						.where(eq(schema.activitySessions.id, session.id));
				} else {
					// Insert
					await db.insert(schema.activitySessions).values({
						id: session.id,
						startTime: new Date(session.startTime),
						endTime: session.endTime ? new Date(session.endTime) : null,
						totalActivities: session.totalActivities,
						status: session.status,
						metadata: session.metadata,
						createdAt: new Date(),
						updatedAt: new Date(),
					});
				}
			});
		} catch (error) {
			logError("Failed to save session to database:", error);
		}
	}

	/**
	 * Start periodic flush interval
	 */
	private startFlushInterval(): void {
		if (this.flushInterval) return;

		this.flushInterval = setInterval(() => {
			this.flushActivities();
		}, this.FLUSH_INTERVAL_MS);
	}

	/**
	 * Stop periodic flush interval
	 */
	private stopFlushInterval(): void {
		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}
	}

	/**
	 * Get current active session
	 */
	getCurrentSession(): ActivitySession | null {
		return this.currentSession;
	}

	/**
	 * Check if tracking is active
	 */
	isTracking(): boolean {
		return (
			this.currentSession !== null && this.currentSession.status === "active"
		);
	}

	/**
	 * Get all sessions
	 */
	async getSessions(): Promise<ActivitySession[]> {
		await this.ensureInitialized();

		try {
			const sessions = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					const results = await db
						.select()
						.from(schema.activitySessions)
						.orderBy(schema.activitySessions.startTime);

					// Convert database rows to ActivitySession format
					return results.map((row) => ({
						id: row.id,
						startTime: row.startTime.getTime(),
						endTime: row.endTime ? row.endTime.getTime() : null,
						totalActivities: row.totalActivities,
						status: row.status as "active" | "stopped",
						metadata: row.metadata as Record<string, unknown>,
					}));
				},
			);

			// Sort by start time descending
			return sessions.sort((a, b) => b.startTime - a.startTime);
		} catch (error) {
			logError("Failed to get sessions:", error);
			return [];
		}
	}

	/**
	 * Get activities for a session
	 */
	async getActivities(filter: ActivityFilter = {}): Promise<Activity[]> {
		await this.ensureInitialized();

		try {
			const activities = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					let query = db.select().from(schema.activities);

					// Apply session filter
					if (filter.sessionId) {
						query = query.where(
							eq(schema.activities.sessionId, filter.sessionId),
						) as typeof query;
					}

					const results = await query;

					// Convert database rows to Activity format and apply additional filters
					return results
						.map((row) => ({
							id: row.id,
							sessionId: row.sessionId,
							type: row.type as ActivityType,
							timestamp: row.timestamp.getTime(),
							data: row.data as unknown as ActivityData,
						}))
						.filter((activity) => {
							// Apply type filter
							if (
								filter.types &&
								filter.types.length > 0 &&
								!filter.types.includes(activity.type)
							) {
								return false;
							}
							// Apply time filters
							if (filter.startTime && activity.timestamp < filter.startTime) {
								return false;
							}
							if (filter.endTime && activity.timestamp > filter.endTime) {
								return false;
							}
							return true;
						});
				},
			);

			// Sort by timestamp descending
			const sorted = activities.sort((a, b) => b.timestamp - a.timestamp);

			// Apply pagination
			if (filter.offset !== undefined || filter.limit !== undefined) {
				const offset = filter.offset || 0;
				const limit = filter.limit || sorted.length;
				return sorted.slice(offset, offset + limit);
			}

			return sorted;
		} catch (error) {
			logError("Failed to get activities:", error);
			return [];
		}
	}

	/**
	 * Delete a session and all its activities
	 */
	async deleteSession(sessionId: string): Promise<void> {
		await this.ensureInitialized();

		try {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				// Delete activities first (they reference the session)
				await db
					.delete(schema.activities)
					.where(eq(schema.activities.sessionId, sessionId));

				// Delete session
				await db
					.delete(schema.activitySessions)
					.where(eq(schema.activitySessions.id, sessionId));
			});

			logInfo(`Deleted session ${sessionId} and all its activities`);
		} catch (error) {
			logError("Failed to delete session:", error);
			throw error;
		}
	}

	/**
	 * Get statistics for a session
	 */
	async getSessionStats(sessionId: string): Promise<ActivityStats> {
		await this.ensureInitialized();

		const activities = await this.getActivities({ sessionId });

		const stats: ActivityStats = {
			totalActivities: activities.length,
			byType: {
				page_visit: 0,
				network_request: 0,
				user_input: 0,
				click: 0,
				scroll: 0,
				navigation: 0,
				form_submit: 0,
				text_reading: 0,
			},
			uniquePages: 0,
			totalDuration: 0,
			mostVisitedPages: [],
		};

		const pageVisits = new Map<string, number>();

		for (const activity of activities) {
			stats.byType[activity.type]++;

			// Track unique pages
			if ("pageUrl" in activity.data) {
				const url = activity.data.pageUrl;
				pageVisits.set(url, (pageVisits.get(url) || 0) + 1);
			}
		}

		stats.uniquePages = pageVisits.size;

		// Get most visited pages
		stats.mostVisitedPages = Array.from(pageVisits.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([url, count]) => ({ url, count }));

		return stats;
	}

	/**
	 * Update configuration
	 */
	async updateConfig(config: Partial<ActivityCaptureConfig>): Promise<void> {
		await this.ensureInitialized();

		this.config = {
			...this.config,
			...config,
		};
		await this.saveConfig();
		logInfo("Updated activity capture configuration");
	}

	/**
	 * Get current configuration
	 */
	async getConfig(): Promise<ActivityCaptureConfig> {
		await this.ensureInitialized();
		return { ...this.config };
	}
}

// Export singleton instance
export const activityTrackingService = new ActivityTrackingService();
