/**
 * Content Extractor Utility
 * Intelligently extracts main content from web pages
 */

// Cache for performance optimization
let cachedContent: ExtractedContent | null = null;
let cacheTimestamp = 0;
let cacheUrl = "";
const CACHE_DURATION_MS = 5000; // Cache for 5 seconds

export interface ExtractedContent {
	mainContent: string;
	metadata: {
		author?: string;
		publishDate?: string;
		description?: string;
		wordCount: number;
		excerpt?: string;
	};
	success: boolean;
}

/**
 * Extract main content from the page using various strategies
 */
export function extractMainContent(): ExtractedContent {
	// Return cached result if recent and same URL
	const now = Date.now();
	const currentUrl = window.location.href;

	if (
		cachedContent &&
		cacheUrl === currentUrl &&
		now - cacheTimestamp < CACHE_DURATION_MS
	) {
		return cachedContent;
	}

	const result: ExtractedContent = {
		mainContent: "",
		metadata: {
			wordCount: 0,
		},
		success: false,
	};

	// Strategy 1: Look for semantic HTML5 elements
	const article = document.querySelector("article");
	if (article) {
		result.mainContent = extractTextFromElement(article);
		result.success = true;
	}

	// Strategy 2: Look for main element
	if (!result.success) {
		const main = document.querySelector("main, [role='main']");
		if (main) {
			result.mainContent = extractTextFromElement(main);
			result.success = true;
		}
	}

	// Strategy 3: Look for common content class names
	if (!result.success) {
		const contentSelectors = [
			".post-content",
			".article-content",
			".entry-content",
			".content",
			".story-body",
			".article-body",
			"[class*='article']",
			"[class*='content']",
			"[class*='post']",
		];

		for (const selector of contentSelectors) {
			const element = document.querySelector(selector);
			if (element && hasSubstantialText(element)) {
				result.mainContent = extractTextFromElement(element);
				result.success = true;
				break;
			}
		}
	}

	// Strategy 4: Find largest text block (fallback)
	if (!result.success) {
		const textBlocks = findLargestTextBlocks();
		if (textBlocks.length > 0) {
			result.mainContent = textBlocks.join("\n\n");
			result.success = true;
		}
	}

	// Extract metadata
	result.metadata = extractMetadata();

	// Calculate word count
	result.metadata.wordCount = countWords(result.mainContent);

	// Create excerpt (first 200 characters)
	if (result.mainContent.length > 200) {
		result.metadata.excerpt = result.mainContent.substring(0, 200) + "...";
	} else {
		result.metadata.excerpt = result.mainContent;
	}

	// Cache the result
	cachedContent = result;
	cacheTimestamp = now;
	cacheUrl = currentUrl;

	return result;
}

/**
 * Extract clean text from an element
 * OPTIMIZED: Avoid expensive cloneNode, use TreeWalker for filtering
 */
function extractTextFromElement(element: Element): string {
	// OPTIMIZED: Use TreeWalker to traverse only text nodes
	// This avoids cloning the entire DOM subtree
	const textParts: string[] = [];

	// Create a TreeWalker to traverse text nodes efficiently
	const walker = document.createTreeWalker(
		element,
		NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
		{
			acceptNode: (node) => {
				// Skip unwanted elements
				if (node.nodeType === Node.ELEMENT_NODE) {
					const elem = node as Element;
					const tagName = elem.tagName.toLowerCase();

					// Skip non-content tags
					if (
						[
							"script",
							"style",
							"nav",
							"header",
							"footer",
							"aside",
							"button",
						].includes(tagName)
					) {
						return NodeFilter.FILTER_REJECT;
					}

					// Skip elements with non-content class names
					const className = elem.className || "";
					if (
						typeof className === "string" &&
						(className.includes("ad") ||
							className.includes("navigation") ||
							className.includes("menu") ||
							className.includes("sidebar") ||
							className.includes("comment"))
					) {
						return NodeFilter.FILTER_REJECT;
					}

					return NodeFilter.FILTER_SKIP;
				}

				// Accept text nodes
				return NodeFilter.FILTER_ACCEPT;
			},
		},
	);

	// Collect text from accepted nodes
	let node: Node | null;
	while ((node = walker.nextNode())) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent?.trim() || "";
			if (text.length > 0) {
				textParts.push(text);
			}
		}
	}

	// Join and clean up whitespace
	return textParts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Check if element has substantial text content
 */
function hasSubstantialText(element: Element): boolean {
	const text = element.textContent || "";
	const wordCount = countWords(text);
	return wordCount >= 100; // At least 100 words to be considered substantial
}

/**
 * Find largest text blocks on the page
 * OPTIMIZED: Only query paragraphs and articles, avoid all divs
 */
function findLargestTextBlocks(): string[] {
	const blocks: Array<{ element: Element; wordCount: number; text: string }> =
		[];

	// OPTIMIZED: More focused selector - avoid querying ALL divs
	// Only look at semantic content elements
	const elements = document.querySelectorAll(
		"p, article, section, blockquote, h1, h2, h3",
	);

	elements.forEach((element) => {
		const text = element.textContent?.trim() || "";
		const wordCount = countWords(text);

		if (wordCount >= 50 && !isLikelyNonContent(element)) {
			blocks.push({ element, wordCount, text });
		}
	});

	// Sort by word count
	blocks.sort((a, b) => b.wordCount - a.wordCount);

	// Return top blocks
	return blocks.slice(0, 10).map((block) => block.text);
}

/**
 * Check if element is likely non-content (navigation, ads, etc.)
 */
function isLikelyNonContent(element: Element): boolean {
	const className = element.className || "";
	const id = element.id || "";

	const nonContentPatterns = [
		"nav",
		"menu",
		"sidebar",
		"advertisement",
		"ad",
		"footer",
		"header",
		"comment",
		"cookie",
		"modal",
		"popup",
	];

	const combined = `${className} ${id}`.toLowerCase();

	return nonContentPatterns.some((pattern) => combined.includes(pattern));
}

/**
 * Extract page metadata
 */
function extractMetadata(): ExtractedContent["metadata"] {
	const metadata: ExtractedContent["metadata"] = {
		wordCount: 0,
	};

	// Author
	const authorMeta = document.querySelector(
		'meta[name="author"], meta[property="article:author"]',
	);
	if (authorMeta) {
		metadata.author = authorMeta.getAttribute("content") || undefined;
	}

	// Try schema.org structured data
	if (!metadata.author) {
		const authorElement = document.querySelector('[itemprop="author"]');
		if (authorElement) {
			metadata.author = authorElement.textContent?.trim();
		}
	}

	// Publish date
	const dateMeta = document.querySelector(
		'meta[property="article:published_time"], meta[name="publishdate"]',
	);
	if (dateMeta) {
		metadata.publishDate = dateMeta.getAttribute("content") || undefined;
	}

	// Try schema.org for date
	if (!metadata.publishDate) {
		const dateElement = document.querySelector('[itemprop="datePublished"]');
		if (dateElement) {
			metadata.publishDate =
				dateElement.getAttribute("content") || dateElement.textContent?.trim();
		}
	}

	// Description
	const descMeta = document.querySelector(
		'meta[name="description"], meta[property="og:description"]',
	);
	if (descMeta) {
		metadata.description = descMeta.getAttribute("content") || undefined;
	}

	return metadata;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
	if (!text) return 0;
	return text.split(/\s+/).filter((word) => word.length > 0).length;
}
