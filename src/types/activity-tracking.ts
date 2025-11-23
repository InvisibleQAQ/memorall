/**
 * Activity Tracking Types
 * Type-safe definitions for user activity capture system
 */

// ============================================================================
// Core Activity Types
// ============================================================================

export type ActivityType =
	| "page_visit"
	| "network_request" // Deprecated - kept for backward compatibility
	| "user_input"
	| "click"
	| "scroll"
	| "navigation"
	| "form_submit"
	| "text_reading" // Deprecated - replaced by content_reading
	| "content_reading"
	| "youtube_video"
	| "video_watching"
	| "video_call";

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
	| TextReadingData
	| ContentReadingData
	| YouTubeVideoData
	| VideoWatchingData
	| VideoCallData;

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
	// Enhanced context
	label?: string; // Associated label text
	textContent?: string; // Visible text content (for buttons, links)
	title?: string; // Title attribute
	role?: string; // ARIA role
	autocomplete?: string; // Autocomplete attribute for inputs
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
// Content Reading Tracking (Intelligent Reading Detection)
// ============================================================================

export interface ContentReadingData {
	type: "content_reading";
	pageUrl: string;
	pageTitle: string;
	tabId: number;

	// Main content extracted
	mainContent: string;
	contentMetadata: {
		author?: string;
		publishDate?: string;
		description?: string;
		wordCount: number;
		excerpt?: string;
	};

	// Reading behavior metrics (simple)
	readingMetrics: {
		viewDuration: number; // Total time on page (ms)
		estimatedWordsRead: number; // Total words on page
	};

	// Context
	scrollDepth: number; // Deprecated - not used
	captureTime: number;
	truncated: boolean;
}

// ============================================================================
// YouTube Video Tracking
// ============================================================================

export interface YouTubeVideoData {
	type: "youtube_video";
	pageUrl: string;
	tabId: number;

	// Video information
	videoId: string;
	videoUrl: string;
	title: string;
	channelName: string;
	channelUrl?: string;
	description?: string;
	duration: number; // Total video duration in seconds
	publishDate?: string;
	viewCount?: number;

	// Watch data
	watchDuration: number; // How long user watched (seconds)
	completionPercentage: number; // 0-100
	playbackSpeed: number; // 1.0 = normal, 1.5 = faster, etc.
	watchedRanges?: Array<{ start: number; end: number }>; // Segments watched

	// Transcript (if available)
	transcript?: {
		fullText: string;
		timestampedSegments: Array<{
			text: string;
			startTime: number; // Seconds
			duration: number;
		}>;
		language: string;
		isAutoGenerated: boolean;
	};

	captureTime: number;
}

// ============================================================================
// Video Watching Tracking (HTML5 Video)
// ============================================================================

export interface VideoWatchingData {
	type: "video_watching";
	pageUrl: string;
	pageTitle: string;
	tabId: number;

	// Video information
	videoUrl: string; // Source URL
	videoTitle?: string; // From page metadata or context
	posterUrl?: string; // Poster image
	duration: number; // Total duration in seconds

	// Watch data
	watchDuration: number; // Actual watch time (seconds)
	completionPercentage: number; // 0-100
	playbackSpeed: number;

	// Events timeline
	events: Array<{
		type: "play" | "pause" | "seek" | "ended" | "ratechange";
		timestamp: number; // Unix timestamp
		position: number; // Video position in seconds
		metadata?: Record<string, unknown>; // Extra event data
	}>;

	// Context
	embedContext?: {
		embedType: "native" | "iframe" | "custom";
		containerSelector?: string;
	};

	captureTime: number;
}

// ============================================================================
// Video Call Tracking
// ============================================================================

export interface VideoCallData {
	type: "video_call";
	pageUrl: string;
	tabId: number;

	// Platform
	platform: "google_meet" | "zoom" | "teams" | "other";

	// Meeting information
	meetingId?: string;
	meetingUrl: string;
	meetingTitle?: string; // If available from page
	meetingCode?: string; // Meet code, Zoom ID, etc.

	// Timing
	joinTime: number; // Unix timestamp when joined
	leaveTime?: number; // Unix timestamp when left
	duration: number; // Duration in milliseconds

	// Participants (if available and not privacy-sensitive)
	participantCount?: number;

	// Captions/Transcript
	captions?: Array<{
		speaker?: string; // Speaker name or identifier
		text: string;
		timestamp: number; // Unix timestamp
		confidence?: number; // Caption confidence score if available
	}>;

	// Meeting metadata
	metadata?: {
		isHost?: boolean;
		recordingEnabled?: boolean;
		screenSharing?: boolean;
	};

	captureTime: number;
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
	trackNetworkRequests: boolean; // Deprecated - not valuable for recall
	trackUserInputs: boolean;
	trackClicks: boolean;
	trackScrolls: boolean;
	trackFormSubmits: boolean;
	trackTextReading: boolean; // Deprecated - use trackContentReading
	textReadingDelaySeconds: number; // Deprecated
	maxTextLength: number; // Maximum length of text to capture (default 10000 chars)

	// New intelligent tracking
	trackContentReading: boolean; // Intelligent reading detection
	trackYouTubeVideos: boolean; // YouTube video tracking with transcripts
	trackVideoWatching: boolean; // HTML5 video tracking
	trackVideoCalls: boolean; // Video call tracking (Meet, Zoom, Teams)

	// Content reading settings (visible content + WPS based)
	contentReading: {
		minWordCount: number; // Minimum visible words to capture (default 50)
		includeMetadata: boolean; // Extract author, date, etc.
	};

	// YouTube settings
	youTube: {
		captureTranscripts: boolean; // Try to capture video transcripts
		minWatchDuration: number; // Minimum seconds watched to record (default 10s)
	};

	// Video call settings
	videoCalls: {
		captureCaptions: boolean; // Capture meeting captions
		captureMetadata: boolean; // Capture meeting metadata
	};

	// Privacy & storage
	redactSensitiveInputs: boolean;
	maxStorageSizeMB: number;
	autoStopAfterMinutes?: number;
}

export const DEFAULT_CAPTURE_CONFIG: ActivityCaptureConfig = {
	// Basic tracking
	trackPageVisits: true,
	trackNetworkRequests: false, // Disabled - not valuable for recall
	trackUserInputs: false, // Disabled by default - privacy concern
	trackClicks: false, // Disabled by default - too much noise
	trackScrolls: false, // Disabled by default - only needed for content reading
	trackFormSubmits: false, // Disabled by default - limited value
	trackTextReading: false, // Deprecated - use trackContentReading
	textReadingDelaySeconds: 10, // Deprecated
	maxTextLength: 10000,

	// New intelligent tracking (selective defaults)
	trackContentReading: true, // ✅ Enabled - most valuable
	trackYouTubeVideos: true, // ✅ Enabled - high value
	trackVideoWatching: false, // Disabled - less common
	trackVideoCalls: true, // ✅ Enabled - high value

	// Content reading settings (visible content + WPS based)
	contentReading: {
		minWordCount: 50, // Minimum visible words (200 WPM = 15s to read 50 words)
		includeMetadata: true,
	},

	// YouTube settings
	youTube: {
		captureTranscripts: true,
		minWatchDuration: 30, // Increased from 10 to 30 seconds
	},

	// Video call settings
	videoCalls: {
		captureCaptions: true,
		captureMetadata: true,
	},

	// Privacy & storage
	redactSensitiveInputs: true,
	maxStorageSizeMB: 100,
	autoStopAfterMinutes: undefined,
};
