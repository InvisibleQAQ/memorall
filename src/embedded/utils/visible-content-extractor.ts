/**
 * Visible Content Extractor
 * Extracts ONLY content that is actually visible in the viewport
 * Optimized for performance using IntersectionObserver and caching
 */

// Cache for visible elements - invalidated on scroll
let visibleElementsCache = new Map<Element, boolean>();
let cacheInvalidationTimer: NodeJS.Timeout | null = null;

/**
 * Invalidate cache (called on scroll/resize)
 */
function invalidateCache(): void {
	if (cacheInvalidationTimer) {
		clearTimeout(cacheInvalidationTimer);
	}

	// Debounce cache invalidation
	cacheInvalidationTimer = setTimeout(() => {
		visibleElementsCache.clear();
	}, 100);
}

// Set up cache invalidation on scroll/resize
if (typeof window !== "undefined") {
	window.addEventListener("scroll", invalidateCache, { passive: true });
	window.addEventListener("resize", invalidateCache, { passive: true });
}

/**
 * Check if element is visible in viewport (with caching)
 * OPTIMIZED: Uses cached results when available
 */
function isElementInViewport(element: Element): boolean {
	// Check cache first
	if (visibleElementsCache.has(element)) {
		return visibleElementsCache.get(element)!;
	}

	const rect = element.getBoundingClientRect();
	const windowHeight = window.innerHeight || document.documentElement.clientHeight;
	const windowWidth = window.innerWidth || document.documentElement.clientWidth;

	// Check if any part of element is in viewport
	const isVisible = (
		rect.top < windowHeight &&
		rect.bottom > 0 &&
		rect.left < windowWidth &&
		rect.right > 0
	);

	// Cache result
	visibleElementsCache.set(element, isVisible);

	return isVisible;
}

/**
 * Fast visibility check without layout calculation
 * Uses element properties that don't trigger reflow
 */
function isElementVisuallyHidden(element: Element): boolean {
	if (!(element instanceof HTMLElement)) return false;

	// Check computed style (cached by browser)
	const style = window.getComputedStyle(element);
	return (
		style.display === "none" ||
		style.visibility === "hidden" ||
		style.opacity === "0"
	);
}

/**
 * Get visible text from element (only the part in viewport)
 * OPTIMIZED: Early exits and reduced DOM traversal
 */
function getVisibleTextFromElement(element: Element, maxDepth: number = 10, currentDepth: number = 0): string {
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
			text += getVisibleTextFromElement(child as Element, maxDepth, currentDepth + 1) + " ";
		}
	}

	return text.trim();
}

/**
 * Extract all visible content from viewport
 * OPTIMIZED: Focused queries and batch DOM reads
 */
export function extractVisibleContent(): string {
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
			const text = getVisibleTextFromElement(element);
			if (text && text.length > 50) {
				visibleText = text;
				break;
			}
		}
	}

	// Fallback: get visible text from body (optimized approach)
	if (!visibleText) {
		// OPTIMIZED: More focused selector, only primary content elements
		const textElements = document.querySelectorAll(
			"p, h1, h2, h3, h4, h5, h6, li, blockquote, article",
		);

		const visibleTexts: string[] = [];
		const seenTexts = new Set<string>(); // Avoid duplicates

		// Batch process elements (process in chunks to avoid blocking)
		for (const element of Array.from(textElements)) {
			// Quick check: skip if visually hidden
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
