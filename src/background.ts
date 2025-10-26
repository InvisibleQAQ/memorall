// Background script for Memorall extension
// Handles context menu registration and message routing only.

import { logInfo, logError } from "./utils/logger";
import { backgroundJob } from "./services/background-jobs/background-job";
import { backgroundJobMessageForwarder } from "./background/message-forwarder";
import { sharedStorageService } from "./services/shared-storage";
import { CONTENT_BACKGROUND_EVENTS } from "./constants/content-background";

const SAVE_THIS_PAGE_CONTEXT_MENU_ID = "save-this-page";
const SAVE_CONTENT_CONTEXT_MENU_ID = "save-content";
const SAVE_TO_TOPIC_CONTEXT_MENU_ID = "save-to-topic";
const RECALL_CONTEXT_MENU_ID = "recall";
const RECALL_TOPIC_CONTEXT_MENU_ID = "recall-topic";
const OPEN_FULL_PAGE_CONTEXT_MENU_ID = "open-full-page";

// PDF context menu IDs
const DOCUMENTS_CONTEXT_MENU_ID = "documents";

// Helper to create notifications with proper icon
function createNotification(title: string, message: string): void {
	chrome.notifications?.create({
		type: "basic" as const,
		title,
		message,
		iconUrl: chrome.runtime.getURL("icons/extension_48.png"), // Use extension icon (build transforms images/ to icons/)
	});
}

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
		logInfo("✅ Immediate initialization completed");
	} catch (error) {
		logError("❌ Failed immediate initialization:", error);
	}
})();

// Create context menus on install
chrome.runtime.onInstalled.addListener(async () => {
	try {
		// Create main "Save page" menu for full page
		chrome.contextMenus.create({
			id: SAVE_THIS_PAGE_CONTEXT_MENU_ID,
			title: "Save page to file",
			contexts: ["page", "link"],
		});

		// Create "Save selection" menu for selected content
		chrome.contextMenus.create({
			id: SAVE_CONTENT_CONTEXT_MENU_ID,
			title: "Save selection to file",
			contexts: ["selection"],
		});

		// Create "Save to topic" menu for topic-specific content
		chrome.contextMenus.create({
			id: SAVE_TO_TOPIC_CONTEXT_MENU_ID,
			title: "Save to topic",
			contexts: ["page", "link"],
		});

		chrome.contextMenus.create({
			id: "divider1",
			type: "separator",
		});

		// Create "Recall" menu that opens chat modal
		chrome.contextMenus.create({
			id: RECALL_CONTEXT_MENU_ID,
			title: "Recall",
			contexts: ["page", "selection"],
		});

		// Create "Recall topic" menu that opens chat modal with topic context
		chrome.contextMenus.create({
			id: RECALL_TOPIC_CONTEXT_MENU_ID,
			title: "Recall topic",
			contexts: ["page", "selection"],
		});

		chrome.contextMenus.create({
			id: "divider2",
			type: "separator",
		});

		// Create "Open full page" menu that opens full page
		chrome.contextMenus.create({
			id: OPEN_FULL_PAGE_CONTEXT_MENU_ID,
			title: "Open platform",
			contexts: ["page", "link"],
		});

		chrome.contextMenus.create({
			id: "divider3",
			type: "separator",
		});

		// Create PDF context menu item
		chrome.contextMenus.create({
			id: DOCUMENTS_CONTEXT_MENU_ID,
			title: "📄 Documents",
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

	// Handle PDF Tools context menu item
	if (info.menuItemId === DOCUMENTS_CONTEXT_MENU_ID) {
		logInfo("📄 PDF Tools menu item clicked");

		// Open the PDF Tools page in the extension
		try {
			chrome.storage?.session?.set?.({ navigateTo: "documents" });
			openExtensionPopup();
		} catch (error) {
			logError("❌ Failed to open PDF Tools page:", error);
		}
		return;
	}

	// Handle recall context menu items
	if (
		info.menuItemId === RECALL_CONTEXT_MENU_ID ||
		info.menuItemId === RECALL_TOPIC_CONTEXT_MENU_ID
	) {
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
				context: info.selectionText || "",
				mode:
					info.menuItemId === RECALL_TOPIC_CONTEXT_MENU_ID
						? "topic"
						: "general",
			});
			logInfo("📨 Content script response to SHOW_CHAT_MODAL:", chatResponse);
		} catch (error) {
			logError("❌ Failed to show chat modal:", error);
		}
		return;
	}

	// Open the action popup immediately only for save-related items
	if (
		info.menuItemId === SAVE_THIS_PAGE_CONTEXT_MENU_ID ||
		info.menuItemId === SAVE_CONTENT_CONTEXT_MENU_ID ||
		info.menuItemId === SAVE_TO_TOPIC_CONTEXT_MENU_ID
	) {
		try {
			// Check if LLM is configured by getting current model
			let hasConfiguredLLM = false;
			try {
				await ensureOffscreenDocument();
				const getCurrentModelResponse = await backgroundJob.execute(
					"get-current-model",
					{},
					{ stream: false },
				);

				if ("promise" in getCurrentModelResponse) {
					const result = await getCurrentModelResponse.promise;
					hasConfiguredLLM = !!result?.result?.modelInfo;
					logInfo("🤖 LLM configuration check:", {
						hasConfiguredLLM,
						modelInfo: result?.result?.modelInfo,
					});
				}
			} catch (error) {
				logError("❌ Failed to check LLM configuration:", error);
				hasConfiguredLLM = false;
			}

			// Handle different menu actions
			if (info.menuItemId === SAVE_TO_TOPIC_CONTEXT_MENU_ID) {
				try {
					logInfo("🏷️ Save to topic clicked - checking topics existence");

					// Check if topics exist before deciding UI approach
					await ensureOffscreenDocument();
					logInfo("🏷️ About to execute check-topics-exist job");
					const jobTopicsExistResponse = await backgroundJob.execute(
						"check-topics-exist",
						{},
						{ stream: false },
					);
					logInfo("🏷️ Job execution initiated");

					if ("promise" in jobTopicsExistResponse && tab?.id) {
						const jobTopicsExistResult = await jobTopicsExistResponse.promise;
						logInfo("🏷️ Topic existence check result:", jobTopicsExistResult);

						if (jobTopicsExistResult?.result?.hasTopics) {
							// Topics exist - show content script topic selector UI
							logInfo(
								"🏷️ Topics exist - sending message to show content script topic selector",
							);

							// Send message to content script to show topic selector
							const topicSelectorResponse = await chrome.tabs.sendMessage(
								tab.id,
								{
									type: CONTENT_BACKGROUND_EVENTS.SHOW_TOPIC_SELECTOR,
									tabId: tab.id,
									url: tab.url,
									context: info.selectionText || "",
								},
							);
							logInfo(
								"📨 Content script response to SHOW_TOPIC_SELECTOR:",
								topicSelectorResponse,
							);
						} else {
							// No topics exist - open popup to create topics
							logInfo("🏷️ No topics exist - opening popup to create topics");
							logInfo("🏷️ Topic check result details:", {
								hasTopics: jobTopicsExistResult?.result?.hasTopics,
								fullResult: jobTopicsExistResult,
							});
							chrome.storage?.session?.set?.({
								navigateTo: "topics",
							});
							openExtensionPopup();
						}
					} else {
						logError(
							"🏷️ Failed job response structure:",
							jobTopicsExistResponse,
						);
						throw new Error("Failed to check topics existence");
					}
				} catch (error) {
					logError("❌ Failed to check topics existence:", error);
					// Fallback to topics page in popup
					chrome.storage?.session?.set?.({
						navigateTo: "topics",
					});
					openExtensionPopup();
				}
			} else {
				// For other save actions, open popup and navigate based on LLM config
				if (hasConfiguredLLM) {
				} else {
					// No LLM configured, guide user to LLM setup
					try {
						chrome.storage?.session?.set?.({ navigateTo: "llm" });
					} catch (_) {}
					openExtensionPopup();
				}
			}
		} catch (e) {
			logError("❌ openExtensionPopup threw:", e);
		}
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

		if (info.menuItemId === OPEN_FULL_PAGE_CONTEXT_MENU_ID) {
			logInfo("🧭 Open full page clicked");
			try {
				await chrome.runtime.openOptionsPage?.();
				logInfo("🪟 Options page opened via openOptionsPage()");
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
					logError("❌ Failed to open options/standalone page:", e2);
				}
			}
		} else if (info.menuItemId === SAVE_THIS_PAGE_CONTEXT_MENU_ID) {
			logInfo(`🔄 Save page clicked for tab: ${tab.id}, URL: ${tab.url}`);

			// Send message to content script to extract full page content
			const contentResponse = await chrome.tabs.sendMessage(tab.id, {
				type: CONTENT_BACKGROUND_EVENTS.REMEMBER_THIS,
				tabId: tab.id,
				url: tab.url,
			});
			logInfo("📨 Content script response to save page:", contentResponse);
		} else if (info.menuItemId === SAVE_CONTENT_CONTEXT_MENU_ID) {
			logInfo(
				`🔄 Save selection clicked for tab: ${tab.id}, selection: "${info.selectionText}"`,
			);

			// Send message to content script to extract selected content
			const selectionResponse = await chrome.tabs.sendMessage(tab.id, {
				type: CONTENT_BACKGROUND_EVENTS.REMEMBER_CONTENT,
				tabId: tab.id,
				url: tab.url,
				selectedText: info.selectionText || "",
			});
			logInfo(
				"📨 Content script response to save selection:",
				selectionResponse,
			);
		} else if (info.menuItemId === SAVE_TO_TOPIC_CONTEXT_MENU_ID) {
			logInfo(`🔄 Save to topic clicked for tab: ${tab.id}`);

			// Send message to content script to store context data with topic selector flag
			const topicResponse = await chrome.tabs.sendMessage(tab.id, {
				type: CONTENT_BACKGROUND_EVENTS.LET_REMEMBER,
				tabId: tab.id,
				url: tab.url,
				context: info.selectionText || "",
				showTopicSelector: true,
			});
			logInfo("📨 Content script response to save to topic:", topicResponse);
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
					if (result?.result?.topics) {
						sendResponse({ success: true, topics: result.result.topics });
					} else {
						sendResponse({ success: false, error: "No topics found" });
					}
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
	} else if (message.type === "TOPIC_SELECTED_FOR_SAVE") {
		// Handle topic selection from content script
		try {
			chrome.storage?.session?.set?.({
				saveContext: message.contextData,
				showTopicSelector: true,
				navigateTo: "documents",
			});
			openExtensionPopup();
			sendResponse({ success: true });
		} catch (error) {
			logError("❌ Failed to handle topic selection:", error);
			sendResponse({
				success: false,
				error: "Failed to handle topic selection",
			});
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
	} else if (message.type === CONTENT_BACKGROUND_EVENTS.SELECTION_EXTRACTED) {
		// Handle async processing for selected content
		(async () => {
			try {
				// Enqueue selected content for background save
				const selectionData = {
					sourceType: "selection" as const,
					sourceUrl: undefined,
					originalUrl: message.data.sourceMetadata.pageUrl,
					title: `Selection from: ${message.data.sourceMetadata.pageTitle}`,
					rawContent: message.data.selectedText,
					cleanContent: message.data.selectedText,
					textContent: message.data.selectedText,
					sourceMetadata: message.data.sourceMetadata,
					extractionMetadata: {
						selectionLength: message.data.selectedText.length,
						hasContext: !!message.data.selectionContext,
						extractedAt: new Date().toISOString(),
					},
				};

				startLoading(); // Show loading indicator

				const saveResponse = await backgroundJob.execute(
					"remember-save",
					selectionData,
					{ stream: false },
				);

				if (!("promise" in saveResponse)) {
					throw new Error("Failed to process selection");
				}

				const saveResult = (await saveResponse.promise).result;

				if (!saveResult || !("filePath" in saveResult)) {
					throw new Error("No file path returned from save operation");
				}

				logInfo("✅ Selection saved as file:", saveResult.filePath);

				sendResponse({ success: true, filePath: saveResult.filePath });
			} catch (error) {
				logError("❌ Failed to process selection:", error);

				const errorResponse = {
					success: false,
					error:
						error instanceof Error ? error.message : "Failed to save selection",
				};

				sendResponse(errorResponse);
			} finally {
				stopLoading(); // Hide loading indicator
			}
		})();

		return true;
	}
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
