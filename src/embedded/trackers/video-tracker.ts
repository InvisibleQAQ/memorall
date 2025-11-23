/**
 * HTML5 Video Watching Tracker
 * Tracks generic HTML5 video playback
 */

import type { VideoWatchingData } from "@/types/activity-tracking";

/**
 * Video Tracker Class
 */
export class VideoTracker {
	private videoElement: HTMLVideoElement;
	private watchStartTime: number = 0;
	private totalWatchTime: number = 0;
	private lastUpdateTime: number = 0;
	private events: VideoWatchingData["events"] = [];
	private isTracking: boolean = false;

	constructor(videoElement: HTMLVideoElement) {
		this.videoElement = videoElement;
	}

	/**
	 * Find all video elements on page
	 */
	static findVideoElements(): HTMLVideoElement[] {
		const videos = Array.from(document.querySelectorAll("video"));

		// Filter out tiny videos (likely ads or thumbnails)
		return videos.filter((video) => {
			const rect = video.getBoundingClientRect();
			return rect.width >= 200 && rect.height >= 150;
		});
	}

	/**
	 * Start tracking
	 */
	start(): void {
		if (this.isTracking) return;

		this.isTracking = true;
		this.watchStartTime = Date.now();
		this.lastUpdateTime = Date.now();

		// Setup event listeners
		this.videoElement.addEventListener("play", this.handlePlay);
		this.videoElement.addEventListener("pause", this.handlePause);
		this.videoElement.addEventListener("seeked", this.handleSeeked);
		this.videoElement.addEventListener("ended", this.handleEnded);
		this.videoElement.addEventListener("ratechange", this.handleRateChange);
	}

	/**
	 * Stop tracking
	 */
	stop(): void {
		if (!this.isTracking) return;

		this.updateWatchTime();

		// Remove event listeners
		this.videoElement.removeEventListener("play", this.handlePlay);
		this.videoElement.removeEventListener("pause", this.handlePause);
		this.videoElement.removeEventListener("seeked", this.handleSeeked);
		this.videoElement.removeEventListener("ended", this.handleEnded);
		this.videoElement.removeEventListener("ratechange", this.handleRateChange);

		this.isTracking = false;
	}

	/**
	 * Handle play event
	 */
	private handlePlay = (): void => {
		this.lastUpdateTime = Date.now();
		this.recordEvent("play");
	};

	/**
	 * Handle pause event
	 */
	private handlePause = (): void => {
		this.updateWatchTime();
		this.recordEvent("pause");
	};

	/**
	 * Handle seeked event
	 */
	private handleSeeked = (): void => {
		this.updateWatchTime();
		this.recordEvent("seek");
		this.lastUpdateTime = Date.now();
	};

	/**
	 * Handle ended event
	 */
	private handleEnded = (): void => {
		this.updateWatchTime();
		this.recordEvent("ended");
	};

	/**
	 * Handle rate change event
	 */
	private handleRateChange = (): void => {
		this.recordEvent("ratechange");
	};

	/**
	 * Record an event
	 */
	private recordEvent(
		type: "play" | "pause" | "seek" | "ended" | "ratechange",
	): void {
		this.events.push({
			type,
			timestamp: Date.now(),
			position: this.videoElement.currentTime,
			metadata: {
				playbackRate: this.videoElement.playbackRate,
				volume: this.videoElement.volume,
				muted: this.videoElement.muted,
			},
		});

		// Limit events array size
		if (this.events.length > 100) {
			this.events.shift();
		}
	}

	/**
	 * Update total watch time
	 */
	private updateWatchTime(): void {
		const now = Date.now();
		const elapsed = now - this.lastUpdateTime;

		if (elapsed > 0 && elapsed < 60000) {
			// Only count if less than 1 minute
			this.totalWatchTime += elapsed;
		}

		this.lastUpdateTime = now;
	}

	/**
	 * Extract video metadata
	 */
	private extractMetadata(): {
		videoUrl?: string;
		videoTitle?: string;
		posterUrl?: string;
	} {
		const metadata: {
			videoUrl?: string;
			videoTitle?: string;
			posterUrl?: string;
		} = {};

		// Get video source
		const source = this.videoElement.querySelector("source");
		if (source) {
			metadata.videoUrl = source.src;
		} else {
			metadata.videoUrl = this.videoElement.src;
		}

		// Try to find video title from nearby elements
		const title = this.findVideoTitle();
		if (title) {
			metadata.videoTitle = title;
		}

		// Poster image
		if (this.videoElement.poster) {
			metadata.posterUrl = this.videoElement.poster;
		}

		return metadata;
	}

	/**
	 * Find video title from page context
	 */
	private findVideoTitle(): string | undefined {
		// Method 1: Check nearby headings
		const container = this.videoElement.closest(
			"article, section, .video-container, [class*='video']",
		);
		if (container) {
			const heading = container.querySelector("h1, h2, h3");
			if (heading) {
				return heading.textContent?.trim();
			}
		}

		// Method 2: Check meta tags
		const ogTitle = document.querySelector('meta[property="og:title"]');
		if (ogTitle) {
			return ogTitle.getAttribute("content") || undefined;
		}

		// Method 3: Use page title
		return document.title;
	}

	/**
	 * Detect embed context
	 */
	private detectEmbedContext(): VideoWatchingData["embedContext"] {
		// Check if video is in iframe
		if (this.videoElement.closest("iframe")) {
			return {
				embedType: "iframe",
			};
		}

		// Check if video has specific player classes
		const container = this.videoElement.closest(
			"[class*='player'], [class*='video']",
		);
		if (container) {
			return {
				embedType: "custom",
				containerSelector: container.className || undefined,
			};
		}

		return {
			embedType: "native",
		};
	}

	/**
	 * Capture video data
	 */
	capture(): VideoWatchingData | null {
		if (!this.isTracking) return null;

		this.updateWatchTime();

		const metadata = this.extractMetadata();
		const duration = this.videoElement.duration || 0;
		const watchDuration = this.totalWatchTime / 1000; // Convert to seconds
		const completionPercentage =
			duration > 0 ? (watchDuration / duration) * 100 : 0;

		const data: VideoWatchingData = {
			type: "video_watching",
			pageUrl: window.location.href,
			pageTitle: document.title,
			tabId: -1, // Will be set by background

			videoUrl: metadata.videoUrl || "",
			videoTitle: metadata.videoTitle,
			posterUrl: metadata.posterUrl,
			duration,

			watchDuration,
			completionPercentage: Math.min(completionPercentage, 100),
			playbackSpeed: this.videoElement.playbackRate,

			events: [...this.events],

			embedContext: this.detectEmbedContext(),

			captureTime: Date.now(),
		};

		return data;
	}

	/**
	 * Check if video meets minimum watch threshold
	 */
	meetsThreshold(minWatchSeconds: number): boolean {
		const watchSeconds = this.totalWatchTime / 1000;
		return watchSeconds >= minWatchSeconds;
	}
}
