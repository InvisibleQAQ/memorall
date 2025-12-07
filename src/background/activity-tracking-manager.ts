/**
 * Background Activity Tracking Manager
 * Coordinates activity tracking across tabs, network requests, and user interactions
 */

import { logInfo, logError, logWarn } from "@/utils/logger";
import { backgroundJob } from "@/services/background-jobs/background-job";
import type { PageVisitData, NavigationData } from "@/types/activity-tracking";

// Track active page visits
const activePageVisits = new Map<
	number,
	{ data: PageVisitData; startTime: number }
>();

// Track tab information
const tabInfo = new Map<
	number,
	{ url: string; title: string; windowId: number }
>();

class ActivityTrackingManager {
	private currentSessionId: string | null = null;

	private tabActivatedListener:
		| ((activeInfo: { tabId: number; windowId: number }) => void)
		| null = null;

	private tabUpdatedListener:
		| ((
				tabId: number,
				changeInfo: { url?: string; status?: string; title?: string },
				tab: chrome.tabs.Tab,
		  ) => void)
		| null = null;

	private tabRemovedListener:
		| ((
				tabId: number,
				removeInfo: { windowId: number; isWindowClosing: boolean },
		  ) => void)
		| null = null;

	private navigationListener:
		| ((
				details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
		  ) => void)
		| null = null;

	/**
	 * Start tracking
	 */
	async startTracking(): Promise<void> {
		try {
			// Start session via background job
			logInfo("[ACTIVITY_MANAGER] Executing activity-start-session job...");
			const jobResult = await backgroundJob.execute(
				"activity-start-session",
				{},
				{ stream: false },
			);
			logInfo("[ACTIVITY_MANAGER] Job created, waiting for result...", {
				jobId: jobResult.jobId,
			});

			const jobResponse = await jobResult.promise;
			logInfo("[ACTIVITY_MANAGER] Job completed, response:", {
				status: jobResponse.status,
				hasResult: !!jobResponse.result,
			});

			if (!jobResponse.result) {
				logError("[ACTIVITY_MANAGER] Job response:", jobResponse);
				throw new Error("Failed to start session: no result returned");
			}

			const session = jobResponse.result.session;
			this.currentSessionId = session.id;
			logInfo("Started activity tracking session:", session.id);

			// Setup listeners
			this.setupTabListeners();
			this.setupNavigationListener();

			// Notify all tabs to start tracking
			const tabs = await chrome.tabs.query({});
			for (const tab of tabs) {
				if (tab.id && this.canAccessTab(tab.url)) {
					try {
						await chrome.tabs.sendMessage(tab.id, {
							type: "START_ACTIVITY_TRACKING",
						});
					} catch (error) {
						// Tab might not have content script injected
						logWarn(`Could not start tracking on tab ${tab.id}`);
					}
				}
			}

			// Track currently active tab
			const activeTabs = await chrome.tabs.query({ active: true });
			for (const tab of activeTabs) {
				if (tab.id) {
					await this.trackPageVisit(tab.id, tab.url || "", tab.title || "");
				}
			}

			logInfo("Activity tracking fully initialized");
		} catch (error) {
			logError("Failed to start activity tracking:", error);
			throw error;
		}
	}

	/**
	 * Stop tracking
	 */
	async stopTracking(): Promise<void> {
		try {
			// End all active page visits
			for (const [tabId, visitData] of activePageVisits.entries()) {
				await this.endPageVisit(tabId);
			}

			// Stop session via background job
			await backgroundJob.execute(
				"activity-stop-session",
				{},
				{ stream: false },
			);
			this.currentSessionId = null;

			// Remove listeners
			this.removeListeners();

			// Notify all tabs to stop tracking
			const tabs = await chrome.tabs.query({});
			for (const tab of tabs) {
				if (tab.id && this.canAccessTab(tab.url)) {
					try {
						await chrome.tabs.sendMessage(tab.id, {
							type: "STOP_ACTIVITY_TRACKING",
						});
					} catch (error) {
						// Ignore errors
					}
				}
			}

			logInfo("Activity tracking stopped");
		} catch (error) {
			logError("Failed to stop activity tracking:", error);
			throw error;
		}
	}

	/**
	 * Setup tab listeners
	 */
	private setupTabListeners(): void {
		// Tab activated (switched to)
		if (!this.tabActivatedListener) {
			this.tabActivatedListener = (activeInfo: {
				tabId: number;
				windowId: number;
			}) => {
				this.handleTabActivated(activeInfo);
			};
			chrome.tabs.onActivated.addListener(this.tabActivatedListener);
		}

		// Tab updated (navigation, title change, etc.)
		if (!this.tabUpdatedListener) {
			this.tabUpdatedListener = (
				tabId: number,
				changeInfo: { url?: string; status?: string; title?: string },
				tab: chrome.tabs.Tab,
			) => {
				this.handleTabUpdated(tabId, changeInfo, tab);
			};
			chrome.tabs.onUpdated.addListener(this.tabUpdatedListener);
		}

		// Tab removed (closed)
		if (!this.tabRemovedListener) {
			this.tabRemovedListener = (
				tabId: number,
				removeInfo: { windowId: number; isWindowClosing: boolean },
			) => {
				this.handleTabRemoved(tabId);
			};
			chrome.tabs.onRemoved.addListener(this.tabRemovedListener);
		}
	}

	/**
	 * Setup navigation listener
	 */
	private setupNavigationListener(): void {
		if (this.navigationListener) return;

		this.navigationListener = (
			details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
		) => {
			this.handleNavigation(details);
		};

		chrome.webNavigation.onCommitted.addListener(this.navigationListener);
	}

	/**
	 * Remove all listeners
	 */
	private removeListeners(): void {
		if (this.tabActivatedListener) {
			chrome.tabs.onActivated.removeListener(this.tabActivatedListener);
			this.tabActivatedListener = null;
		}

		if (this.tabUpdatedListener) {
			chrome.tabs.onUpdated.removeListener(this.tabUpdatedListener);
			this.tabUpdatedListener = null;
		}

		if (this.tabRemovedListener) {
			chrome.tabs.onRemoved.removeListener(this.tabRemovedListener);
			this.tabRemovedListener = null;
		}

		if (this.navigationListener) {
			chrome.webNavigation.onCommitted.removeListener(this.navigationListener);
			this.navigationListener = null;
		}
	}

	/**
	 * Handle tab activated
	 */
	private async handleTabActivated(activeInfo: {
		tabId: number;
		windowId: number;
	}): Promise<void> {
		try {
			const tab = await chrome.tabs.get(activeInfo.tabId);

			if (tab.url && tab.title) {
				// End previous page visit if any
				for (const [tabId, _] of activePageVisits.entries()) {
					if (tabId !== activeInfo.tabId) {
						await this.endPageVisit(tabId);
					}
				}

				// Start new page visit
				await this.trackPageVisit(activeInfo.tabId, tab.url, tab.title);
			}
		} catch (error) {
			logWarn("Failed to handle tab activated:", error);
		}
	}

	/**
	 * Handle tab updated
	 */
	private async handleTabUpdated(
		tabId: number,
		changeInfo: { url?: string; status?: string; title?: string },
		tab: chrome.tabs.Tab,
	): Promise<void> {
		try {
			// Update tab info
			if (tab.url && tab.title) {
				tabInfo.set(tabId, {
					url: tab.url,
					title: tab.title,
					windowId: tab.windowId,
				});
			}

			// If URL changed, end previous visit and start new one
			if (changeInfo.url && tab.active) {
				await this.endPageVisit(tabId);
				await this.trackPageVisit(tabId, changeInfo.url, tab.title || "");
			}
		} catch (error) {
			logWarn("Failed to handle tab updated:", error);
		}
	}

	/**
	 * Handle tab removed
	 */
	private async handleTabRemoved(tabId: number): Promise<void> {
		try {
			await this.endPageVisit(tabId);
			tabInfo.delete(tabId);
		} catch (error) {
			logWarn("Failed to handle tab removed:", error);
		}
	}

	/**
	 * Handle navigation
	 */
	private async handleNavigation(
		details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
	): Promise<void> {
		try {
			// Only track main frame navigations
			if (details.frameId !== 0) return;

			const tab = tabInfo.get(details.tabId);
			const fromUrl = tab?.url || "";

			const data: NavigationData = {
				type: "navigation",
				fromUrl,
				toUrl: details.url,
				tabId: details.tabId,
				transitionType: details.transitionType,
				transitionQualifiers: details.transitionQualifiers,
			};

			await backgroundJob.execute(
				"activity-record",
				{ activityData: data },
				{ stream: false },
			);
		} catch (error) {
			logWarn("Failed to handle navigation:", error);
		}
	}

	/**
	 * Track page visit
	 * IMMEDIATELY saves the page visit event to database
	 */
	private async trackPageVisit(
		tabId: number,
		url: string,
		title: string,
	): Promise<void> {
		if (!this.canAccessTab(url)) return;

		const tab = await chrome.tabs.get(tabId);
		const startTime = Date.now();

		const data: PageVisitData = {
			type: "page_visit",
			url,
			title,
			tabId,
			windowId: tab.windowId,
			startTime,
		};

		// Store in memory for tracking duration
		activePageVisits.set(tabId, { data, startTime });
		tabInfo.set(tabId, { url, title, windowId: tab.windowId });

		// IMMEDIATELY save the page visit event to database
		try {
			await backgroundJob.execute(
				"activity-record",
				{ activityData: data },
				{ stream: false },
			);
			logInfo(`📄 Page visit recorded immediately: ${title} (${url})`);
		} catch (error) {
			logWarn("Failed to record initial page visit:", error);
		}
	}

	/**
	 * End page visit
	 */
	private async endPageVisit(tabId: number): Promise<void> {
		const visit = activePageVisits.get(tabId);
		if (!visit) return;

		const endTime = Date.now();
		const duration = endTime - visit.startTime;

		const data: PageVisitData = {
			...visit.data,
			endTime,
			duration,
		};

		try {
			await backgroundJob.execute(
				"activity-record",
				{ activityData: data },
				{ stream: false },
			);
		} catch (error) {
			logWarn("Failed to record page visit:", error);
		}

		activePageVisits.delete(tabId);
	}

	/**
	 * Handle activity captured from content script
	 */
	async handleActivityFromContent(
		activityType: string,
		data: any,
		tabId: number,
	): Promise<void> {
		try {
			// Set tabId if not already set
			if (data.tabId === -1) {
				data.tabId = tabId;
			}

			await backgroundJob.execute(
				"activity-record",
				{ activityData: data },
				{ stream: false },
			);
		} catch (error) {
			logWarn(`Failed to record ${activityType} activity:`, error);
		}
	}

	/**
	 * Check if we can access the tab
	 */
	private canAccessTab(url?: string): boolean {
		if (!url) return false;
		return (
			!url.startsWith("chrome://") && !url.startsWith("chrome-extension://")
		);
	}

	/**
	 * Check if tracking is active
	 */
	isTracking(): boolean {
		return this.currentSessionId !== null;
	}
}

// Export singleton instance
export const activityTrackingManager = new ActivityTrackingManager();
