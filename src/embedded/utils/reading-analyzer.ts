/**
 * Reading Analyzer Utility
 * Tracks visible content and determines if user has read it
 */

import {
	countWords,
	extractVisibleContent,
	invalidateVisibilityCache,
} from "./visible-content-extractor";

export interface ReadingMetrics {
	viewDuration: number; // Total time on page (ms)
	estimatedWordsRead: number; // Words that were visible
}

/**
 * Visible Content Reading Tracker
 * Tracks what content user has actually seen in viewport
 */
export class ReadingAnalyzer {
	private startTime: number;
	private accumulatedVisibleContent: Set<string> = new Set(); // Unique text segments
	private lastScrollY: number = 0;
	private lastVisibleContent: string = "";
	private readonly WORDS_PER_SECOND = 200 / 60; // 200 WPM = 3.33 WPS
	private pendingUpdateHandle: number | null = null; // Track pending updates

	// SMART SCROLL-STOP DETECTION
	private isScrolling: boolean = false;
	private scrollStopTimer: NodeJS.Timeout | null = null;
	private idleCaptureTimer: NodeJS.Timeout | null = null;
	private lastScrollTime: number = 0;
	private readonly SCROLL_STOP_DELAY_MS = 5000; // Capture after 5s of no scrolling
	private readonly IDLE_CAPTURE_INTERVAL_MS = 4000; // Continue capturing every 4s while idle
	private onScrollStopCallback: (() => void) | null = null;

	// CONTENT DEDUPLICATION & PROGRESS TRACKING
	private lastCapturedContent: Set<string> = new Set(); // Track captured content to avoid duplicates
	private lastCaptureTime: number = 0; // Track when we last captured
	private readonly MIN_NEW_CONTENT_RATIO = 0.3; // Need at least 30% new content to capture
	private readonly MIN_TIME_BETWEEN_CAPTURES_MS = 15000; // OR 15 seconds more reading time

	constructor() {
		this.startTime = Date.now();
		this.lastScrollY = window.scrollY;
		this.lastScrollTime = Date.now();

		// Capture initial visible content (async to avoid blocking)
		this.scheduleUpdate(() => {
			this.updateVisibleContent();
		});
	}

	/**
	 * Update visible content (call on scroll or periodically)
	 * OPTIMIZED: Runs only when browser is idle
	 */
	updateVisibleContent(): void {
		const visibleContent = extractVisibleContent();

		// Only add if it's different from last capture (user scrolled to new content)
		if (visibleContent && visibleContent !== this.lastVisibleContent) {
			// Split into sentences/paragraphs and add to set to avoid duplicates
			const sentences = visibleContent
				.split(/[.!?]\s+/)
				.filter((s) => s.trim().length > 20);

			sentences.forEach((sentence) => {
				this.accumulatedVisibleContent.add(sentence.trim());
			});

			this.lastVisibleContent = visibleContent;
		}

		// Clear pending update flag
		this.pendingUpdateHandle = null;
	}

	/**
	 * Record scroll event
	 * SMART: Detect when user STOPS scrolling to capture content
	 * PERFORMANCE: No content extraction during active scrolling
	 */
	recordScroll(scrollY: number): void {
		const scrollDiff = Math.abs(scrollY - this.lastScrollY);
		const now = Date.now();

		// User is scrolling - mark as active
		if (scrollDiff > 10) {
			// Any scroll movement
			this.isScrolling = true;
			this.lastScrollTime = now;
			this.lastScrollY = scrollY;

			// Clear scroll-stop timer (user is still scrolling)
			if (this.scrollStopTimer) {
				clearTimeout(this.scrollStopTimer);
				this.scrollStopTimer = null;
			}

			// Clear idle capture timer (user is not idle)
			if (this.idleCaptureTimer) {
				clearTimeout(this.idleCaptureTimer);
				this.idleCaptureTimer = null;
			}

			// PERFORMANCE FIX: Removed content extraction during scrolling
			// Only extract on scroll-stop to avoid expensive DOM operations

			// Set timer to detect when scrolling stops
			this.scrollStopTimer = setTimeout(() => {
				this.onScrollStop();
			}, this.SCROLL_STOP_DELAY_MS);
		}
	}

	/**
	 * Called when user stops scrolling for SCROLL_STOP_DELAY_MS
	 * This indicates they might be reading
	 */
	private onScrollStop(): void {
		this.isScrolling = false;

		// PERFORMANCE: Invalidate cache once when scroll stops (not during scrolling)
		invalidateVisibilityCache();

		// Update visible content immediately (user stopped to read)
		this.updateVisibleContent();

		// Trigger callback if registered (tells activity tracker to check for capture)
		if (this.onScrollStopCallback) {
			this.onScrollStopCallback();
		}

		// Start idle capture timer (continue capturing while user reads)
		this.startIdleCapture();
	}

	/**
	 * Start continuous capture while user is idle (reading)
	 */
	private startIdleCapture(): void {
		// Clear existing timer
		if (this.idleCaptureTimer) {
			clearTimeout(this.idleCaptureTimer);
		}

		// Schedule next capture
		this.idleCaptureTimer = setTimeout(() => {
			if (!this.isScrolling) {
				// Still idle - update content and trigger callback
				this.updateVisibleContent();

				if (this.onScrollStopCallback) {
					this.onScrollStopCallback();
				}

				// Continue idle capture
				this.startIdleCapture();
			}
		}, this.IDLE_CAPTURE_INTERVAL_MS);
	}

	/**
	 * Register callback for when user stops scrolling
	 */
	setScrollStopCallback(callback: () => void): void {
		this.onScrollStopCallback = callback;
	}

	/**
	 * Check if user is currently scrolling
	 */
	isUserScrolling(): boolean {
		return this.isScrolling;
	}

	/**
	 * Check if should capture based on content OR reading progress
	 * Returns true if: (1) enough NEW content OR (2) enough MORE reading time
	 */
	hasNewContentOrProgress(): boolean {
		const currentContent = this.accumulatedVisibleContent;
		const now = Date.now();

		// If nothing captured yet, always consider it new
		if (this.lastCapturedContent.size === 0) {
			return true;
		}

		// Check 1: Has user spent significantly more time reading?
		// (Captures reading PROGRESS even on same content)
		const timeSinceLastCapture = now - this.lastCaptureTime;
		if (timeSinceLastCapture >= this.MIN_TIME_BETWEEN_CAPTURES_MS) {
			// User has been reading for 15+ more seconds
			return true;
		}

		// Check 2: Is there new content?
		let newContentCount = 0;
		let totalContentCount = currentContent.size;

		for (const sentence of currentContent) {
			if (!this.lastCapturedContent.has(sentence)) {
				newContentCount++;
			}
		}

		// Calculate ratio of new content
		const newContentRatio =
			totalContentCount > 0 ? newContentCount / totalContentCount : 0;

		// Need at least MIN_NEW_CONTENT_RATIO (30%) new content
		return newContentRatio >= this.MIN_NEW_CONTENT_RATIO;
	}

	/**
	 * Mark current content as captured (for deduplication)
	 */
	markContentAsCaptured(): void {
		// Store captured content and time
		this.lastCapturedContent = new Set(this.accumulatedVisibleContent);
		this.lastCaptureTime = Date.now();
	}

	/**
	 * Schedule a callback to run when browser is idle
	 * OPTIMIZED: Uses requestIdleCallback with timeout parameter
	 * Falls back to setTimeout if requestIdleCallback is not available
	 */
	private scheduleUpdate(callback: () => void): void {
		// Cancel any pending update
		if (this.pendingUpdateHandle !== null) {
			if (typeof window.requestIdleCallback === "function") {
				window.cancelIdleCallback(this.pendingUpdateHandle);
			} else {
				clearTimeout(this.pendingUpdateHandle);
			}
		}

		if (typeof window.requestIdleCallback === "function") {
			// Use requestIdleCallback with a timeout to ensure it runs eventually
			// Even if browser never becomes idle, run after 2 seconds max
			this.pendingUpdateHandle = window.requestIdleCallback(callback, {
				timeout: 2000,
			});
		} else {
			// Fallback for browsers that don't support requestIdleCallback
			// Use a small delay to let other operations complete
			this.pendingUpdateHandle = setTimeout(callback, 100) as any;
		}
	}

	/**
	 * Get total accumulated word count
	 */
	private getAccumulatedWordCount(): number {
		const allText = Array.from(this.accumulatedVisibleContent).join(" ");
		return countWords(allText);
	}

	/**
	 * Get accumulated visible content
	 */
	getAccumulatedContent(): string {
		return Array.from(this.accumulatedVisibleContent).join(" ");
	}

	/**
	 * Get view duration in milliseconds
	 */
	getViewDuration(): number {
		return Date.now() - this.startTime;
	}

	/**
	 * Get reading metrics
	 */
	getMetrics(): ReadingMetrics {
		const wordCount = this.getAccumulatedWordCount();

		return {
			viewDuration: this.getViewDuration(),
			estimatedWordsRead: wordCount,
		};
	}

	/**
	 * Check if user has read the visible content
	 * SMART: Captures new content OR reading progress
	 */
	meetsThreshold(minWords: number = 50): boolean {
		const wordCount = this.getAccumulatedWordCount();
		const viewDurationSeconds = this.getViewDuration() / 1000;

		// Must have some visible content
		if (wordCount < minWords * 0.5) {
			return false;
		}

		// Check if content is new OR user made reading progress
		if (!this.hasNewContentOrProgress()) {
			return false;
		}

		// SMART: Since we're capturing on scroll-stop, be less strict
		// Calculate expected reading time
		const timeNeededToRead = wordCount / this.WORDS_PER_SECOND;
		const percentageRead = (viewDurationSeconds / timeNeededToRead) * 100;

		// Lenient thresholds for scroll-stop based capture
		let minPercentage = 10;
		let minTimeThreshold = 3;

		if (wordCount > 500) {
			minPercentage = 15;
			minTimeThreshold = 7;
		} else if (wordCount > 200) {
			minPercentage = 12;
			minTimeThreshold = 5;
		}

		const meetsTime = viewDurationSeconds >= minTimeThreshold;
		const meetsPercentage = percentageRead >= minPercentage;

		// Capture if EITHER condition is met
		return meetsTime || meetsPercentage;
	}

	/**
	 * Cleanup timers
	 */
	destroy(): void {
		if (this.scrollStopTimer) {
			clearTimeout(this.scrollStopTimer);
			this.scrollStopTimer = null;
		}
		if (this.idleCaptureTimer) {
			clearTimeout(this.idleCaptureTimer);
			this.idleCaptureTimer = null;
		}
		if (this.pendingUpdateHandle !== null) {
			if (typeof window.requestIdleCallback === "function") {
				window.cancelIdleCallback(this.pendingUpdateHandle);
			} else {
				clearTimeout(this.pendingUpdateHandle);
			}
			this.pendingUpdateHandle = null;
		}
	}
}
