// Content script for Memorall extension
// Uses modular embedded components structure

import { BACKGROUND_EVENTS } from "./constants/events";
import "./embedded/activity-tracker"; // Initialize activity tracker
import {
	extractSelection,
	extractPageContent,
	storeRememberContext,
	sendMessageToBackground,
	createEmbeddedTopicSelector,
	extractReadableContent,
	extractViewportContent,
	extractViewportHTMLStructure,
	extractFullPageHTMLStructure,
	createImageSelectorOverlay,
} from "./embedded";
import { createEmbeddedChatModal } from "./embedded/pages/EmbeddedChat";
import type {
	BackgroundMessage,
	MessageResponse,
	ExtractedSelectionData,
} from "./embedded/types";
import { logInfo } from "./utils/logger";

// Track mouse position for UI positioning
let lastMouseX = 0;
let lastMouseY = 0;

// Track mouse position for context menu positioning
document.addEventListener("contextmenu", (e) => {
	lastMouseX = e.clientX;
	lastMouseY = e.clientY;
});

// Message listener handler
const messageListener = async (
	message: BackgroundMessage,
	_sender: chrome.runtime.MessageSender,
	sendResponse: (response: MessageResponse) => void,
): Promise<boolean> => {
	try {
		switch (message.type) {
			case BACKGROUND_EVENTS.REMEMBER_THIS:
				await handleRememberThis(message, sendResponse);
				return true;

			case BACKGROUND_EVENTS.REMEMBER_CONTENT:
				await handleRememberContent(message, sendResponse);
				return true;

			case BACKGROUND_EVENTS.LET_REMEMBER:
				handleLetRemember(message, sendResponse);
				return true;

			case BACKGROUND_EVENTS.SHOW_TOPIC_SELECTOR:
				handleShowTopicSelector(message, sendResponse);
				return true;

			case BACKGROUND_EVENTS.SHOW_CHAT_MODAL:
				handleShowChatModal(message, sendResponse);
				return true;

			case BACKGROUND_EVENTS.SHOW_IMAGE_SELECTOR:
				handleShowImageSelector(message, sendResponse);
				return true;

			default:
				sendResponse({ success: false, error: "Unknown message type" });
				return true;
		}
	} catch (error) {
		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return true;
	}
};

// Main message listener for background script communications
chrome.runtime.onMessage.addListener(messageListener);

// Handle REMEMBER_THIS message - extract full page content
async function handleRememberThis(
	message: BackgroundMessage,
	sendResponse: (response: MessageResponse) => void,
): Promise<void> {
	try {
		// Extract page content
		const extractedData = await extractPageContent();

		// Include topicId if provided
		if (message.topicId) {
			extractedData.topicId = message.topicId;
		}

		// Send extracted content back to background script
		const payload: BackgroundMessage = {
			type: BACKGROUND_EVENTS.CONTENT_EXTRACTED,
			tabId: message.tabId,
			data: extractedData,
		};

		let response: MessageResponse;
		try {
			response = await sendMessageToBackground(payload);
		} catch (err) {
			// Ignore errors if background is not reachable
			response = { success: false, error: "No response from background" };
		}

		sendResponse(response);
	} catch (error) {
		sendResponse({
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to extract content",
		});
	}
}

// Handle REMEMBER_CONTENT message - extract selected content
async function handleRememberContent(
	message: BackgroundMessage,
	sendResponse: (response: MessageResponse) => void,
): Promise<void> {
	try {
		if (!message.selectedText) {
			throw new Error("No selected text provided");
		}

		// Extract selection metadata
		const selectionMetadata = extractSelection(message.selectedText);

		// Prepare selection data
		const selectionData: ExtractedSelectionData = {
			selectedText: message.selectedText,
			selectionContext: selectionMetadata.selectionContext,
			url: window.location.href,
			title: document.title,
			sourceMetadata: selectionMetadata,
		};

		// Send extracted selection back to background script
		const payload: BackgroundMessage = {
			type: BACKGROUND_EVENTS.SELECTION_EXTRACTED,
			tabId: message.tabId,
			data: selectionData,
		};

		let response: MessageResponse;
		try {
			response = await sendMessageToBackground(payload);
		} catch (err) {
			response = { success: false, error: "No response from background" };
		}

		sendResponse(response);
	} catch (error) {
		sendResponse({
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to extract selection",
		});
	}
}

// Handle LET_REMEMBER message - store context for popup access
function handleLetRemember(
	message: BackgroundMessage,
	sendResponse: (response: MessageResponse) => void,
): void {
	try {
		// Store context data for the popup to access
		storeRememberContext(message.context, message.showTopicSelector);
		sendResponse({ success: true });
	} catch (error) {
		sendResponse({
			success: false,
			error: error instanceof Error ? error.message : "Failed to store context",
		});
	}
}

// Handle SHOW_TOPIC_SELECTOR message - display topic selector UI
function handleShowTopicSelector(
	message: BackgroundMessage,
	sendResponse: (response: MessageResponse) => void,
): void {
	try {
		// Remove any existing selector
		const existingSelector = document.getElementById(
			"memorall-embedded-topic-selector",
		);
		if (existingSelector) {
			existingSelector.remove();
		}

		// Create new topic selector
		createEmbeddedTopicSelector({
			context: message.context || "",
			pageUrl: window.location.href,
			pageTitle: document.title,
			onClose: () => {
				// Cleanup handled by the component itself
			},
		});

		sendResponse({ success: true });
	} catch (error) {
		sendResponse({
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to show topic selector",
		});
	}
}

// Handle SHOW_CHAT_MODAL message - display chat modal UI
async function handleShowChatModal(
	message: BackgroundMessage,
	sendResponse: (response: MessageResponse) => void,
): Promise<void> {
	try {
		// Remove any existing chat modal
		const existingModal = document.getElementById(
			"memorall-embedded-chat-modal",
		);
		if (existingModal) {
			existingModal.remove();
		}

		// Extract context options if requested
		let contextOptions: Array<{
			type: string;
			label: string;
			content: string;
		}> = [];

		if (message.selectedText && message.selectedText.trim()) {
			contextOptions.push({
				type: "selection",
				label: "Selected text",
				content: message.selectedText,
			});
		}

		// 2. Viewport content (visible content)
		try {
			const viewportContent = extractViewportContent();
			if (viewportContent.trim()) {
				contextOptions.push({
					type: "viewport",
					label: "Visible content",
					content: viewportContent,
				});
			}
		} catch (e) {
			// Ignore
		}

		// 3. Viewport HTML structure
		try {
			const viewportHTML = extractViewportHTMLStructure();
			if (viewportHTML.trim()) {
				contextOptions.push({
					type: "viewport_html",
					label: "Visible HTML",
					content: viewportHTML,
				});
			}
		} catch (e) {
			// Ignore
		}

		// 4. Full page content
		try {
			const fullPageData = await extractReadableContent();
			const fullContent =
				fullPageData.textContent ||
				fullPageData.content ||
				document.body.innerText ||
				"";
			if (fullContent.trim()) {
				contextOptions.push({
					type: "full_page",
					label: "Page text",
					content: fullContent,
				});
			} else {
				// Ignore
			}
		} catch (e) {
			// Ignore
			// Fallback: use basic text extraction
			const fallbackText = document.body.innerText || "";
			if (fallbackText.trim()) {
				contextOptions.push({
					type: "full_page",
					label: "Page text",
					content: fallbackText,
				});
			}
		}

		// 5. Full page HTML structure
		try {
			const fullPageHTML = extractFullPageHTMLStructure();
			if (fullPageHTML.trim()) {
				contextOptions.push({
					type: "full_page_html",
					label: "Page HTML",
					content: fullPageHTML,
				});
			}
		} catch (e) {
			// Ignore
		}

		// 6. Viewport screenshot - placeholder, will be captured on demand
		contextOptions.push({
			type: "viewport_screenshot",
			label: "Visible image",
			content: "", // Empty until user clicks to capture
		});

		// 7. Full page screenshot - placeholder, will be captured on demand
		contextOptions.push({
			type: "screenshot",
			label: "Full page image",
			content: "", // Empty until user clicks to capture
		});

		// Create new chat modal
		createEmbeddedChatModal({
			mode: message.mode || "general",
			pageUrl: window.location.href,
			pageTitle: document.title,
			contextOptions,
			onClose: () => {
				// Cleanup handled by the component itself
			},
		});

		sendResponse({ success: true });
	} catch (error) {
		sendResponse({
			success: false,
			error:
				error instanceof Error ? error.message : "Failed to show chat modal",
		});
	}
}

// Handle SHOW_IMAGE_SELECTOR message - display image selection overlay
function handleShowImageSelector(
	message: BackgroundMessage,
	sendResponse: (response: MessageResponse) => void,
): void {
	try {
		// Remove any existing selector
		const existingSelector = document.getElementById(
			"memorall-image-selector-container",
		);
		if (existingSelector) {
			existingSelector.remove();
		}

		// Create image selector with callbacks
		createImageSelectorOverlay(
			async (selectedImageData) => {
				// Remove any existing chat modal
				const existingModal = document.getElementById(
					"memorall-embedded-chat-modal",
				);
				if (existingModal) {
					existingModal.remove();
				}

				// Create context options with the selected image
				const contextOptions = [
					{
						type: "selected_image",
						label: "Selected region",
						content: selectedImageData,
					},
				];

				// Create chat modal with the selected image pre-loaded
				createEmbeddedChatModal({
					mode: "general",
					pageUrl: window.location.href,
					pageTitle: document.title,
					contextOptions,
					onClose: () => {
						// Cleanup handled by the component itself
					},
				});
			},
			() => {
				// On cancel, just cleanup
			},
		);

		sendResponse({ success: true });
	} catch (error) {
		sendResponse({
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to show image selector",
		});
	}
}

// Initialize content script
logInfo("🚀 Memorall content script loaded on:", window.location.href);

// Default export for Extension.js development mode
export default function main() {
	// Return cleanup function
	return () => {
		// Remove message listener
		chrome.runtime.onMessage.removeListener(messageListener);
		logInfo("🧹 Memorall content script cleaned up");
	};
}
