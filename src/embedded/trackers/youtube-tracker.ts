/**
 * YouTube Video Tracker
 * Tracks YouTube video watching and captures transcripts
 */

import type { YouTubeVideoData } from "@/types/activity-tracking";

export interface YouTubePlayerState {
	videoId: string;
	currentTime: number;
	duration: number;
	playbackRate: number;
	isPlaying: boolean;
}

/**
 * YouTube Tracker Class
 */
export class YouTubeTracker {
	private videoId: string | null = null;
	private watchStartTime: number = 0;
	private totalWatchTime: number = 0;
	private lastUpdateTime: number = 0;
	private watchedRanges: Array<{ start: number; end: number }> = [];
	private player: any = null;
	private playerCheckInterval: NodeJS.Timeout | null = null;

	/**
	 * Check if current page is YouTube
	 */
	static isYouTubePage(): boolean {
		return /youtube\.com\/watch/.test(window.location.href);
	}

	/**
	 * Extract video ID from URL
	 */
	static getVideoIdFromUrl(): string | null {
		const urlParams = new URLSearchParams(window.location.search);
		return urlParams.get("v");
	}

	/**
	 * Start tracking
	 */
	start(): void {
		this.videoId = YouTubeTracker.getVideoIdFromUrl();
		if (!this.videoId) return;

		this.watchStartTime = Date.now();
		this.lastUpdateTime = Date.now();

		// Try to access YouTube player
		this.findPlayer();
	}

	/**
	 * Find YouTube player instance
	 */
	private findPlayer(): void {
		// Method 1: Check for YouTube IFrame API
		if ((window as any).YT && (window as any).YT.Player) {
			// Player API is loaded
			const iframe = document.querySelector(
				"iframe[src*='youtube.com']",
			) as HTMLIFrameElement;
			if (iframe) {
				try {
					this.player = new (window as any).YT.Player(iframe);
					this.setupPlayerListeners();
					return;
				} catch (error) {
					// Failed to create player instance
				}
			}
		}

		// Method 2: Monitor video element
		this.monitorVideoElement();
	}

	/**
	 * Monitor video element for state changes
	 */
	private monitorVideoElement(): void {
		const video = document.querySelector("video");
		if (video) {
			video.addEventListener("play", () => this.handlePlay());
			video.addEventListener("pause", () => this.handlePause());
			video.addEventListener("seeked", () => this.handleSeeked(video));
			video.addEventListener("ratechange", () =>
				this.handleRateChange(video),
			);
		}

		// Periodically check for video element
		this.playerCheckInterval = setInterval(() => {
			const video = document.querySelector("video");
			if (video && !video.dataset.tracked) {
				video.dataset.tracked = "true";
				video.addEventListener("play", () => this.handlePlay());
				video.addEventListener("pause", () => this.handlePause());
				video.addEventListener("seeked", () => this.handleSeeked(video));
				video.addEventListener("ratechange", () =>
					this.handleRateChange(video),
				);
			}
		}, 1000);
	}

	/**
	 * Setup player event listeners (when using YouTube API)
	 */
	private setupPlayerListeners(): void {
		if (!this.player) return;

		this.player.addEventListener("onStateChange", (event: any) => {
			const state = event.data;
			// YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
			if (state === 1) {
				this.handlePlay();
			} else if (state === 2) {
				this.handlePause();
			}
		});
	}

	/**
	 * Handle play event
	 */
	private handlePlay(): void {
		this.lastUpdateTime = Date.now();
	}

	/**
	 * Handle pause event
	 */
	private handlePause(): void {
		this.updateWatchTime();
	}

	/**
	 * Handle seek event
	 */
	private handleSeeked(video: HTMLVideoElement): void {
		this.updateWatchTime();
		this.lastUpdateTime = Date.now();
	}

	/**
	 * Handle playback rate change
	 */
	private handleRateChange(video: HTMLVideoElement): void {
		// Just note the change, metrics will reflect in final capture
	}

	/**
	 * Update total watch time
	 */
	private updateWatchTime(): void {
		const now = Date.now();
		const elapsed = now - this.lastUpdateTime;

		if (elapsed > 0 && elapsed < 60000) {
			// Only count if less than 1 minute (prevents counting idle time)
			this.totalWatchTime += elapsed;
		}

		this.lastUpdateTime = now;
	}

	/**
	 * Extract video metadata from page
	 */
	private extractMetadata(): Partial<YouTubeVideoData> {
		const metadata: Partial<YouTubeVideoData> = {};

		// Title
		const titleElement = document.querySelector(
			"h1.title, h1.ytd-video-primary-info-renderer yt-formatted-string",
		);
		if (titleElement) {
			metadata.title = titleElement.textContent?.trim() || "";
		}

		// Channel name
		const channelElement = document.querySelector(
			"ytd-channel-name a, #channel-name a, #owner-name a",
		);
		if (channelElement) {
			metadata.channelName = channelElement.textContent?.trim() || "";
			metadata.channelUrl = (channelElement as HTMLAnchorElement).href;
		}

		// Description
		const descElement = document.querySelector(
			"#description, ytd-text-inline-expander#description",
		);
		if (descElement) {
			const desc = descElement.textContent?.trim();
			if (desc && desc.length < 1000) {
				metadata.description = desc;
			}
		}

		// View count (from meta tags)
		const viewMeta = document.querySelector('meta[itemprop="interactionCount"]');
		if (viewMeta) {
			const views = viewMeta.getAttribute("content");
			if (views) {
				metadata.viewCount = parseInt(views, 10);
			}
		}

		// Publish date
		const dateMeta = document.querySelector('meta[itemprop="uploadDate"]');
		if (dateMeta) {
			metadata.publishDate = dateMeta.getAttribute("content") || undefined;
		}

		return metadata;
	}

	/**
	 * Get current video duration
	 */
	private getDuration(): number {
		const video = document.querySelector("video");
		if (video) {
			return video.duration || 0;
		}
		return 0;
	}

	/**
	 * Get current playback rate
	 */
	private getPlaybackRate(): number {
		const video = document.querySelector("video");
		if (video) {
			return video.playbackRate || 1.0;
		}
		return 1.0;
	}

	/**
	 * Capture transcript if available
	 */
	private async captureTranscript(): Promise<
		YouTubeVideoData["transcript"] | undefined
	> {
		try {
			// Try to get transcript from YouTube's transcript panel
			// This is a simplified approach - real implementation may need more robust DOM querying

			// Check if transcript button exists
			const transcriptButton = Array.from(
				document.querySelectorAll("button"),
			).find(
				(btn) =>
					btn.textContent?.toLowerCase().includes("transcript") ||
					btn.getAttribute("aria-label")?.toLowerCase().includes("transcript"),
			);

			if (!transcriptButton) {
				return undefined;
			}

			// Click to open transcript (if not already open)
			const transcriptPanel = document.querySelector(
				"ytd-transcript-renderer, #transcript",
			);
			if (!transcriptPanel) {
				transcriptButton.click();
				// Wait for panel to load
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			// Extract transcript segments
			const segments = document.querySelectorAll(
				"ytd-transcript-segment-renderer, .ytd-transcript-segment-renderer",
			);

			if (segments.length === 0) {
				return undefined;
			}

			const timestampedSegments: Array<{
				text: string;
				startTime: number;
				duration: number;
			}> = [];
			let fullText = "";

			segments.forEach((segment) => {
				const text =
					segment.querySelector(".segment-text")?.textContent?.trim() || "";
				const timestamp =
					segment.querySelector(".segment-timestamp")?.textContent?.trim() ||
					"";

				// Parse timestamp (format: "0:00" or "1:23:45")
				const startTime = parseTimestamp(timestamp);

				if (text) {
					timestampedSegments.push({
						text,
						startTime,
						duration: 0, // Duration between segments can be calculated
					});
					fullText += text + " ";
				}
			});

			// Calculate durations
			for (let i = 0; i < timestampedSegments.length - 1; i++) {
				timestampedSegments[i].duration =
					timestampedSegments[i + 1].startTime -
					timestampedSegments[i].startTime;
			}

			return {
				fullText: fullText.trim(),
				timestampedSegments,
				language: "en", // Default - could try to detect
				isAutoGenerated: true, // Assume auto-generated unless we can detect otherwise
			};
		} catch (error) {
			console.error("Failed to capture transcript:", error);
			return undefined;
		}
	}

	/**
	 * Capture current video data
	 */
	async capture(
		includeTranscript: boolean = true,
	): Promise<YouTubeVideoData | null> {
		if (!this.videoId) return null;

		this.updateWatchTime();

		const metadata = this.extractMetadata();
		const duration = this.getDuration();
		const watchDuration = this.totalWatchTime / 1000; // Convert to seconds
		const completionPercentage = duration > 0 ? (watchDuration / duration) * 100 : 0;

		let transcript: YouTubeVideoData["transcript"] | undefined;
		if (includeTranscript) {
			transcript = await this.captureTranscript();
		}

		const data: YouTubeVideoData = {
			type: "youtube_video",
			pageUrl: window.location.href,
			tabId: -1, // Will be set by background

			videoId: this.videoId,
			videoUrl: `https://www.youtube.com/watch?v=${this.videoId}`,
			title: metadata.title || "Unknown Video",
			channelName: metadata.channelName || "Unknown Channel",
			channelUrl: metadata.channelUrl,
			description: metadata.description,
			duration,
			publishDate: metadata.publishDate,
			viewCount: metadata.viewCount,

			watchDuration,
			completionPercentage: Math.min(completionPercentage, 100),
			playbackSpeed: this.getPlaybackRate(),
			watchedRanges: this.watchedRanges,

			transcript,

			captureTime: Date.now(),
		};

		return data;
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.playerCheckInterval) {
			clearInterval(this.playerCheckInterval);
			this.playerCheckInterval = null;
		}
	}
}

/**
 * Parse YouTube timestamp to seconds
 */
function parseTimestamp(timestamp: string): number {
	const parts = timestamp.split(":").map((p) => parseInt(p, 10));

	if (parts.length === 2) {
		// Format: "1:23"
		return parts[0] * 60 + parts[1];
	} else if (parts.length === 3) {
		// Format: "1:23:45"
		return parts[0] * 3600 + parts[1] * 60 + parts[2];
	}

	return 0;
}
