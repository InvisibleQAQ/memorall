/**
 * Content Reading Tracker
 * Tracks visible content user has actually seen and read
 */

import type { ContentReadingData } from "@/types/activity-tracking";
import { ReadingAnalyzer } from "../utils/reading-analyzer";
import { countWords } from "../utils/visible-content-extractor";

/**
 * Content Reading Tracker Class
 */
export class ContentReadingTracker {
	private analyzer: ReadingAnalyzer;
	private maxTextLength: number;

	constructor(maxTextLength: number = 10000) {
		this.analyzer = new ReadingAnalyzer();
		this.maxTextLength = maxTextLength;
	}

	/**
	 * Record scroll event
	 */
	recordScroll(scrollY: number): void {
		this.analyzer.recordScroll(scrollY);
	}

	/**
	 * Update visible content (call periodically)
	 */
	updateVisibleContent(): void {
		this.analyzer.updateVisibleContent();
	}

	/**
	 * Check if should capture
	 * Simple: Has user spent enough time to read visible content?
	 */
	shouldCapture(minWords: number = 50): boolean {
		return this.analyzer.meetsThreshold(minWords);
	}

	/**
	 * Capture content reading data (ONLY visible content user saw)
	 */
	capture(): ContentReadingData | null {
		// Get accumulated visible content (what user actually saw)
		let visibleContent = this.analyzer.getAccumulatedContent();

		if (!visibleContent || visibleContent.trim().length === 0) {
			return null;
		}

		// Get reading metrics
		const metrics = this.analyzer.getMetrics();

		// Prepare visible content (truncate if needed)
		let truncated = false;

		if (visibleContent.length > this.maxTextLength) {
			visibleContent = visibleContent.substring(0, this.maxTextLength);
			truncated = true;
		}

		const wordCount = countWords(visibleContent);

		// Extract basic metadata from page
		const metadata = {
			wordCount,
			excerpt:
				visibleContent.length > 200
					? visibleContent.substring(0, 200) + "..."
					: visibleContent,
			// Try to get author/date from meta tags
			author:
				document
					.querySelector('meta[name="author"]')
					?.getAttribute("content") || undefined,
			publishDate:
				document
					.querySelector('meta[property="article:published_time"]')
					?.getAttribute("content") || undefined,
			description:
				document
					.querySelector('meta[name="description"]')
					?.getAttribute("content") || undefined,
		};

		const data: ContentReadingData = {
			type: "content_reading",
			pageUrl: window.location.href,
			pageTitle: document.title,
			tabId: -1, // Will be set by background

			mainContent: visibleContent, // ONLY what user saw!
			contentMetadata: metadata,

			readingMetrics: metrics,

			scrollDepth: 0, // Not used
			captureTime: Date.now(),
			truncated,
		};

		return data;
	}

	/**
	 * Get view duration in milliseconds
	 */
	getViewDuration(): number {
		return this.analyzer.getViewDuration();
	}

	/**
	 * Get all reading metrics
	 */
	getMetrics() {
		return this.analyzer.getMetrics();
	}

	/**
	 * Register callback for when user stops scrolling
	 */
	setScrollStopCallback(callback: () => void): void {
		this.analyzer.setScrollStopCallback(callback);
	}

	/**
	 * Mark current content as captured (for deduplication)
	 */
	markContentAsCaptured(): void {
		this.analyzer.markContentAsCaptured();
	}

	/**
	 * Check if user is currently scrolling
	 */
	isUserScrolling(): boolean {
		return this.analyzer.isUserScrolling();
	}

	/**
	 * Cleanup timers and resources
	 */
	destroy(): void {
		this.analyzer.destroy();
	}
}
