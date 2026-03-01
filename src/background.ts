// Background script for Memorall extension
// Handles context menu registration and message routing only.

import { logInfo, logError } from "./utils/logger";
import { backgroundJob } from "./services/background-jobs/background-job";
import { isJobNotificationMessage } from "./services/background-jobs/bridges/types";
import type { JobNotificationMessage } from "./services/background-jobs/bridges/types";
import { portBridge } from "./background/port-bridge";
import { sharedStorageService } from "./services/shared-storage";
import { BACKGROUND_EVENTS } from "./constants/events";
import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "./constants/language";
import type { Language } from "./constants/language";
import { activityTrackingManager } from "./background/activity-tracking-manager";

// Offscreen watchdog
const OFFSCREEN_WATCHDOG_INTERVAL_MS = 60_000; // 1 minute (safe)
let offscreenWatchdogTimer: number | null = null;

// Initialization state
let initializationInProgress = false;
let initialized = false;

// Language management
let currentLanguage: Language = DEFAULT_LANGUAGE;

// Context menu text translations
const CONTEXT_MENU_TEXTS = {
	en: {
		savePage: "💾 Save page",
		convertToKnowledge: "✨ Convert to knowledge",
		recall: "🧠 Recall",
		recallImage: "🖼️ Recall image",
		startCapture: "✨ Start AI session",
		stopCapture: "⏸️ End AI session",
		viewActivities: "📖 View my memory timeline",
		openPlatform: "🚀 Open platform",
		openDocuments: "📄 Open documents",
	},
	vn: {
		savePage: "💾 Lưu trang",
		convertToKnowledge: "✨ Chuyển thành kiến thức",
		recall: "🧠 Gợi nhớ",
		recallImage: "🖼️ Gợi nhớ hình ảnh",
		startCapture: "✨ Bắt đầu phiên AI",
		stopCapture: "⏸️ Kết thúc phiên AI",
		viewActivities: "📖 Xem dòng thời gian của tôi",
		openPlatform: "🚀 Mở nền tảng",
		openDocuments: "📄 Mở tài liệu",
	},
};

// Save section
const SAVE_PAGE_CONTEXT_MENU_ID = "save-page";
const CONVERT_TO_KNOWLEDGE_CONTEXT_MENU_ID = "convert-to-knowledge";

// Recall section
const RECALL_CONTEXT_MENU_ID = "recall";
const RECALL_IMAGE_CONTEXT_MENU_ID = "recall-image";

// Activity tracking section
const START_CAPTURE_CONTEXT_MENU_ID = "start-capture";
const STOP_CAPTURE_CONTEXT_MENU_ID = "stop-capture";
const VIEW_ACTIVITIES_CONTEXT_MENU_ID = "view-activities";

// Open section
const OPEN_PLATFORM_CONTEXT_MENU_ID = "open-platform";
const OPEN_DOCUMENTS_CONTEXT_MENU_ID = "open-documents";

// Offscreen document management
let offscreenCreated = false;
let offscreenInitPromise: Promise<void> | null = null;

// ============================================================================
// CRITICAL: Register port-bridge listener IMMEDIATELY in global scope
// This MUST happen synchronously at module load time, NOT in async functions
// Chrome extensions: chrome.runtime.onConnect listeners must be registered
// before any connection attempts, or they will never fire!
// ============================================================================
portBridge.initialize({
	proxyOptions: {
		channelName: "postgres-rpc",
	},
});

// Close existing offscreen document if it exists
async function closeOffscreenDocument(): Promise<void> {
	try {
		// Check if offscreen API is available
		if (!chrome.offscreen) {
			logInfo("⚠️ Chrome offscreen API not available");
			return;
		}

		// Check for existing offscreen documents
		const contexts = await chrome.runtime.getContexts({
			contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
		});

		if (contexts.length > 0) {
			logInfo(`🗑️ Closing ${contexts.length} existing offscreen document(s)...`);
			await chrome.offscreen.closeDocument();
			logInfo("✅ Offscreen document(s) closed");
		} else {
			logInfo("ℹ️ No existing offscreen documents to close");
		}

		// CRITICAL: Clear the offscreen initialization status from shared storage
		// This ensures the offscreen will be re-initialized properly
		logInfo(
			"🧹 Clearing offscreen initialization status from shared storage...",
		);
		await sharedStorageService.set("offscreenProgress", {
			done: false,
			progress: 0,
			status: "Pending",
		});

		// Reset state flags
		offscreenCreated = false;
		offscreenInitPromise = null;
	} catch (error) {
		logError("⚠️ Error closing offscreen document:", error);
		// Reset state flags anyway to allow fresh creation
		offscreenCreated = false;
		offscreenInitPromise = null;
		// Try to clear shared storage even if close failed
		try {
			await sharedStorageService.set("offscreenProgress", {
				done: false,
				progress: 0,
				status: "Pending",
			});
		} catch {}
	}
}

// Ensure offscreen document is created and ready
async function ensureOffscreenDocument(): Promise<void> {
	if (offscreenCreated) return;
	if (offscreenInitPromise) return offscreenInitPromise;

	offscreenInitPromise = (async () => {
		logInfo("🔄 Attempting to create offscreen document...");

		// Check if offscreen API is available
		if (!chrome.offscreen) {
			throw new Error("Chrome offscreen API not available");
		}

		// Check if offscreen document already exists
		// Filter to only the main offscreen document (frameId: 0) to exclude iframes
		const offscreenUrl = chrome.runtime.getURL("offscreen.html");
		const contexts = await chrome.runtime.getContexts({
			contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
		});

		const mainOffscreenDoc = contexts.find(
			(ctx) => ctx.documentUrl === offscreenUrl && ctx.frameId === 0,
		);

		if (mainOffscreenDoc) {
			offscreenCreated = true;
			logInfo("✅ Offscreen document already exists", mainOffscreenDoc);
			return;
		}

		if (contexts.length > 0 && !mainOffscreenDoc) {
			logInfo(
				"⚠️ Found offscreen contexts but no main offscreen.html - they are likely iframes",
				contexts,
			);
		}

		// Create offscreen document
		logInfo("🔄 Creating offscreen document", { url: offscreenUrl });

		try {
			await chrome.offscreen.createDocument({
				url: offscreenUrl,
				reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
				justification:
					"Run LLM and embedding services with iframe support for knowledge graph processing",
			});

			offscreenCreated = true;
			logInfo("✅ Offscreen document created successfully");
		} catch (err: any) {
			const msg = (err && (err.message || String(err))) || "";
			// If another create already succeeded elsewhere, treat as success
			if (
				typeof msg === "string" &&
				msg.includes("Only a single offscreen document")
			) {
				logInfo("ℹ️ Offscreen already exists (create rejected). Proceeding.");
				offscreenCreated = true;
			} else {
				throw err;
			}
		}
	})();
	return offscreenInitPromise;
}

// Helper to create notifications with proper icon
function createNotification(title: string, message: string): void {
	chrome.notifications?.create({
		type: "basic" as const,
		title,
		message,
		iconUrl: chrome.runtime.getURL("icons/extension_48.png"), // Use extension icon (build transforms images/ to icons/)
	});
}

// Load current language from storage
async function loadCurrentLanguage(): Promise<void> {
	try {
		const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
		const savedLanguage = result[LANGUAGE_STORAGE_KEY];

		if (savedLanguage && (savedLanguage === "en" || savedLanguage === "vn")) {
			currentLanguage = savedLanguage;
			logInfo(`📝 Loaded language: ${currentLanguage}`);
		} else {
			currentLanguage = "en"; // Default to English
			logInfo("📝 Using default language: en");
		}
	} catch (error) {
		logError("❌ Failed to load language:", error);
		currentLanguage = "en"; // Fallback to English
	}
}

// Update context menu text based on current language
async function updateContextMenuText(): Promise<void> {
	try {
		const texts = CONTEXT_MENU_TEXTS[currentLanguage];

		await chrome.contextMenus.update(SAVE_PAGE_CONTEXT_MENU_ID, {
			title: texts.savePage,
		});

		await chrome.contextMenus.update(CONVERT_TO_KNOWLEDGE_CONTEXT_MENU_ID, {
			title: texts.convertToKnowledge,
		});

		await chrome.contextMenus.update(RECALL_CONTEXT_MENU_ID, {
			title: texts.recall,
		});

		// await chrome.contextMenus.update(RECALL_IMAGE_CONTEXT_MENU_ID, {
		// 	title: texts.recallImage,
		// });

		// Update activity tracking menu items
		// await chrome.contextMenus.update(START_CAPTURE_CONTEXT_MENU_ID, {
		// 	title: texts.startCapture,
		// });

		// await chrome.contextMenus.update(STOP_CAPTURE_CONTEXT_MENU_ID, {
		// 	title: texts.stopCapture,
		// });

		// await chrome.contextMenus.update(VIEW_ACTIVITIES_CONTEXT_MENU_ID, {
		// 	title: texts.viewActivities,
		// });

		await chrome.contextMenus.update(OPEN_PLATFORM_CONTEXT_MENU_ID, {
			title: texts.openPlatform,
		});

		await chrome.contextMenus.update(OPEN_DOCUMENTS_CONTEXT_MENU_ID, {
			title: texts.openDocuments,
		});

		logInfo(`✅ Context menu text updated to ${currentLanguage}`);
	} catch (error) {
		logError("❌ Failed to update context menu text:", error);
	}
}

// Listen for language changes in storage
chrome.storage.onChanged.addListener((changes, namespace) => {
	if (namespace === "local" && changes[LANGUAGE_STORAGE_KEY]) {
		const newLanguage = changes[LANGUAGE_STORAGE_KEY].newValue;
		if (newLanguage && (newLanguage === "en" || newLanguage === "vn")) {
			currentLanguage = newLanguage;
			logInfo(`🔄 Language changed to: ${currentLanguage}`);
			updateContextMenuText();
		}
	}
});

const init = async () => {
	// Prevent duplicate initialization
	if (initializationInProgress) {
		logInfo("⏸️ Initialization already in progress, skipping...");
		return;
	}

	if (initialized) {
		logInfo("✅ Already initialized, skipping...");
		return;
	}

	initializationInProgress = true;

	try {
		logInfo("[BACKGROUND] Init - running in service worker context");

		// CRITICAL: Close any existing offscreen document first to ensure clean state
		logInfo("🔄[BACKGROUND] Closing any existing offscreen document...");
		await closeOffscreenDocument();
		logInfo("✅[BACKGROUND] Offscreen cleanup completed");

		// Initialize shared storage service early
		await sharedStorageService.initialize();
		logInfo("✅[BACKGROUND] Shared storage service initialized");

		// Initialize background job queue
		await backgroundJob.initialize();
		logInfo("✅ Background job queue initialized");

		logInfo("✅[BACKGROUND] Job notification relay ready (inline)");

		// NOW initialize Port bridge (after offscreen services are fully ready)
		// portBridge.initialize({
		// 	proxyOptions: {
		// 		channelName: 'postgres-rpc'
		// 	}
		// });
		// logInfo("✅[BACKGROUND] Port bridge initialized for database RPC");

		// CRITICAL: Initialize offscreen document FIRST (it hosts the actual database)
		logInfo("🔄[BACKGROUND] Creating fresh offscreen document...");
		await ensureOffscreenDocument();
		logInfo("✅[BACKGROUND] Offscreen document created");

		// WAIT for offscreen SERVICES to fully initialize (same pattern as App.tsx)
		logInfo("🔄[BACKGROUND] Waiting for offscreen services to initialize...");
		const progressStream = await backgroundJob.initializeServices();

		for await (const progress of progressStream) {
			logInfo(
				`🚀[BACKGROUND] Offscreen services progress: ${progress.progress}% - ${progress.status}`,
			);

			if (progress.status === "completed") {
				logInfo("✅[BACKGROUND] Offscreen services fully initialized");
				break;
			}
		}

		// Load current language
		await loadCurrentLanguage();

		initialized = true;
		logInfo("✅[BACKGROUND] Initialization completed successfully");
	} catch (error) {
		logError("❌[BACKGROUND] Failed initialization:", error);
		// Don't set initialized = true on error, allow retry
	} finally {
		initializationInProgress = false;
	}
};

// Create context menus on install
chrome.runtime.onInstalled.addListener(async (details) => {
	try {
		logInfo(`🎉 Extension installed/updated: ${details.reason}`);

		// Initialize on install or update
		await init();

		// Load current language first
		await loadCurrentLanguage();
		const texts = CONTEXT_MENU_TEXTS[currentLanguage];

		// === SAVE SECTION ===
		chrome.contextMenus.create({
			id: SAVE_PAGE_CONTEXT_MENU_ID,
			title: texts.savePage,
			contexts: ["page", "selection"],
		});

		chrome.contextMenus.create({
			id: CONVERT_TO_KNOWLEDGE_CONTEXT_MENU_ID,
			title: texts.convertToKnowledge,
			contexts: ["selection"],
		});

		chrome.contextMenus.create({
			id: "save-divider",
			type: "separator",
		});

		// === RECALL SECTION ===
		chrome.contextMenus.create({
			id: RECALL_CONTEXT_MENU_ID,
			title: texts.recall,
			contexts: ["page", "selection"],
		});

		// chrome.contextMenus.create({
		// 	id: RECALL_IMAGE_CONTEXT_MENU_ID,
		// 	title: texts.recallImage,
		// 	contexts: ["page"],
		// });

		chrome.contextMenus.create({
			id: "recall-divider",
			type: "separator",
		});

		// === ACTIVITY TRACKING SECTION ===
		// chrome.contextMenus.create({
		// 	id: START_CAPTURE_CONTEXT_MENU_ID,
		// 	title: texts.startCapture,
		// 	contexts: ["page"],
		// });

		// chrome.contextMenus.create({
		// 	id: STOP_CAPTURE_CONTEXT_MENU_ID,
		// 	title: texts.stopCapture,
		// 	contexts: ["page"],
		// 	visible: false, // Hidden until capture starts
		// });

		// chrome.contextMenus.create({
		// 	id: VIEW_ACTIVITIES_CONTEXT_MENU_ID,
		// 	title: texts.viewActivities,
		// 	contexts: ["page"],
		// });

		chrome.contextMenus.create({
			id: "activity-divider",
			type: "separator",
		});

		// === OPEN SECTION ===
		chrome.contextMenus.create({
			id: OPEN_PLATFORM_CONTEXT_MENU_ID,
			title: texts.openPlatform,
			contexts: ["page", "link"],
		});

		chrome.contextMenus.create({
			id: OPEN_DOCUMENTS_CONTEXT_MENU_ID,
			title: texts.openDocuments,
			contexts: ["page"],
		});
	} catch (error) {
		logError("❌ Failed to initialize extension:", error);
	}
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	logInfo("📋 Context menu clicked:", {
		menuItemId: info.menuItemId,
		tabUrl: tab?.url,
		tabId: tab?.id,
		pageUrl: info.pageUrl, // The actual page URL where context menu was clicked
		linkUrl: info.linkUrl,
	});

	// Handle Open Documents context menu item
	if (info.menuItemId === OPEN_DOCUMENTS_CONTEXT_MENU_ID) {
		logInfo("📄 Open documents menu item clicked");

		// Open the documents page in the extension
		try {
			chrome.storage?.session?.set?.({ navigateTo: "documents" });
			openExtensionPopup();
		} catch (error) {
			logError("❌ Failed to open documents page:", error);
		}
		return;
	}

	// Handle recall context menu item
	if (info.menuItemId === RECALL_CONTEXT_MENU_ID) {
		if (!tab?.id) return;

		try {
			// Check if we can access the tab
			if (
				!tab.url ||
				tab.url.startsWith("chrome://") ||
				tab.url.startsWith("chrome-extension://")
			) {
				logError("❌ Cannot access this page type");
				return;
			}

			// Send message to content script to show chat modal
			const chatResponse = await chrome.tabs.sendMessage(tab.id, {
				type: BACKGROUND_EVENTS.SHOW_CHAT_MODAL,
				tabId: tab.id,
				url: tab.url,
				selectedText: info.selectionText || "",
				mode: "general",
			});
			logInfo("📨 Content script response to SHOW_CHAT_MODAL:", chatResponse);
		} catch (error) {
			logError("❌ Failed to show chat modal:", error);
		}
		return;
	}

	// Handle recall image context menu item
	if (info.menuItemId === RECALL_IMAGE_CONTEXT_MENU_ID) {
		if (!tab?.id) return;

		try {
			// Check if we can access the tab
			if (
				!tab.url ||
				tab.url.startsWith("chrome://") ||
				tab.url.startsWith("chrome-extension://")
			) {
				logError("❌ Cannot access this page type");
				return;
			}

			// Send message to content script to show image selection overlay
			const imageResponse = await chrome.tabs.sendMessage(tab.id, {
				type: BACKGROUND_EVENTS.SHOW_IMAGE_SELECTOR,
				tabId: tab.id,
				url: tab.url,
			});
			logInfo(
				"📨 Content script response to SHOW_IMAGE_SELECTOR:",
				imageResponse,
			);
		} catch (error) {
			logError("❌ Failed to show image selector:", error);
		}
		return;
	}

	// Handle start capture context menu item
	if (info.menuItemId === START_CAPTURE_CONTEXT_MENU_ID) {
		try {
			logInfo("🎯 Start capturing activities clicked");
			await activityTrackingManager.startTracking();

			// Toggle menu items visibility
			await chrome.contextMenus.update(START_CAPTURE_CONTEXT_MENU_ID, {
				visible: false,
			});
			await chrome.contextMenus.update(STOP_CAPTURE_CONTEXT_MENU_ID, {
				visible: true,
			});

			createNotification(
				"AI Session Started",
				"AI is now helping you remember your browsing. Click 'End AI session' when done.",
			);
		} catch (error) {
			logError("❌ Failed to start activity tracking:", error);
			createNotification(
				"AI Session",
				"Failed to start AI session. Please try again.",
			);
		}
		return;
	}

	// Handle stop capture context menu item
	if (info.menuItemId === STOP_CAPTURE_CONTEXT_MENU_ID) {
		try {
			logInfo("⏹️ Stop capturing activities clicked");
			await activityTrackingManager.stopTracking();

			// Toggle menu items visibility
			await chrome.contextMenus.update(START_CAPTURE_CONTEXT_MENU_ID, {
				visible: true,
			});
			await chrome.contextMenus.update(STOP_CAPTURE_CONTEXT_MENU_ID, {
				visible: false,
			});

			createNotification(
				"AI Session Ended",
				"Session saved to your memory timeline. Click 'View my memory timeline' to review.",
			);
		} catch (error) {
			logError("❌ Failed to stop activity tracking:", error);
			createNotification("AI Session", "Failed to end AI session.");
		}
		return;
	}

	// Handle view activities context menu item
	if (info.menuItemId === VIEW_ACTIVITIES_CONTEXT_MENU_ID) {
		try {
			logInfo("📊 View captured activities clicked");

			// TODO: Open timeline UI page
			// For now, just open the extension page
			// In the future, we'll navigate to a dedicated timeline page
			chrome.storage?.session?.set?.({ navigateTo: "activities" });
			await chrome.runtime.openOptionsPage?.();
		} catch (error) {
			logError("❌ Failed to open activities view:", error);
			createNotification("Memory Timeline", "Failed to open memory timeline.");
		}
		return;
	}

	// Handle save page context menu item
	if (info.menuItemId === SAVE_PAGE_CONTEXT_MENU_ID) {
		if (!tab?.id) return;

		try {
			// Check if we can access the tab
			if (
				!tab.url ||
				tab.url.startsWith("chrome://") ||
				tab.url.startsWith("chrome-extension://")
			) {
				logError("❌ Cannot access this page type");
				return;
			}

			// Always show topic selector UI with default option (topic undefined)
			logInfo("💾 Save page clicked - showing topic selector");
			const topicSelectorResponse = await chrome.tabs.sendMessage(tab.id, {
				type: BACKGROUND_EVENTS.SHOW_TOPIC_SELECTOR,
				tabId: tab.id,
				url: tab.url,
				context: info.selectionText || "",
			});
			logInfo(
				"📨 Content script response to SHOW_TOPIC_SELECTOR:",
				topicSelectorResponse,
			);
		} catch (error) {
			logError("❌ Failed to show topic selector:", error);
		}
		return;
	}

	// Handle convert to knowledge context menu item
	if (info.menuItemId === CONVERT_TO_KNOWLEDGE_CONTEXT_MENU_ID) {
		if (!tab?.id) return;

		try {
			// Check if we can access the tab
			if (
				!tab.url ||
				tab.url.startsWith("chrome://") ||
				tab.url.startsWith("chrome-extension://")
			) {
				logError("❌ Cannot access this page type");
				return;
			}

			// Ensure we have selected text
			if (!info.selectionText || info.selectionText.trim().length === 0) {
				createNotification(
					"Convert to Knowledge",
					"Please select some text to convert.",
				);
				return;
			}

			logInfo("🧠 Convert to knowledge clicked", {
				selectionLength: info.selectionText.length,
				pageUrl: tab.url,
			});

			// Show starting notification
			createNotification(
				"Converting to Knowledge",
				"Processing your selected text...",
			);

			// Generate a unique identifier for this selection
			const selectionId = `selection-${Date.now()}-${Math.random().toString(36).substring(7)}`;

			// Prepare the content with source info
			const sourceInfo = `Selection from: ${tab.title || "Unknown"}\nOriginal URL: ${tab.url}\n\n`;
			const fullContent = sourceInfo + info.selectionText;

			// Convert directly to knowledge using the knowledge-graph job
			// Use aggressive extraction mode for user-selected text
			const result = await backgroundJob.execute(
				"knowledge-graph",
				{
					filePath: selectionId,
					content: fullContent,
					isSpecificTextConversion: true, // Enable aggressive extraction
					// No topicId - will use default
				},
				{ stream: false },
			);

			if ("promise" in result) {
				await result.promise;
			}

			logInfo("✅ Selection converted to knowledge successfully", {
				selectionId,
			});

			createNotification(
				"Knowledge Conversion Complete",
				"Your selected text has been converted to knowledge.",
			);
		} catch (error) {
			logError("❌ Failed to convert selection to knowledge:", error);
			createNotification(
				"Conversion Failed",
				"Failed to convert text to knowledge. Please try again.",
			);
		}
		return;
	}

	if (!tab?.id) {
		return;
	}

	try {
		// Check if we can access the tab
		if (
			!tab.url ||
			tab.url.startsWith("chrome://") ||
			tab.url.startsWith("chrome-extension://")
		) {
			logError("❌ Cannot access this page type");
			return;
		}

		if (info.menuItemId === OPEN_PLATFORM_CONTEXT_MENU_ID) {
			logInfo("🚀 Open platform clicked");
			try {
				await chrome.runtime.openOptionsPage?.();
				logInfo("🪟 Platform opened via openOptionsPage()");
			} catch (err) {
				logError("⚠️ openOptionsPage failed, falling back to tab create:", err);
				try {
					const optionsUrl = chrome.runtime.getURL("standalone.html");
					const existing = await chrome.tabs.query({ url: optionsUrl });
					if (existing.length > 0) {
						await chrome.tabs.update(existing[0].id!, { active: true });
						await chrome.windows.update(existing[0].windowId!, {
							focused: true,
						});
					} else {
						await chrome.tabs.create({ url: optionsUrl, active: true });
					}
				} catch (e2) {
					logError("❌ Failed to open platform page:", e2);
				}
			}
		}
	} catch (error) {
		logError("❌ Failed to process save request:", error);

		// Try to show error notification if possible
		try {
			createNotification(
				"Memorall",
				"Failed to save content. Please try again.",
			);
		} catch (notificationError) {
			logError("❌ Failed to show error notification:", notificationError);
		}
	}
});

// ─── Job notification relay ───────────────────────────────────────────────────
// The ONLY relay needed in the architecture: forward job notifications that target
// content scripts, since chrome.runtime.sendMessage() cannot reach them directly.
async function relayJobNotificationToContent(
	message: JobNotificationMessage,
	senderTabId: number | undefined,
): Promise<void> {
	// target="content" with a tabId → specific tab only
	if (message.target === "content" && (message.tabId ?? senderTabId)) {
		const tabId = (message.tabId ?? senderTabId)!;
		await chrome.tabs.sendMessage(tabId, message).catch(() => {
			// Tab may not have content script — silently ignore
		});
		return;
	}

	// target="content" (broadcast) or target="all" → all eligible tabs
	const tabs = await chrome.tabs.query({});
	await Promise.allSettled(
		tabs
			.filter(
				(tab) =>
					tab.id !== undefined &&
					tab.url !== undefined &&
					!tab.url.startsWith("chrome://") &&
					!tab.url.startsWith("chrome-extension://"),
			)
			.map((tab) =>
				chrome.tabs.sendMessage(tab.id!, message).catch(() => {
					// Tab may not have content script — silently ignore
				}),
			),
	);
}

// Handle messages from content scripts and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	// ── Job notification relay (must come first, before BACKGROUND_EVENTS checks) ──
	if (isJobNotificationMessage(message)) {
		if (message.target === "content" || message.target === "all") {
			void relayJobNotificationToContent(message, sender.tab?.id);
		}
		// Other targets (popup, offscreen, background) are already received directly
		// by those contexts via chrome.runtime.sendMessage — nothing more to do here.
		return false;
	}

	if (message.type === BACKGROUND_EVENTS.POPUP_OPENED) {
		logInfo("🪟 Popup opened");

		// Safe place to verify offscreen
		offscreenWatchdogCheck();
	} else if (message.type === BACKGROUND_EVENTS.ACTIVITY_CAPTURED) {
		// Handle activity data from content script
		(async () => {
			try {
				const tabId = sender.tab?.id;
				if (!tabId) {
					sendResponse({ success: false, error: "No tab ID" });
					return;
				}

				await activityTrackingManager.handleActivityFromContent(
					message.activityType,
					message.data,
					tabId,
				);
				sendResponse({ success: true });
			} catch (error) {
				logError("❌ Failed to handle activity from content:", error);
				sendResponse({
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		})();
		return true;
	} else if (message.type === BACKGROUND_EVENTS.GET_TOPICS_FOR_SELECTOR) {
		// Handle async topic loading for content script
		(async () => {
			try {
				const getTopicJobResponse = await backgroundJob.execute(
					"get-topics",
					{},
					{ stream: false },
				);

				if ("promise" in getTopicJobResponse) {
					const result = await getTopicJobResponse.promise;
					const existingTopics = result?.result?.topics || [];

					// Always add default option at the top
					const defaultTopic = {
						id: "default",
						name: "Default",
						description: "Save to default location",
					};

					const topicsWithDefault = [defaultTopic, ...existingTopics];
					sendResponse({ success: true, topics: topicsWithDefault });
				}
			} catch (error) {
				logError("❌ Failed to get topics for selector:", error);
				sendResponse({
					success: false,
					error:
						error instanceof Error ? error.message : "Failed to load topics",
				});
			}
		})();
		return true;
	} else if (message.type === BACKGROUND_EVENTS.OPEN_FULL_PAGE) {
		// Handle opening full page from embedded chat
		(async () => {
			try {
				await chrome.runtime.openOptionsPage?.();
				sendResponse({ success: true });
			} catch (error) {
				logError("❌ Failed to open full page:", error);
				sendResponse({ success: false, error: "Failed to open full page" });
			}
		})();
		return true;
	} else if (message.type === BACKGROUND_EVENTS.OPEN_SAVE_PAGE) {
		// Handle opening documents page from content script
		try {
			chrome.storage?.session?.set?.({ navigateTo: "documents" });
			openExtensionPopup();
			sendResponse({ success: true });
		} catch (error) {
			logError("❌ Failed to open documents page:", error);
			sendResponse({ success: false, error: "Failed to open documents page" });
		}
		return true;
	} else if (message.type === BACKGROUND_EVENTS.SAVE_CONTENT_WITH_TOPIC) {
		// Handle direct content saving with topic
		(async () => {
			try {
				logInfo("🔍 Background received topicId:", message.topicId);

				// Extract page content from the current tab
				if (!sender.tab?.id) {
					sendResponse({ success: false, error: "No active tab" });
					return;
				}

				// Send message to content script to extract page content with topicId
				const extractionResponse = await chrome.tabs.sendMessage(
					sender.tab.id,
					{
						type: BACKGROUND_EVENTS.REMEMBER_THIS,
						tabId: sender.tab.id,
						topicId: message.topicId,
					},
				);

				if (extractionResponse?.success) {
					sendResponse({ success: true });
				} else {
					sendResponse({
						success: false,
						error: "Failed to extract page content",
					});
				}
			} catch (error) {
				logError("❌ Failed to save content with topic:", error);
				sendResponse({
					success: false,
					error: "Failed to save content with topic",
				});
			}
		})();
		return true;
	} else if (message.type === BACKGROUND_EVENTS.CONTENT_EXTRACTED) {
		// Handle async processing
		(async () => {
			try {
				const saveResponse = await backgroundJob.execute(
					"remember-save",
					message.data,
					{ stream: false },
				);

				if (!("promise" in saveResponse)) {
					throw new Error("Failed to process extracted content");
				}

				const saveResult = (await saveResponse.promise).result;

				if (!saveResult || !("filePath" in saveResult)) {
					throw new Error("No file path returned from save operation");
				}

				logInfo("✅ Content saved as file:", saveResult.filePath);

				sendResponse({ success: true, filePath: saveResult.filePath });
			} catch (error) {
				logError("❌ Failed to process extracted content:", error);
				const errorResponse = {
					success: false,
					error:
						error instanceof Error ? error.message : "Failed to save content",
				};
				logInfo("📨 Sending error response to content script:", errorResponse);
				sendResponse(errorResponse);
			}
		})();

		// Return true to indicate async response
		return true;
	} else if (message.type === BACKGROUND_EVENTS.FILESYSTEM_CHANGED) {
		const sourceContextId =
			typeof message.sourceContextId === "string"
				? message.sourceContextId
				: undefined;
		const eventId =
			typeof message.eventId === "string" ? message.eventId : undefined;
		const relayedByBackground = message.relayedByBackground === true;
		if (relayedByBackground) {
			return false;
		}

		// Relay filesystem change notifications to ALL contexts
		// This ensures popup/UI receives updates even from offscreen document
		logInfo("🔁 Relaying FILESYSTEM_CHANGED to all contexts");

		// Broadcast to all extension contexts (popup, options page, etc.)
		chrome.runtime
			.sendMessage({
				type: BACKGROUND_EVENTS.FILESYSTEM_CHANGED,
				sourceContextId,
				eventId,
				relayedByBackground: true,
			})
			.catch((err: Error) => {
				// Ignore "no receiver" errors (normal when popup is closed)
				if (
					!err.message?.includes("Receiving end does not exist") &&
					!err.message?.includes("Could not establish connection")
				) {
					logError("Failed to relay FILESYSTEM_CHANGED:", err);
				}
			});

		// Don't send response - this is a fire-and-forget notification
		return false;
	}
});

// Handle browser startup
chrome.runtime.onStartup.addListener(async () => {
	try {
		logInfo("🚀 Browser startup detected - initializing extension");

		// Initialize when browser starts
		await init();

		logInfo("✅ Extension ready for browser session");
	} catch (error) {
		logError("❌ Startup error:", error);
	}
});

// Open the extension's action popup (if allowed)
// Notes:
// - chrome.action.openPopup() can only be called in response to a user gesture.
// - You cannot programmatically open the action popup by navigating to
//   chrome-extension://<id>/popup.html — that opens a normal tab/page, not the toolbar popup.
// - If openPopup is disallowed (no user gesture), we show a gentle notification instead.
async function openExtensionPopup(): Promise<void> {
	try {
		// MV3 API to open the toolbar action popup. Requires a user gesture.
		await chrome.action.openPopup();
		logInfo("🪟 Opened action popup");
	} catch (error) {
		const lastError = chrome.runtime?.lastError?.message;
		if (lastError) {
			logError("❌ Failed to open action popup:", lastError);
		} else {
			logError("❌ Failed to open action popup:", error);
		}
		// Avoid opening chrome-extension:// URLs directly. Inform the user instead.
		createNotification(
			"Memorall",
			"Click the Memorall toolbar icon to open the popup.",
		);
	}
}

async function offscreenWatchdogCheck(): Promise<void> {
	try {
		// Do not interfere with active initialization
		if (initializationInProgress) {
			return;
		}

		// Offscreen API not supported
		if (!chrome.offscreen) {
			return;
		}

		const offscreenUrl = chrome.runtime.getURL("offscreen.html");

		const contexts = await chrome.runtime.getContexts({
			contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
		});

		const hasMainOffscreen = contexts.some(
			(ctx) => ctx.documentUrl === offscreenUrl && ctx.frameId === 0,
		);

		if (!hasMainOffscreen) {
			logInfo("🩺 Offscreen watchdog: offscreen missing → reinitializing");

			// Reset internal flags so ensureOffscreenDocument can run cleanly
			offscreenCreated = false;
			offscreenInitPromise = null;

			await ensureOffscreenDocument();

			logInfo("✅ Offscreen watchdog: offscreen restored");
		}
	} catch (error) {
		logError("⚠️ Offscreen watchdog check failed:", error);
	}
}

if (!offscreenWatchdogTimer) {
	offscreenWatchdogTimer = setInterval(() => {
		offscreenWatchdogCheck();
	}, OFFSCREEN_WATCHDOG_INTERVAL_MS) as unknown as number;

	logInfo("🩺 Offscreen watchdog started");
}
