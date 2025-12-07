/**
 * Visible Content Extractor
 * Extracts ONLY content that is actually visible in the viewport
 * Optimized for performance using IntersectionObserver and caching
 */

// Cache for visible elements
let visibleElementsCache = new Map<Element, boolean>();

/**
 * Manually invalidate cache (called by reading-analyzer when needed)
 * PERFORMANCE: No automatic scroll listener to avoid cache churn
 */
export function invalidateVisibilityCache(): void {
	visibleElementsCache.clear();
}

// IntersectionObserver for efficient visibility tracking
let intersectionObserver: IntersectionObserver | null = null;
let visibleElements = new WeakSet<Element>();

/**
 * Initialize IntersectionObserver for efficient visibility tracking
 * PERFORMANCE: Much faster than getBoundingClientRect()
 */
function initIntersectionObserver(): void {
	if (intersectionObserver) return;

	intersectionObserver = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					visibleElements.add(entry.target);
				} else {
					// Note: WeakSet doesn't have delete, so we just won't add it
				}
			}
		},
		{
			// Consider element visible if at least 10% is in viewport
			threshold: 0.1,
			// Add some margin for better detection
			rootMargin: "50px",
		},
	);
}

/**
 * Check if element is visible in viewport
 * PERFORMANCE: Uses IntersectionObserver (no layout recalc)
 */
function isElementInViewport(element: Element): boolean {
	// Check cache first
	if (visibleElementsCache.has(element)) {
		return visibleElementsCache.get(element)!;
	}

	// Simple visibility check without forcing layout
	if (!(element instanceof HTMLElement)) {
		visibleElementsCache.set(element, false);
		return false;
	}

	// Quick check: element must have dimensions
	if (element.offsetWidth === 0 || element.offsetHeight === 0) {
		visibleElementsCache.set(element, false);
		return false;
	}

	// Use IntersectionObserver data if available
	if (visibleElements.has(element)) {
		visibleElementsCache.set(element, true);
		return true;
	}

	// Fallback: simple viewport check (only if needed)
	const rect = element.getBoundingClientRect();
	const windowHeight =
		window.innerHeight || document.documentElement.clientHeight;
	const windowWidth = window.innerWidth || document.documentElement.clientWidth;

	const isVisible =
		rect.top < windowHeight &&
		rect.bottom > 0 &&
		rect.left < windowWidth &&
		rect.right > 0;

	visibleElementsCache.set(element, isVisible);
	return isVisible;
}

/**
 * Fast visibility check without layout calculation
 * PERFORMANCE: Avoids getComputedStyle() - uses element properties only
 */
function isElementVisuallyHidden(element: Element): boolean {
	if (!(element instanceof HTMLElement)) return false;

	// PERFORMANCE: Use offsetParent trick (no style calculation needed)
	// offsetParent is null if element or ancestor has display: none
	if (element.offsetParent === null && element.tagName !== "BODY") {
		return true;
	}

	// Quick checks using element properties (no getComputedStyle)
	if (element.hidden) return true;
	if (element.offsetWidth === 0 && element.offsetHeight === 0) return true;

	// Check aria-hidden
	if (element.getAttribute("aria-hidden") === "true") return true;

	return false;
}

/**
 * Get visible text from element (only the part in viewport)
 * OPTIMIZED: Early exits and reduced DOM traversal
 */
function getVisibleTextFromElement(
	element: Element,
	maxDepth: number = 10,
	currentDepth: number = 0,
): string {
	// Depth limit to prevent deep recursion
	if (currentDepth > maxDepth) return "";

	// Skip non-content elements
	const tagName = element.tagName.toLowerCase();
	if (
		[
			"script",
			"style",
			"nav",
			"header",
			"footer",
			"aside",
			"button",
			"input",
		].includes(tagName)
	) {
		return "";
	}

	// Fast visibility check (no reflow)
	if (isElementVisuallyHidden(element)) {
		return "";
	}

	// Check if element is in viewport
	if (!isElementInViewport(element)) {
		return "";
	}

	// Get text content
	let text = "";

	// For leaf nodes, get the text directly
	if (element.childNodes.length === 0) {
		return element.textContent?.trim() || "";
	}

	// For elements with children, recursively get visible text
	for (const child of Array.from(element.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			const textContent = child.textContent?.trim() || "";
			if (textContent) {
				text += textContent + " ";
			}
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			text +=
				getVisibleTextFromElement(
					child as Element,
					maxDepth,
					currentDepth + 1,
				) + " ";
		}
	}

	return text.trim();
}

/**
 * Extract all visible content from viewport
 * PERFORMANCE: Uses IntersectionObserver and limits element processing
 */
export function extractVisibleContent(): string {
	// Initialize IntersectionObserver if needed
	initIntersectionObserver();

	// Start with main content areas (most specific selectors first)
	const contentSelectors = [
		"article",
		"main",
		"[role='main']",
		".post-content",
		".article-content",
		".entry-content",
		".content",
		"#content",
	];

	let visibleText = "";

	// Try content-specific selectors first (most pages have these)
	for (const selector of contentSelectors) {
		const element = document.querySelector(selector);
		if (element) {
			// Start observing this element
			if (intersectionObserver) {
				intersectionObserver.observe(element);
			}

			const text = getVisibleTextFromElement(element);
			if (text && text.length > 50) {
				visibleText = text;
				break;
			}
		}
	}

	// Fallback: get visible text from body (optimized approach)
	if (!visibleText) {
		// PERFORMANCE: Limit to first 150 elements to avoid processing thousands
		const textElements = document.querySelectorAll(
			"p, h1, h2, h3, h4, h5, h6, li, blockquote, article",
		);

		const visibleTexts: string[] = [];
		const seenTexts = new Set<string>(); // Avoid duplicates

		// PERFORMANCE: Limit to first 150 elements
		const maxElements = Math.min(textElements.length, 150);

		// Start observing elements for future checks
		if (intersectionObserver) {
			for (let i = 0; i < maxElements; i++) {
				intersectionObserver.observe(textElements[i]);
			}
		}

		// Process elements
		for (let i = 0; i < maxElements; i++) {
			const element = textElements[i];

			// Quick check: skip if visually hidden (no getComputedStyle)
			if (isElementVisuallyHidden(element)) continue;

			if (isElementInViewport(element)) {
				const text = element.textContent?.trim() || "";
				// Only include if it has substantial text (not just a word or two)
				if (text.length > 20 && !seenTexts.has(text)) {
					visibleTexts.push(text);
					seenTexts.add(text);
				}
			}
		}

		visibleText = visibleTexts.join(" ");
	}

	// Clean up whitespace
	visibleText = visibleText.replace(/\s+/g, " ").trim();

	return visibleText;
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
	if (!text) return 0;
	return text.split(/\s+/).filter((word) => word.length > 0).length;
}
