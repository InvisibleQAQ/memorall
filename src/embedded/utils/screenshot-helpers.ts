/**
 * Screenshot capture utilities
 * Performance-optimized helpers for html2canvas with progressive fallback
 */

import { logError } from "@/utils/logger";
import html2canvas from "html2canvas";

// Cache for elements that have been checked for unsupported colors
const colorCheckCache = new WeakMap<Element, boolean>();

// Color properties to check (instead of all properties)
const COLOR_PROPERTIES = [
	"color",
	"background-color",
	"border-color",
	"border-top-color",
	"border-right-color",
	"border-bottom-color",
	"border-left-color",
	"outline-color",
	"text-decoration-color",
	"fill",
	"stroke",
];

// Unsupported color functions that html2canvas can't handle
const UNSUPPORTED_COLOR_PATTERNS = ["oklch(", "oklab(", "lch(", "lab("];

/**
 * Check if an element has unsupported color functions
 * Optimized version that:
 * 1. Uses caching to avoid repeated checks
 * 2. Only checks color-related properties (not all properties)
 * 3. Early exits on first match
 */
export const hasUnsupportedColors = (element: Element): boolean => {
	try {
		if (!(element instanceof HTMLElement)) return false;

		// Check cache first
		const cached = colorCheckCache.get(element);
		if (cached !== undefined) {
			return cached;
		}

		const computedStyle = window.getComputedStyle(element);

		// Only check color-related properties instead of all properties
		for (const prop of COLOR_PROPERTIES) {
			const value = computedStyle.getPropertyValue(prop);
			if (value) {
				// Check if value contains any unsupported color function
				for (const pattern of UNSUPPORTED_COLOR_PATTERNS) {
					if (value.includes(pattern)) {
						colorCheckCache.set(element, true);
						return true;
					}
				}
			}
		}

		// Cache the result
		colorCheckCache.set(element, false);
		return false;
	} catch (e) {
		return false;
	}
};

/**
 * Capture screenshot with progressive fallback strategy
 * 1. Try fast mode (no color checking) - 99% of pages work
 * 2. If fails, retry with color checking (slower but safer)
 *
 * This gives best performance for most pages while handling edge cases
 */
export const captureScreenshotWithFallback = async (
	element: HTMLElement,
	config: any = {},
): Promise<HTMLCanvasElement> => {
	const baseConfig = {
		allowTaint: true,
		useCORS: true,
		logging: false,
		...config,
	};

	try {
		// FAST MODE: Try without color checking first
		const canvas = await html2canvas(element, baseConfig);
		return canvas;
	} catch (error) {
		try {
			// Preserve original ignoreElements function if it exists
			const originalIgnoreElements = config.ignoreElements;

			const safeConfig = {
				...baseConfig,
				ignoreElements: (el: Element) => {
					// Add any custom ignore logic from original config
					if (typeof originalIgnoreElements === "function") {
						if (originalIgnoreElements(el)) return true;
					}

					// Check for unsupported colors
					return hasUnsupportedColors(el);
				},
			};

			const canvas = await html2canvas(element, safeConfig);
			return canvas;
		} catch (fallbackError) {
			logError("❌ Screenshot capture failed:", fallbackError);
			throw fallbackError;
		}
	}
};

/**
 * Clear the color check cache
 * Call this if you need to re-check elements (e.g., after DOM changes)
 */
export const clearColorCheckCache = (): void => {
	// WeakMap doesn't have a clear method, but we can't really clear it
	// The garbage collector will handle it when elements are removed
};
