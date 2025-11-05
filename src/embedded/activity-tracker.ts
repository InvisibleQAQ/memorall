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
} from "@/types/activity-tracking";

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
 * Extract element information
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
		if ((element as any).name) info.name = (element as any).name;
		if ((element as any).type) info.type = (element as any).type;
		if ((element as any).placeholder) {
			info.placeholder = (element as any).placeholder;
		}
		if (element.getAttribute("aria-label")) {
			info.ariaLabel = element.getAttribute("aria-label") || undefined;
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

	const sensitiveTypes = ["password", "credit", "card", "cvv", "ssn"];
	const sensitivePatterns = [
		"password",
		"passwd",
		"pwd",
		"secret",
		"token",
		"key",
		"credit",
		"card",
		"cvv",
		"cvc",
		"ssn",
		"pin",
	];

	if (type === "password") return true;

	for (const pattern of sensitivePatterns) {
		if (name.includes(pattern) || id.includes(pattern)) {
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

class ActivityTracker {
	private isActive: boolean = false;
	private listeners: Map<string, EventListener> = new Map();
	private lastScrollTime: number = 0;
	private readonly SCROLL_THROTTLE_MS = 1000;
	private readonly DEBOUNCE_INPUT_MS = 500;
	private inputDebounceTimers: Map<Element, NodeJS.Timeout> = new Map();
	private textCaptureTimer: NodeJS.Timeout | null = null;
	private readonly TEXT_CAPTURE_DELAY_MS = 10000; // 10 seconds
	private readonly MAX_TEXT_LENGTH = 10000; // 10,000 characters
	private pageStartTime: number = 0;

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
		this.startTextCaptureTimer();
		console.log("🎯 Activity tracker started on:", window.location.href);
	}

	/**
	 * Stop tracking
	 */
	stop(): void {
		if (!this.isActive) return;

		this.isActive = false;
		this.removeListeners();
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

		// Scroll tracking
		const scrollListener = this.handleScroll.bind(this);
		window.addEventListener("scroll", scrollListener, { passive: true });
		this.listeners.set("scroll", scrollListener);

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
			inputType:
				element instanceof HTMLInputElement
					? (element.type as any) || "text"
					: "text",
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
	private sendToBackground(type: string, data: any): void {
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
	 * Start text capture timer
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
