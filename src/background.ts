// Background script for Memorall extension
// Handles context menu registration and message routing only.

import { logInfo, logError } from "./utils/logger";
import { backgroundJob } from "./services/background-jobs/background-job";
import { backgroundJobMessageForwarder } from "./background/message-forwarder";
import { sharedStorageService } from "./services/shared-storage";
import { CONTENT_BACKGROUND_EVENTS } from "./constants/content-background";
import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "./constants/language";
import type { Language } from "./constants/language";

// Language management
let currentLanguage: Language = DEFAULT_LANGUAGE;

// Context menu text translations
const CONTEXT_MENU_TEXTS = {
	en: {
		savePage: "💾 Save page",
		recall: "🧠 Recall",
		openPlatform: "🚀 Open platform",
		openDocuments: "📄 Open documents",
	},
	vn: {
		savePage: "💾 Lưu trang",
		recall: "🧠 Gợi nhớ",
		openPlatform: "🚀 Mở nền tảng",
		openDocuments: "📄 Mở tài liệu",
	},
};

// Save section
const SAVE_PAGE_CONTEXT_MENU_ID = "save-page";

// Recall section
const RECALL_CONTEXT_MENU_ID = "recall";

// Open section
const OPEN_PLATFORM_CONTEXT_MENU_ID = "open-platform";
const OPEN_DOCUMENTS_CONTEXT_MENU_ID = "open-documents";

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

		await chrome.contextMenus.update(RECALL_CONTEXT_MENU_ID, {
			title: texts.recall,
		});

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

// Offscreen document management
let offscreenCreated = false;
let offscreenInitPromise: Promise<void> | null = null;

// Loading state management
let activeJobs = 0;

// Update extension icon loading state
function updateIconLoadingState() {
	if (activeJobs > 0) {
		// Show loading state
		chrome.action.setBadgeText({ text: "..." });
		chrome.action.setBadgeBackgroundColor({ color: "#4285f4" });
		chrome.action.setTitle({ title: "Processing..." });
	} else {
		// Clear loading state
		chrome.action.setBadgeText({ text: "" });
		chrome.action.setTitle({ title: "Memorall" });
	}
}

// Start loading indicator
function startLoading() {
	activeJobs++;
	updateIconLoadingState();
	logInfo(`🔄 Started loading (${activeJobs} active jobs)`);
}

// Stop loading indicator
function stopLoading() {
	activeJobs = Math.max(0, activeJobs - 1);
	updateIconLoadingState();
	logInfo(`✅ Stopped loading (${activeJobs} active jobs)`);
}

// Will initialize offscreen document after function definitions

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
		const contexts = await chrome.runtime.getContexts({
			contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
		});

		if (contexts.length > 0) {
			offscreenCreated = true;
			logInfo("✅ Offscreen document already exists", contexts);
			return;
		}

		// Create offscreen document
		const offscreenUrl = chrome.runtime.getURL("offscreen.html");
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

// Initialize shared services immediately when Service Worker loads
logInfo("🔄 Service Worker loaded, initializing core services...");

(async () => {
	try {
		// Initialize shared storage service early
		await sharedStorageService.initialize();
		logInfo("✅ Shared storage service initialized");

		// Initialize background job queue
		await backgroundJob.initialize();
		logInfo("✅ Background job queue initialized");

		// Initialize message relay for job notifications
		backgroundJobMessageForwarder.initialize();
		logInfo("✅ Background job message relay initialized");

		// Initialize offscreen document
		await ensureOffscreenDocument();

		// Load current language
		await loadCurrentLanguage();

		logInfo("✅ Immediate initialization completed");
	} catch (error) {
		logError("❌ Failed immediate initialization:", error);
	}
})();

// Create context menus on install
chrome.runtime.onInstalled.addListener(async () => {
	try {
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
			id: "save-divider",
			type: "separator",
		});

		// === RECALL SECTION ===
		chrome.contextMenus.create({
			id: RECALL_CONTEXT_MENU_ID,
			title: texts.recall,
			contexts: ["page", "selection"],
		});

		chrome.contextMenus.create({
			id: "recall-divider",
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

		ensureOffscreenDocument().catch((error) => {
			logError(
				"⚠️ Failed to create offscreen document during initialization:",
				error,
			);
		});

		await chrome.runtime.openOptionsPage?.();
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
				type: CONTENT_BACKGROUND_EVENTS.SHOW_CHAT_MODAL,
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
				type: CONTENT_BACKGROUND_EVENTS.SHOW_TOPIC_SELECTOR,
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

// Handle messages from content scripts and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === "GET_TOPICS_FOR_SELECTOR") {
		// Handle async topic loading for content script
		(async () => {
			try {
				await ensureOffscreenDocument();
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
	} else if (message.type === "OPEN_FULL_PAGE") {
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
	} else if (message.type === "OPEN_SAVE_PAGE") {
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
	} else if (message.type === "SAVE_CONTENT_WITH_TOPIC") {
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
						type: CONTENT_BACKGROUND_EVENTS.REMEMBER_THIS,
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
	} else if (message.type === CONTENT_BACKGROUND_EVENTS.CONTENT_EXTRACTED) {
		// Handle async processing
		(async () => {
			try {
				// Queue the page for background save (offscreen will process)
				startLoading(); // Show loading indicator
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
			} finally {
				stopLoading(); // Hide loading indicator
			}
		})();

		// Return true to indicate async response
		return true;
	}
	// Note: FILESYSTEM_CHANGED relay removed - chrome.runtime.sendMessage auto-broadcasts
	// in MV3, so document-storage.ts handles both sending and receiving directly
});

// Handle extension startup
chrome.runtime.onStartup.addListener(async () => {
	try {
		logInfo("🚀 Memorall extension startup - services already initialized");
		// Note: Core services are initialized immediately when Service Worker loads
		// This event is just for startup-specific tasks if needed in the future
	} catch (error) {
		logError("❌ Startup error:", error);
	}
});

// ============================================================================
// EXTENSION POPUP HANDLER
// ============================================================================

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
