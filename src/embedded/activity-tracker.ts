/**
 * Content Script Activity Tracker
 * Captures user interactions on web pages
 */

import type {
	UserInputData,
	ClickData,
	ScrollData,
	FormSubmitData,
	TextReadingData,
	ElementInfo,
	ContentReadingData,
	YouTubeVideoData,
	VideoWatchingData,
	VideoCallData,
} from "@/types/activity-tracking";
import { ContentReadingTracker } from "./trackers/content-reading-tracker";
import { YouTubeTracker } from "./trackers/youtube-tracker";
import { VideoTracker } from "./trackers/video-tracker";
import { VideoCallTracker } from "./trackers/video-call-tracker";
import { DEFAULT_CAPTURE_CONFIG } from "@/types/activity-tracking";
import type { ActivityCaptureConfig } from "@/types/activity-tracking";

/**
 * Get XPath for an element
 */
function getElementXPath(element: Element): string {
	if (element.id) {
		return `//*[@id="${element.id}"]`;
	}

	const parts: string[] = [];
	let current: Element | null = element;

	while (current && current.nodeType === Node.ELEMENT_NODE) {
		let index = 0;
		let sibling: Element | null = current;

		while (sibling) {
			if (
				sibling.nodeType === Node.ELEMENT_NODE &&
				sibling.tagName === current.tagName
			) {
				index++;
			}
			sibling = sibling.previousElementSibling;
		}

		const tagName = current.tagName.toLowerCase();
		const part = index > 1 ? `${tagName}[${index}]` : tagName;
		parts.unshift(part);

		current = current.parentElement;
	}

	return parts.length ? `/${parts.join("/")}` : "";
}

/**
 * Get CSS selector for an element
 */
function getElementSelector(element: Element): string {
	if (element.id) {
		return `#${element.id}`;
	}

	const path: string[] = [];
	let current: Element | null = element;

	while (current && current.nodeType === Node.ELEMENT_NODE) {
		let selector = current.tagName.toLowerCase();

		if (current.id) {
			selector += `#${current.id}`;
			path.unshift(selector);
			break;
		} else if (current.className && typeof current.className === "string") {
			const classes = current.className.trim().split(/\s+/).filter(Boolean);
			if (classes.length > 0) {
				selector += `.${classes.join(".")}`;
			}
		}

		path.unshift(selector);
		current = current.parentElement;

		// Limit depth
		if (path.length >= 5) break;
	}

	return path.join(" > ");
}

/**
 * Find associated label for an input element
 */
function findLabelForElement(element: Element): string | undefined {
	if (!(element instanceof HTMLElement)) return undefined;

	// Method 1: Check for wrapping label
	let parent = element.parentElement;
	while (parent) {
		if (parent.tagName === "LABEL") {
			return parent.textContent?.trim();
		}
		parent = parent.parentElement;
		// Limit depth to avoid going too far up
		if (parent && parent.tagName === "FORM") break;
	}

	// Method 2: Check for label with 'for' attribute
	if (element.id) {
		const label = document.querySelector(`label[for="${element.id}"]`);
		if (label) {
			return label.textContent?.trim();
		}
	}

	// Method 3: Check aria-labelledby
	const labelledBy = element.getAttribute("aria-labelledby");
	if (labelledBy) {
		const labelElement = document.getElementById(labelledBy);
		if (labelElement) {
			return labelElement.textContent?.trim();
		}
	}

	// Method 4: Check nearby text (common pattern)
	const prevSibling = element.previousElementSibling;
	if (
		prevSibling &&
		prevSibling.tagName !== "INPUT" &&
		prevSibling.tagName !== "BUTTON"
	) {
		const text = prevSibling.textContent?.trim();
		if (text && text.length < 100) {
			return text;
		}
	}

	return undefined;
}

/**
 * Extract element information with enhanced context
 */
function getElementInfo(element: Element): ElementInfo {
	const info: ElementInfo = {
		tagName: element.tagName.toLowerCase(),
	};

	if (element.id) info.id = element.id;
	if (element.className && typeof element.className === "string") {
		info.className = element.className;
	}

	if (element instanceof HTMLElement) {
		// Type-safe property access for form elements
		if (
			element instanceof HTMLInputElement ||
			element instanceof HTMLButtonElement ||
			element instanceof HTMLSelectElement ||
			element instanceof HTMLTextAreaElement
		) {
			if (element.name) info.name = element.name;
		}

		if (
			element instanceof HTMLInputElement ||
			element instanceof HTMLButtonElement
		) {
			if (element.type) info.type = element.type;
		}

		if (
			element instanceof HTMLInputElement ||
			element instanceof HTMLTextAreaElement
		) {
			if (element.placeholder) {
				info.placeholder = element.placeholder;
			}
			if (element.autocomplete) {
				info.autocomplete = element.autocomplete;
			}
		}

		if (element.getAttribute("aria-label")) {
			info.ariaLabel = element.getAttribute("aria-label") || undefined;
		}

		// Enhanced context
		const label = findLabelForElement(element);
		if (label) info.label = label;

		const textContent = element.textContent?.trim();
		if (textContent && textContent.length < 200) {
			info.textContent = textContent;
		}

		if (element.title) info.title = element.title;
		if (element.getAttribute("role")) {
			info.role = element.getAttribute("role") || undefined;
		}
	}

	info.xpath = getElementXPath(element);
	info.selector = getElementSelector(element);

	return info;
}

/**
 * Check if content is sensitive
 */
function isSensitiveInput(element: Element): boolean {
	if (!(element instanceof HTMLInputElement)) return false;

	const type = element.type.toLowerCase();
	const name = (element.name || "").toLowerCase();
	const id = (element.id || "").toLowerCase();
	const placeholder = (element.placeholder || "").toLowerCase();
	const autocomplete = (element.autocomplete || "").toLowerCase();

	// Sensitive input patterns
	const sensitivePatterns = [
		"password",
		"passwd",
		"pwd",
		"secret",
		"token",
		"api",
		"apikey",
		"api_key",
		"auth",
		"authorization",
		"bearer",
		"credit",
		"card",
		"cardnumber",
		"card-number",
		"cvv",
		"cvc",
		"csc",
		"ssn",
		"social",
		"pin",
		"otp",
		"verification",
		"2fa",
		"mfa",
		"private",
		"privatekey",
		"private_key",
	];

	// Check type
	if (type === "password") return true;

	// Check autocomplete attribute (most reliable)
	if (
		autocomplete.includes("password") ||
		autocomplete.includes("credit-card") ||
		autocomplete.includes("cc-")
	) {
		return true;
	}

	// Check against all fields
	const fieldsToCheck = [name, id, placeholder];
	for (const field of fieldsToCheck) {
		for (const pattern of sensitivePatterns) {
			if (field.includes(pattern)) {
				return true;
			}
		}
	}

	// Check for credit card number pattern in value (basic check)
	if (element.value) {
		const digitsOnly = element.value.replace(/\D/g, "");
		// Check if it looks like a credit card (13-19 digits)
		if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
			return true;
		}
	}

	return false;
}

/**
 * Redact sensitive content
 */
function redactContent(content: string): string {
	return `[REDACTED: ${content.length} characters]`;
}

/**
 * Map HTML input type to our tracked input types
 */
function mapInputType(
	element: HTMLInputElement | HTMLTextAreaElement,
): "text" | "password" | "email" | "search" | "number" | "other" {
	if (element instanceof HTMLTextAreaElement) {
		return "text";
	}

	const type = element.type.toLowerCase();
	switch (type) {
		case "text":
		case "password":
		case "email":
		case "search":
		case "number":
			return type;
		default:
			return "other";
	}
}

class ActivityTracker {
	private isActive: boolean = false;
	private listeners: Map<string, EventListener> = new Map();
	private lastScrollTime: number = 0;
	private readonly SCROLL_THROTTLE_MS = 2000; // OPTIMIZED: 2s for quick reading detection
	private readonly DEBOUNCE_INPUT_MS = 500;
	private inputDebounceTimers: Map<Element, NodeJS.Timeout> = new Map();
	private pageStartTime: number = 0;
	private config: ActivityCaptureConfig = DEFAULT_CAPTURE_CONFIG;

	// New intelligent trackers
	private contentReadingTracker: ContentReadingTracker | null = null;
	private youtubeTracker: YouTubeTracker | null = null;
	private videoTrackers: Map<HTMLVideoElement, VideoTracker> = new Map();
	private videoCallTracker: VideoCallTracker | null = null;

	// Periodic capture timers
	private captureCheckInterval: NodeJS.Timeout | null = null;
	private videoCheckInterval: NodeJS.Timeout | null = null;
	private readonly CAPTURE_CHECK_INTERVAL_MS = 60000; // OPTIMIZED: 60s as backup only (primary is scroll-stop)

	// Deprecated (keeping for backward compatibility)
	private textCaptureTimer: NodeJS.Timeout | null = null;
	private readonly TEXT_CAPTURE_DELAY_MS = 10000;
	private readonly MAX_TEXT_LENGTH = 10000;

	/**
	 * Start tracking
	 */
	start(): void {
		if (this.isActive) {
			console.log("Activity tracker already active");
			return;
		}

		this.isActive = true;
		this.pageStartTime = Date.now();
		this.setupListeners();
		this.initializeSpecializedTrackers();
		this.startPeriodicCapture();

		// Deprecated: old text capture (for backward compatibility)
		if (this.config.trackTextReading) {
			this.startTextCaptureTimer();
		}

		console.log("🎯 Activity tracker started on:", window.location.href);
	}

	/**
	 * Stop tracking
	 */
	stop(): void {
		if (!this.isActive) return;

		// Capture final data before stopping
		this.captureFinalData();

		this.isActive = false;
		this.removeListeners();
		this.cleanupSpecializedTrackers();
		this.stopPeriodicCapture();
		this.stopTextCaptureTimer();
		console.log("⏹️ Activity tracker stopped");
	}

	/**
	 * Setup event listeners
	 */
	private setupListeners(): void {
		// Input tracking
		const inputListener = this.handleInput.bind(this);
		document.addEventListener("input", inputListener, true);
		this.listeners.set("input", inputListener);

		// Click tracking
		const clickListener = this.handleClick.bind(this);
		document.addEventListener("click", clickListener, true);
		this.listeners.set("click", clickListener);

		// Scroll tracking - only if content reading or scroll tracking is enabled
		if (this.config.trackScrolls || this.config.trackContentReading) {
			const scrollListener = this.handleScroll.bind(this);
			window.addEventListener("scroll", scrollListener, { passive: true });
			this.listeners.set("scroll", scrollListener);
		}

		// Form submit tracking
		const submitListener = this.handleFormSubmit.bind(this);
		document.addEventListener("submit", submitListener, true);
		this.listeners.set("submit", submitListener);
	}

	/**
	 * Remove event listeners
	 */
	private removeListeners(): void {
		const inputListener = this.listeners.get("input");
		if (inputListener) {
			document.removeEventListener("input", inputListener, true);
		}

		const clickListener = this.listeners.get("click");
		if (clickListener) {
			document.removeEventListener("click", clickListener, true);
		}

		const scrollListener = this.listeners.get("scroll");
		if (scrollListener) {
			window.removeEventListener("scroll", scrollListener);
		}

		const submitListener = this.listeners.get("submit");
		if (submitListener) {
			document.removeEventListener("submit", submitListener, true);
		}

		this.listeners.clear();
		this.inputDebounceTimers.clear();
	}

	/**
	 * Handle input events
	 */
	private handleInput(event: Event): void {
		const target = event.target;
		if (
			!(target instanceof HTMLInputElement) &&
			!(target instanceof HTMLTextAreaElement)
		) {
			return;
		}

		// Clear existing debounce timer
		const existingTimer = this.inputDebounceTimers.get(target);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Set new debounce timer
		const timer = setTimeout(() => {
			this.captureInput(target);
			this.inputDebounceTimers.delete(target);
		}, this.DEBOUNCE_INPUT_MS);

		this.inputDebounceTimers.set(target, timer);
	}

	/**
	 * Capture input data
	 */
	private captureInput(element: HTMLInputElement | HTMLTextAreaElement): void {
		const isSensitive = isSensitiveInput(element);
		const content = isSensitive ? redactContent(element.value) : element.value;

		const data: UserInputData = {
			type: "user_input",
			content,
			inputType: mapInputType(element),
			elementInfo: getElementInfo(element),
			pageUrl: window.location.href,
			pageTitle: document.title,
			tabId: -1, // Will be set by background script
			isRedacted: isSensitive,
		};

		this.sendToBackground("user_input", data);
	}

	/**
	 * Handle click events
	 */
	private handleClick(event: Event): void {
		if (!(event instanceof MouseEvent)) return;
		const target = event.target;
		if (!(target instanceof Element)) return;

		const data: ClickData = {
			type: "click",
			elementInfo: getElementInfo(target),
			pageUrl: window.location.href,
			pageTitle: document.title,
			tabId: -1, // Will be set by background script
			position: {
				x: event.clientX,
				y: event.clientY,
			},
			viewport: {
				width: window.innerWidth,
				height: window.innerHeight,
			},
			isRightClick: event.button === 2,
		};

		this.sendToBackground("click", data);
	}

	/**
	 * Handle scroll events (throttled)
	 */
	private handleScroll(): void {
		const now = Date.now();
		if (now - this.lastScrollTime < this.SCROLL_THROTTLE_MS) {
			return;
		}

		this.lastScrollTime = now;

		const scrollY = window.scrollY;

		// Update content reading tracker with scroll (lightweight operation)
		if (this.contentReadingTracker) {
			this.contentReadingTracker.recordScroll(scrollY);
		}

		// Send scroll event (if explicitly enabled - disabled by default for performance)
		if (this.config.trackScrolls) {
			const scrollX = window.scrollX;
			const pageHeight = document.documentElement.scrollHeight;
			const viewportHeight = window.innerHeight;
			const scrollDepth = ((scrollY + viewportHeight) / pageHeight) * 100;

			const data: ScrollData = {
				type: "scroll",
				pageUrl: window.location.href,
				pageTitle: document.title,
				tabId: -1, // Will be set by background script
				scrollPosition: {
					x: scrollX,
					y: scrollY,
				},
				scrollDepth: Math.min(scrollDepth, 100),
				pageHeight,
			};

			this.sendToBackground("scroll", data);
		}
	}

	/**
	 * Handle form submit events
	 */
	private handleFormSubmit(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLFormElement)) return;

		const formElements = target.elements;
		const fieldCount = formElements.length;

		const data: FormSubmitData = {
			type: "form_submit",
			formInfo: getElementInfo(target),
			pageUrl: window.location.href,
			pageTitle: document.title,
			tabId: -1, // Will be set by background script
			fieldCount,
			method: target.method,
			action: target.action,
		};

		this.sendToBackground("form_submit", data);
	}

	/**
	 * Send activity data to background script
	 */
	private sendToBackground(
		type: string,
		data:
			| UserInputData
			| ClickData
			| ScrollData
			| FormSubmitData
			| TextReadingData
			| ContentReadingData
			| YouTubeVideoData
			| VideoWatchingData
			| VideoCallData,
	): void {
		try {
			chrome.runtime.sendMessage({
				type: "ACTIVITY_CAPTURED",
				activityType: type,
				data,
				pageUrl: window.location.href,
				pageTitle: document.title,
				timestamp: Date.now(),
			});
		} catch (error) {
			console.error("Failed to send activity to background:", error);
		}
	}

	/**
	 * Initialize specialized trackers based on page type
	 */
	private initializeSpecializedTrackers(): void {
		console.log(
			"[ActivityTracker] Initializing specialized trackers on:",
			window.location.href,
		);

		// Initialize content reading tracker (for most pages)
		if (this.config.trackContentReading) {
			try {
				this.contentReadingTracker = new ContentReadingTracker(
					this.config.maxTextLength,
				);

				// SMART: Register scroll-stop callback for intelligent capture
				this.contentReadingTracker.setScrollStopCallback(() => {
					console.log("[ActivityTracker] User stopped scrolling");
					this.onUserStoppedScrolling();
				});

				console.log(
					"✅ [ActivityTracker] Content reading tracker initialized with scroll-stop detection",
				);
			} catch (error) {
				console.error(
					"❌ [ActivityTracker] Failed to init content reading tracker:",
					error,
				);
			}
		}

		// Initialize YouTube tracker
		if (this.config.trackYouTubeVideos && YouTubeTracker.isYouTubePage()) {
			try {
				this.youtubeTracker = new YouTubeTracker();
				this.youtubeTracker.start();
				console.log("✅ [ActivityTracker] YouTube tracker initialized");
			} catch (error) {
				console.error(
					"❌ [ActivityTracker] Failed to init YouTube tracker:",
					error,
				);
			}
		}

		// Initialize video call tracker
		if (this.config.trackVideoCalls) {
			try {
				const platform = VideoCallTracker.detectPlatform();
				if (platform) {
					this.videoCallTracker = new VideoCallTracker(
						platform,
						window.location.href,
					);
					this.videoCallTracker.start(this.config.videoCalls.captureCaptions);
					console.log(
						`✅ [ActivityTracker] Video call tracker initialized (${platform})`,
					);
				}
			} catch (error) {
				console.error(
					"❌ [ActivityTracker] Failed to init video call tracker:",
					error,
				);
			}
		}

		// Initialize video trackers
		if (this.config.trackVideoWatching) {
			try {
				this.initializeVideoTrackers();
			} catch (error) {
				console.error(
					"❌ [ActivityTracker] Failed to init video trackers:",
					error,
				);
			}
		}
	}

	/**
	 * Initialize trackers for HTML5 videos
	 */
	private initializeVideoTrackers(): void {
		const videos = VideoTracker.findVideoElements();

		videos.forEach((video) => {
			if (!this.videoTrackers.has(video)) {
				const tracker = new VideoTracker(video);
				tracker.start();
				this.videoTrackers.set(video, tracker);
				console.log("✅ [ActivityTracker] Video tracker initialized");
			}
		});

		// Only set interval once (prevent memory leak)
		if (!this.videoCheckInterval && this.isActive) {
			this.videoCheckInterval = setInterval(() => {
				if (this.isActive && this.config.trackVideoWatching) {
					const newVideos = VideoTracker.findVideoElements();
					newVideos.forEach((video) => {
						if (!this.videoTrackers.has(video)) {
							const tracker = new VideoTracker(video);
							tracker.start();
							this.videoTrackers.set(video, tracker);
							console.log("✅ [ActivityTracker] New video tracker initialized");
						}
					});
				}
			}, 5000);
		}
	}

	/**
	 * Cleanup specialized trackers
	 */
	private cleanupSpecializedTrackers(): void {
		if (this.contentReadingTracker) {
			this.contentReadingTracker.destroy();
			this.contentReadingTracker = null;
		}

		if (this.youtubeTracker) {
			this.youtubeTracker.destroy();
			this.youtubeTracker = null;
		}

		if (this.videoCallTracker) {
			this.videoCallTracker.stop();
			this.videoCallTracker = null;
		}

		this.videoTrackers.forEach((tracker) => tracker.stop());
		this.videoTrackers.clear();

		// Fix: Clear video check interval
		if (this.videoCheckInterval) {
			clearInterval(this.videoCheckInterval);
			this.videoCheckInterval = null;
		}
	}

	/**
	 * Start periodic capture check
	 * OPTIMIZED: Use requestIdleCallback to avoid blocking main thread
	 */
	private startPeriodicCapture(): void {
		const scheduleNextCheck = () => {
			this.captureCheckInterval = setTimeout(() => {
				// Run capture check when browser is idle
				if (typeof window.requestIdleCallback === "function") {
					window.requestIdleCallback(
						() => {
							this.checkAndCapture();
							scheduleNextCheck(); // Schedule next check after completion
						},
						{ timeout: 5000 }, // Run within 5 seconds even if not idle
					);
				} else {
					this.checkAndCapture();
					scheduleNextCheck();
				}
			}, this.CAPTURE_CHECK_INTERVAL_MS);
		};

		scheduleNextCheck();
	}

	/**
	 * Stop periodic capture
	 */
	private stopPeriodicCapture(): void {
		if (this.captureCheckInterval) {
			clearInterval(this.captureCheckInterval);
			this.captureCheckInterval = null;
		}
	}

	/**
	 * Check and capture data if thresholds are met
	 * OPTIMIZED: Lazy content extraction - only extract when capturing
	 */
	private async checkAndCapture(): Promise<void> {
		if (!this.isActive) return;

		// Check content reading
		if (this.contentReadingTracker && this.config.trackContentReading) {
			// OPTIMIZED: Quick pre-check before expensive operations
			const { minWordCount } = this.config.contentReading;
			const currentWordCount =
				this.contentReadingTracker.getMetrics().estimatedWordsRead;
			const viewDurationSeconds =
				this.contentReadingTracker.getViewDuration() / 1000;

			// Quick threshold check - skip if definitely not ready
			if (currentWordCount < minWordCount * 0.5 || viewDurationSeconds < 3) {
				return;
			}

			// OPTIMIZED: Update visible content (fast with caching)
			this.contentReadingTracker.updateVisibleContent();

			// Simple check: has user read the visible content?
			const shouldCapture =
				this.contentReadingTracker.shouldCapture(minWordCount);

			if (shouldCapture) {
				const data = this.contentReadingTracker.capture();
				if (data) {
					this.sendToBackground("content_reading", data);
					console.log(
						"✅ Content captured (backup):",
						`${data.contentMetadata.wordCount} words,`,
						`${(data.readingMetrics.viewDuration / 1000).toFixed(1)}s`,
					);

					// DEDUPLICATION: Mark this content as captured
					this.contentReadingTracker.markContentAsCaptured();

					// Don't reset tracker - keep accumulating content
				}
			}
		}

		// Check YouTube
		if (this.youtubeTracker && this.config.trackYouTubeVideos) {
			const data = await this.youtubeTracker.capture(
				this.config.youTube.captureTranscripts,
			);
			if (data && data.watchDuration >= this.config.youTube.minWatchDuration) {
				this.sendToBackground("youtube_video", data);
				console.log(
					"▶️ YouTube video captured:",
					data.title,
					`(${data.watchDuration}s watched)`,
				);
			}
		}

		// Check videos
		if (this.config.trackVideoWatching) {
			this.videoTrackers.forEach((tracker, video) => {
				if (tracker.meetsThreshold(10)) {
					// 10 seconds minimum
					const data = tracker.capture();
					if (data) {
						this.sendToBackground("video_watching", data);
						console.log("🎬 Video watching captured");
					}
				}
			});
		}
	}

	/**
	 * Called when user stops scrolling (SMART detection)
	 * This is the PRIMARY capture mechanism - scroll-stop based
	 */
	private async onUserStoppedScrolling(): Promise<void> {
		if (!this.isActive || !this.contentReadingTracker) return;

		const { minWordCount } = this.config.contentReading;

		// Check if should capture
		const shouldCapture =
			this.contentReadingTracker.shouldCapture(minWordCount);

		if (shouldCapture) {
			const data = this.contentReadingTracker.capture();
			if (data) {
				this.sendToBackground("content_reading", data);
				console.log(
					"✅ Content captured:",
					`${data.contentMetadata.wordCount} words,`,
					`${(data.readingMetrics.viewDuration / 1000).toFixed(1)}s`,
				);

				// DEDUPLICATION: Mark this content as captured
				this.contentReadingTracker.markContentAsCaptured();

				// Don't reset tracker - keep accumulating content
				// This allows continuous tracking on the same page
			}
		}
	}

	/**
	 * Capture final data before stopping
	 */
	private async captureFinalData(): Promise<void> {
		// Capture content reading
		if (this.contentReadingTracker) {
			const data = this.contentReadingTracker.capture();
			if (data) {
				this.sendToBackground("content_reading", data);
			}
		}

		// Capture YouTube
		if (this.youtubeTracker) {
			const data = await this.youtubeTracker.capture(
				this.config.youTube.captureTranscripts,
			);
			if (data) {
				this.sendToBackground("youtube_video", data);
			}
		}

		// Capture video call
		if (this.videoCallTracker) {
			const data = this.videoCallTracker.capture();
			if (data) {
				this.sendToBackground("video_call", data);
				console.log("📹 Video call captured:", data.platform);
			}
		}

		// Capture videos
		this.videoTrackers.forEach((tracker) => {
			const data = tracker.capture();
			if (data) {
				this.sendToBackground("video_watching", data);
			}
		});
	}

	/**
	 * Start text capture timer (deprecated)
	 */
	private startTextCaptureTimer(): void {
		// Clear any existing timer
		this.stopTextCaptureTimer();

		// Set timer to capture text after delay
		this.textCaptureTimer = setTimeout(() => {
			this.captureVisibleText();
		}, this.TEXT_CAPTURE_DELAY_MS);
	}

	/**
	 * Stop text capture timer
	 */
	private stopTextCaptureTimer(): void {
		if (this.textCaptureTimer) {
			clearTimeout(this.textCaptureTimer);
			this.textCaptureTimer = null;
		}
	}

	/**
	 * Extract visible text from the viewport
	 */
	private getVisibleText(): string {
		const viewportHeight = window.innerHeight;
		const scrollY = window.scrollY;
		const visibleTop = scrollY;
		const visibleBottom = scrollY + viewportHeight;

		// Get all text nodes in the visible area
		const textNodes: string[] = [];

		// Function to check if element is in viewport
		const isInViewport = (element: Element): boolean => {
			const rect = element.getBoundingClientRect();
			const elemTop = rect.top + scrollY;
			const elemBottom = rect.bottom + scrollY;

			return elemBottom >= visibleTop && elemTop <= visibleBottom;
		};

		// Get main content elements (paragraphs, headings, list items, etc.)
		const contentSelectors = [
			"p",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"li",
			"td",
			"th",
			"blockquote",
			"pre",
			"article",
			"section",
			"main",
			"div[role='main']",
			"div[class*='content']",
			"div[class*='article']",
			"div[class*='text']",
		];

		const elements = document.querySelectorAll(contentSelectors.join(", "));

		for (const element of elements) {
			if (isInViewport(element)) {
				const text = element.textContent?.trim();
				if (text && text.length > 20) {
					// Only include substantial text
					textNodes.push(text);
				}
			}
		}

		return textNodes.join("\n\n");
	}

	/**
	 * Capture visible text content
	 */
	private captureVisibleText(): void {
		if (!this.isActive) return;

		try {
			const visibleText = this.getVisibleText();

			if (!visibleText || visibleText.length < 50) {
				// Not enough text to capture, might be an image-heavy page
				console.log("Not enough text content to capture");
				return;
			}

			const textLength = visibleText.length;
			let capturedText = visibleText;
			let truncated = false;

			// Truncate if too long
			if (textLength > this.MAX_TEXT_LENGTH) {
				capturedText = visibleText.substring(0, this.MAX_TEXT_LENGTH);
				truncated = true;
			}

			// Calculate scroll depth
			const scrollY = window.scrollY;
			const pageHeight = document.documentElement.scrollHeight;
			const viewportHeight = window.innerHeight;
			const scrollDepth = ((scrollY + viewportHeight) / pageHeight) * 100;

			const viewDuration = Date.now() - this.pageStartTime;

			const data: TextReadingData = {
				type: "text_reading",
				pageUrl: window.location.href,
				pageTitle: document.title,
				tabId: -1, // Will be set by background script
				viewDuration,
				visibleText: capturedText,
				textLength,
				truncated,
				scrollDepth: Math.min(scrollDepth, 100),
				captureTime: Date.now(),
			};

			this.sendToBackground("text_reading", data);
			console.log(
				`📖 Captured ${textLength} characters of visible text after ${(viewDuration / 1000).toFixed(1)}s`,
			);
		} catch (error) {
			console.error("Failed to capture visible text:", error);
		}
	}

	/**
	 * Check if tracker is active
	 */
	isTracking(): boolean {
		return this.isActive;
	}
}

// Create singleton instance
export const activityTracker = new ActivityTracker();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "START_ACTIVITY_TRACKING") {
		activityTracker.start();
		sendResponse({ success: true });
		return true;
	}

	if (message.type === "STOP_ACTIVITY_TRACKING") {
		activityTracker.stop();
		sendResponse({ success: true });
		return true;
	}

	return false;
});
