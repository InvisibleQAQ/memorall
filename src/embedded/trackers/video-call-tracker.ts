/**
 * Video Call Tracker
 * Tracks video calls on Google Meet, Zoom, Teams, and other platforms
 */

import type { VideoCallData } from "@/types/activity-tracking";

type Platform = "google_meet" | "zoom" | "teams" | "other";

/**
 * Video Call Tracker Class
 */
export class VideoCallTracker {
	private platform: Platform;
	private meetingUrl: string;
	private joinTime: number;
	private captions: NonNullable<VideoCallData["captions"]> = [];
	private captionObserver: MutationObserver | null = null;
	private captionCheckInterval: NodeJS.Timeout | null = null;
	private isTracking: boolean = false;

	constructor(platform: Platform, meetingUrl: string) {
		this.platform = platform;
		this.meetingUrl = meetingUrl;
		this.joinTime = Date.now();
	}

	/**
	 * Detect video call platform
	 */
	static detectPlatform(): Platform | null {
		const url = window.location.href;

		if (/meet\.google\.com/.test(url)) {
			return "google_meet";
		}
		if (/zoom\.us\/wc\//.test(url) || /zoom\.us\/j\//.test(url)) {
			return "zoom";
		}
		if (/teams\.microsoft\.com/.test(url) || /teams\.live\.com/.test(url)) {
			return "teams";
		}

		// Check for other video call indicators
		if (
			document.querySelector("video[autoplay]") &&
			(url.includes("call") ||
				url.includes("meet") ||
				url.includes("conference") ||
				url.includes("video"))
		) {
			return "other";
		}

		return null;
	}

	/**
	 * Extract meeting ID/code
	 */
	static extractMeetingId(platform: Platform): string | undefined {
		const url = window.location.href;

		switch (platform) {
			case "google_meet":
				// Format: https://meet.google.com/abc-defg-hij
				const meetMatch = url.match(
					/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/,
				);
				return meetMatch ? meetMatch[1] : undefined;

			case "zoom":
				// Format: https://zoom.us/j/1234567890
				const zoomMatch = url.match(/zoom\.us\/(?:wc\/)?j?\/(\d+)/);
				return zoomMatch ? zoomMatch[1] : undefined;

			case "teams":
				// Teams URLs are complex, try to extract thread ID
				const teamsMatch = url.match(/threadId=([^&]+)/);
				return teamsMatch ? teamsMatch[1] : undefined;

			default:
				return undefined;
		}
	}

	/**
	 * Start tracking
	 */
	start(captureCaptions: boolean = true): void {
		if (this.isTracking) return;

		this.isTracking = true;

		if (captureCaptions) {
			this.startCaptionTracking();
		}
	}

	/**
	 * Stop tracking
	 */
	stop(): void {
		if (!this.isTracking) return;

		this.stopCaptionTracking();
		this.isTracking = false;
	}

	/**
	 * Start tracking captions
	 */
	private startCaptionTracking(): void {
		switch (this.platform) {
			case "google_meet":
				this.trackGoogleMeetCaptions();
				break;
			case "zoom":
				this.trackZoomCaptions();
				break;
			case "teams":
				this.trackTeamsCaptions();
				break;
			default:
				this.trackGenericCaptions();
		}
	}

	/**
	 * Stop tracking captions
	 */
	private stopCaptionTracking(): void {
		if (this.captionObserver) {
			this.captionObserver.disconnect();
			this.captionObserver = null;
		}

		if (this.captionCheckInterval) {
			clearInterval(this.captionCheckInterval);
			this.captionCheckInterval = null;
		}
	}

	/**
	 * Track Google Meet captions
	 */
	private trackGoogleMeetCaptions(): void {
		// Google Meet captions appear in specific container
		const captionSelectors = [
			"[data-caption-text]",
			".iOzk7", // Caption container class (may change)
			'[jsname="dsyhDe"]', // Caption text element
			".a4cQT", // Another caption class
		];

		// Use MutationObserver to watch for caption changes
		this.captionCheckInterval = setInterval(() => {
			for (const selector of captionSelectors) {
				const captionElements = document.querySelectorAll(selector);
				captionElements.forEach((element) => {
					this.processCaptionElement(element);
				});
			}
		}, 500);

		// Also setup MutationObserver for real-time updates
		const targetNode = document.body;
		this.captionObserver = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node instanceof Element) {
						for (const selector of captionSelectors) {
							if (node.matches(selector)) {
								this.processCaptionElement(node);
							}
							const nested = node.querySelectorAll(selector);
							nested.forEach((el) => this.processCaptionElement(el));
						}
					}
				});
			});
		});

		this.captionObserver.observe(targetNode, {
			childList: true,
			subtree: true,
		});
	}

	/**
	 * Track Zoom captions
	 */
	private trackZoomCaptions(): void {
		// Zoom web client caption selectors
		const captionSelectors = [
			".live-transcription__text",
			'[class*="caption"]',
			'[class*="transcript"]',
		];

		this.captionCheckInterval = setInterval(() => {
			for (const selector of captionSelectors) {
				const captionElements = document.querySelectorAll(selector);
				captionElements.forEach((element) => {
					this.processCaptionElement(element);
				});
			}
		}, 500);
	}

	/**
	 * Track Microsoft Teams captions
	 */
	private trackTeamsCaptions(): void {
		// Teams caption selectors
		const captionSelectors = [
			'[data-tid="closed-captions-v2"]',
			".ts-calling-screen-caption",
			'[class*="caption"]',
		];

		this.captionCheckInterval = setInterval(() => {
			for (const selector of captionSelectors) {
				const captionElements = document.querySelectorAll(selector);
				captionElements.forEach((element) => {
					this.processCaptionElement(element);
				});
			}
		}, 500);
	}

	/**
	 * Track generic captions (fallback)
	 */
	private trackGenericCaptions(): void {
		const captionSelectors = [
			'[role="log"]', // ARIA live region
			'[aria-live="polite"]',
			'[aria-live="assertive"]',
			'[class*="caption"]',
			'[class*="subtitle"]',
			'[class*="transcript"]',
		];

		this.captionCheckInterval = setInterval(() => {
			for (const selector of captionSelectors) {
				const captionElements = document.querySelectorAll(selector);
				captionElements.forEach((element) => {
					this.processCaptionElement(element);
				});
			}
		}, 500);
	}

	/**
	 * Process caption element
	 */
	private processCaptionElement(element: Element): void {
		const text = element.textContent?.trim();
		if (!text || text.length === 0) return;

		// Check if this caption was already captured
		const lastCaption = this.captions[this.captions.length - 1];
		if (lastCaption && lastCaption.text === text) {
			return; // Duplicate
		}

		// Try to extract speaker name
		const speaker = this.extractSpeaker(element);

		this.captions.push({
			speaker,
			text,
			timestamp: Date.now(),
		});

		// Limit captions array size
		if (this.captions.length > 1000) {
			this.captions.shift();
		}
	}

	/**
	 * Extract speaker name from caption element
	 */
	private extractSpeaker(element: Element): string | undefined {
		// Try to find speaker name in parent or sibling elements
		const parent = element.parentElement;
		if (parent) {
			// Look for name element
			const nameElement = parent.querySelector(
				'[class*="name"], [class*="speaker"], [data-name]',
			);
			if (nameElement) {
				return nameElement.textContent?.trim();
			}

			// Check data attribute
			const speakerAttr =
				parent.getAttribute("data-speaker") ||
				element.getAttribute("data-speaker");
			if (speakerAttr) {
				return speakerAttr;
			}
		}

		return undefined;
	}

	/**
	 * Extract meeting metadata
	 */
	private extractMetadata(): Partial<VideoCallData> {
		const metadata: Partial<VideoCallData> = {};

		// Meeting title
		const titleElement = document.querySelector(
			'h1, [role="heading"], [class*="meeting-title"], [class*="call-title"]',
		);
		if (titleElement) {
			const title = titleElement.textContent?.trim();
			if (title && title.length < 200) {
				metadata.meetingTitle = title;
			}
		}

		// Participant count (if visible)
		const participantElement = document.querySelector(
			'[class*="participant-count"], [aria-label*="participant"]',
		);
		if (participantElement) {
			const text =
				participantElement.textContent ||
				participantElement.getAttribute("aria-label") ||
				"";
			const match = text.match(/(\d+)/);
			if (match) {
				metadata.participantCount = parseInt(match[1], 10);
			}
		}

		// Check if recording
		const recordingIndicator = document.querySelector(
			'[class*="recording"], [aria-label*="recording"]',
		);
		if (recordingIndicator) {
			metadata.metadata = {
				recordingEnabled: true,
			};
		}

		return metadata;
	}

	/**
	 * Capture meeting data
	 */
	capture(): VideoCallData {
		const now = Date.now();
		const duration = now - this.joinTime;
		const meetingId = VideoCallTracker.extractMeetingId(this.platform);
		const metadata = this.extractMetadata();

		const data: VideoCallData = {
			type: "video_call",
			pageUrl: this.meetingUrl,
			tabId: -1, // Will be set by background

			platform: this.platform,
			meetingId,
			meetingUrl: this.meetingUrl,
			meetingCode: meetingId,
			meetingTitle: metadata.meetingTitle,

			joinTime: this.joinTime,
			leaveTime: now,
			duration,

			participantCount: metadata.participantCount,

			captions: this.captions.length > 0 ? [...this.captions] : undefined,

			metadata: metadata.metadata,

			captureTime: now,
		};

		return data;
	}

	/**
	 * Check if meeting meets minimum duration threshold
	 */
	meetsThreshold(minDurationSeconds: number): boolean {
		const durationSeconds = (Date.now() - this.joinTime) / 1000;
		return durationSeconds >= minDurationSeconds;
	}
}
