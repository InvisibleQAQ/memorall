/**
 * Activity Tracking Types
 * Type-safe definitions for user activity capture system
 */

// ============================================================================
// Core Activity Types
// ============================================================================

export type ActivityType =
	| "page_visit"
	| "network_request"
	| "user_input"
	| "click"
	| "scroll"
	| "navigation"
	| "form_submit"
	| "text_reading";

export interface ActivitySession {
	id: string;
	startTime: number;
	endTime: number | null;
	totalActivities: number;
	status: "active" | "stopped";
	metadata: {
		browserVersion?: string;
		platform?: string;
	};
}

export interface Activity {
	id: string;
	sessionId: string;
	type: ActivityType;
	timestamp: number;
	data: ActivityData;
}

export type ActivityData =
	| PageVisitData
	| NetworkRequestData
	| UserInputData
	| ClickData
	| ScrollData
	| NavigationData
	| FormSubmitData
	| TextReadingData;

// ============================================================================
// Page Visit Tracking
// ============================================================================

export interface PageVisitData {
	type: "page_visit";
	url: string;
	title: string;
	favicon?: string;
	tabId: number;
	windowId: number;
	startTime: number;
	endTime?: number;
	duration?: number;
	referrer?: string;
}

// ============================================================================
// Network Request Tracking
// ============================================================================

export interface NetworkRequestData {
	type: "network_request";
	url: string;
	method: string;
	requestType: string;
	statusCode?: number;
	requestBody?: string; // Request body (truncated if too large)
	requestBodySize?: number; // Original size before truncation
	requestBodyTruncated?: boolean; // Whether body was truncated
	pageUrl: string;
	pageTitle?: string;
	tabId: number;
	requestId: string;
	initiator?: string;
}

// ============================================================================
// User Input Tracking
// ============================================================================

export interface ElementInfo {
	tagName: string;
	id?: string;
	className?: string;
	name?: string;
	type?: string;
	placeholder?: string;
	xpath?: string;
	selector?: string;
	ariaLabel?: string;
}

export interface UserInputData {
	type: "user_input";
	content: string;
	inputType: "text" | "password" | "email" | "search" | "number" | "other";
	elementInfo: ElementInfo;
	pageUrl: string;
	pageTitle: string;
	tabId: number;
	// For privacy: option to hash/redact sensitive content
	isRedacted?: boolean;
}

// ============================================================================
// Click Tracking
// ============================================================================

export interface ClickData {
	type: "click";
	elementInfo: ElementInfo;
	pageUrl: string;
	pageTitle: string;
	tabId: number;
	position: {
		x: number;
		y: number;
	};
	viewport: {
		width: number;
		height: number;
	};
	isRightClick?: boolean;
}

// ============================================================================
// Scroll Tracking
// ============================================================================

export interface ScrollData {
	type: "scroll";
	pageUrl: string;
	pageTitle: string;
	tabId: number;
	scrollPosition: {
		x: number;
		y: number;
	};
	scrollDepth: number; // Percentage of page scrolled
	pageHeight: number;
}

// ============================================================================
// Navigation Tracking
// ============================================================================

export interface NavigationData {
	type: "navigation";
	fromUrl: string;
	toUrl: string;
	tabId: number;
	transitionType?: string;
	transitionQualifiers?: string[];
}

// ============================================================================
// Form Submit Tracking
// ============================================================================

export interface FormSubmitData {
	type: "form_submit";
	formInfo: ElementInfo;
	pageUrl: string;
	pageTitle: string;
	tabId: number;
	fieldCount: number;
	method?: string;
	action?: string;
}

// ============================================================================
// Text Reading Tracking
// ============================================================================

export interface TextReadingData {
	type: "text_reading";
	pageUrl: string;
	pageTitle: string;
	tabId: number;
	viewDuration: number; // How long the user has been viewing (in ms)
	visibleText: string; // The text content that was visible
	textLength: number; // Length of the text
	truncated: boolean; // Whether the text was truncated
	scrollDepth: number; // Percentage of page scrolled when captured
	captureTime: number; // Timestamp when text was captured
}

// ============================================================================
// Activity Query & Filters
// ============================================================================

export interface ActivityFilter {
	sessionId?: string;
	types?: ActivityType[];
	startTime?: number;
	endTime?: number;
	tabId?: number;
	url?: string;
	limit?: number;
	offset?: number;
}

export interface ActivityStats {
	totalActivities: number;
	byType: Record<ActivityType, number>;
	uniquePages: number;
	totalDuration: number;
	mostVisitedPages: Array<{ url: string; count: number }>;
}

// ============================================================================
// Storage Schema
// ============================================================================

export interface ActivityStorageSchema {
	sessions: ActivitySession[];
	activities: Activity[];
	currentSessionId: string | null;
}

// ============================================================================
// Configuration
// ============================================================================

export interface ActivityCaptureConfig {
	trackPageVisits: boolean;
	trackNetworkRequests: boolean;
	trackUserInputs: boolean;
	trackClicks: boolean;
	trackScrolls: boolean;
	trackFormSubmits: boolean;
	trackTextReading: boolean;
	textReadingDelaySeconds: number; // Delay before capturing text (default 10s)
	maxTextLength: number; // Maximum length of text to capture (default 10000 chars)
	redactSensitiveInputs: boolean;
	maxStorageSizeMB: number;
	autoStopAfterMinutes?: number;
}

export const DEFAULT_CAPTURE_CONFIG: ActivityCaptureConfig = {
	trackPageVisits: true,
	trackNetworkRequests: true,
	trackUserInputs: true,
	trackClicks: true,
	trackScrolls: true,
	trackFormSubmits: true,
	trackTextReading: true,
	textReadingDelaySeconds: 10,
	maxTextLength: 10000,
	redactSensitiveInputs: true,
	maxStorageSizeMB: 100,
	autoStopAfterMinutes: undefined,
};
