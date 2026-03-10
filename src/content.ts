// Content script for Memorall extension
// Uses modular embedded components structure

import { BACKGROUND_EVENTS } from "./constants/events";
import { isJobNotificationMessage } from "./services/background-jobs/bridges/types";
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
import {
	WEB_CONTENT_COMMAND_SOURCE,
	isWebContentCommandRequest,
	type WebContentCommandRequest,
	type WebContentCommandResponse,
	type WebDomActionName,
	type WebDomElementInfo,
	type WebElementRecord,
} from "@/services/flows/tools/web/web-browser-protocol";
import { logInfo } from "./utils/logger";

// Track mouse position for UI positioning
let lastMouseX = 0;
let lastMouseY = 0;

const buildWebSnapshot = () => ({
	url: window.location.href,
	title: document.title || "",
	html: document.documentElement?.outerHTML || document.body?.innerHTML || "",
	text: document.body?.innerText || document.documentElement?.textContent || "",
	domAccessible: true,
});

const isElementVisible = (element: Element): boolean => {
	if (!(element instanceof HTMLElement)) {
		return true;
	}
	if (element.hidden) {
		return false;
	}
	const style = window.getComputedStyle(element);
	if (style.display === "none" || style.visibility === "hidden") {
		return false;
	}
	return Boolean(
		element.offsetWidth ||
			element.offsetHeight ||
			element.getClientRects().length,
	);
};

const acceptsTextInput = (element: Element): boolean => {
	if (element instanceof HTMLTextAreaElement) {
		return true;
	}
	if (!(element instanceof HTMLInputElement)) {
		return false;
	}
	const inputType = (element.type || "text").toLowerCase();
	return [
		"",
		"text",
		"search",
		"email",
		"url",
		"tel",
		"password",
		"number",
		"date",
		"datetime-local",
		"month",
		"time",
		"week",
	].includes(inputType);
};

const createDomElementInfo = (
	element: Element,
	index: number,
): WebDomElementInfo => ({
	index,
	tagName: element.tagName.toLowerCase(),
	id: element.getAttribute("id"),
	name: element.getAttribute("name"),
	type: element.getAttribute("type"),
	placeholder: element.getAttribute("placeholder"),
	ariaLabel:
		element.getAttribute("aria-label") ||
		element.getAttribute("aria-labelledby"),
	title: element.getAttribute("title"),
	role: element.getAttribute("role"),
	text: (element.textContent ?? "").trim(),
	value:
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLSelectElement
			? element.value
			: null,
	href:
		element instanceof HTMLAnchorElement ||
		element instanceof HTMLAreaElement ||
		element instanceof HTMLLinkElement
			? element.getAttribute("href")
			: null,
	disabled:
		(element instanceof HTMLInputElement ||
			element instanceof HTMLTextAreaElement ||
			element instanceof HTMLSelectElement ||
			element instanceof HTMLButtonElement) &&
		element.disabled,
	visible: isElementVisible(element),
	acceptsTextInput: acceptsTextInput(element),
});

const createElementRecord = (element: Element): WebElementRecord => ({
	label: element.tagName.toLowerCase(),
	text: element.textContent ?? "",
	value:
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLSelectElement
			? element.value
			: null,
});

const getIndexedElement = (selector: string, index: number): Element => {
	const nodeList = document.querySelectorAll(selector);
	const node = nodeList.item(index);
	if (!node) {
		throw new Error(`No element at index ${index} for selector: ${selector}`);
	}
	if (!(node instanceof Element)) {
		throw new Error("Matched node is not a valid Element.");
	}
	return node;
};

const assertTextInputTarget = (element: Element): void => {
	if (element instanceof HTMLTextAreaElement) {
		return;
	}
	if (!(element instanceof HTMLInputElement)) {
		throw new Error("Target element does not support text input.");
	}
	const inputType = (element.type || "text").toLowerCase();
	if (!acceptsTextInput(element)) {
		throw new Error(
			`Target element is input[type=${inputType}] and does not support text input. Query again and choose a visible element with acceptsTextInput=true.`,
		);
	}
};

const executeDomAction = (
	action: WebDomActionName,
	request: Extract<WebContentCommandRequest, { type: "web-tool:dom-action" }>,
): WebElementRecord => {
	const element = getIndexedElement(request.selector, request.index ?? 0);

	if (action === "focus") {
		(element as HTMLElement).focus();
		return createElementRecord(element);
	}

	if (action === "scrollBottom") {
		window.scrollTo({
			top: document.body?.scrollHeight ?? 0,
			left: 0,
			behavior: "smooth",
		});
		return createElementRecord(element);
	}

	if (action === "scrollTop") {
		window.scrollTo({
			top: 0,
			left: 0,
			behavior: "smooth",
		});
		return createElementRecord(element);
	}

	if (action === "read") {
		return createElementRecord(element);
	}

	if (action === "click") {
		if (typeof (element as HTMLElement).click !== "function") {
			throw new Error("Target element does not support click.");
		}
		(element as HTMLElement).click();
		return createElementRecord(element);
	}

	if (action === "input") {
		assertTextInputTarget(element);
		const inputValue = request.value ?? "";
		element.focus();
		if (
			element instanceof HTMLInputElement ||
			element instanceof HTMLTextAreaElement
		) {
			element.value = inputValue;
			element.dispatchEvent(new Event("input", { bubbles: true }));
			element.dispatchEvent(new Event("change", { bubbles: true }));
		}
		return {
			label: element.tagName.toLowerCase(),
			text:
				element instanceof HTMLInputElement ||
				element instanceof HTMLTextAreaElement
					? element.value
					: "",
			value: inputValue,
		};
	}

	throw new Error(`Unsupported dom action: ${action}`);
};

const createWebContentErrorResponse = (
	request: WebContentCommandRequest,
	error: unknown,
): WebContentCommandResponse => ({
	source: WEB_CONTENT_COMMAND_SOURCE,
	type:
		request.type === "web-tool:snapshot"
			? "web-tool:snapshot-result"
			: request.type === "web-tool:dom-query"
				? "web-tool:dom-query-result"
				: request.type === "web-tool:dom-action"
					? "web-tool:dom-action-result"
					: "web-tool:wait-selector-result",
	success: false,
	error: error instanceof Error ? error.message : String(error),
});

const handleWebContentCommand = async (
	request: WebContentCommandRequest,
): Promise<WebContentCommandResponse> => {
	try {
		switch (request.type) {
			case "web-tool:snapshot":
				return {
					source: WEB_CONTENT_COMMAND_SOURCE,
					type: "web-tool:snapshot-result",
					success: true,
					snapshot: buildWebSnapshot(),
				};

			case "web-tool:dom-query": {
				const elements = Array.from(document.querySelectorAll(request.selector))
					.filter((node): node is Element => node instanceof Element)
					.slice(0, request.maxResults)
					.map((element, index) => createDomElementInfo(element, index));

				return {
					source: WEB_CONTENT_COMMAND_SOURCE,
					type: "web-tool:dom-query-result",
					success: true,
					snapshot: buildWebSnapshot(),
					elements,
				};
			}

			case "web-tool:dom-action": {
				const result = executeDomAction(request.action, request);
				return {
					source: WEB_CONTENT_COMMAND_SOURCE,
					type: "web-tool:dom-action-result",
					success: true,
					snapshot: buildWebSnapshot(),
					result,
				};
			}

			case "web-tool:wait-selector": {
				const start = Date.now();
				const expectPresent = request.state === "present";
				while (true) {
					const matched = Boolean(document.querySelector(request.selector));
					if ((expectPresent && matched) || (!expectPresent && !matched)) {
						return {
							source: WEB_CONTENT_COMMAND_SOURCE,
							type: "web-tool:wait-selector-result",
							success: true,
							snapshot: buildWebSnapshot(),
							matched: true,
						};
					}

					if (Date.now() - start >= request.timeoutMs) {
						return {
							source: WEB_CONTENT_COMMAND_SOURCE,
							type: "web-tool:wait-selector-result",
							success: true,
							snapshot: buildWebSnapshot(),
							matched: false,
						};
					}

					await new Promise((resolve) =>
						window.setTimeout(resolve, request.intervalMs),
					);
				}
			}
		}
	} catch (error) {
		return createWebContentErrorResponse(request, error);
	}
};

// Track mouse position for context menu positioning
document.addEventListener("contextmenu", (e) => {
	lastMouseX = e.clientX;
	lastMouseY = e.clientY;
});

// Message listener handler
const messageListener = (
	rawMessage: unknown,
	_sender: chrome.runtime.MessageSender,
	sendResponse: (response: MessageResponse | WebContentCommandResponse) => void,
): boolean => {
	// Job notifications (relayed by background via chrome.tabs.sendMessage) are
	// handled by ChromeRuntimeBridge's own onMessage listener. Return false so
	// Chrome closes the channel immediately — no "Unknown message type" noise.
	if (isJobNotificationMessage(rawMessage)) return false;

	if (isWebContentCommandRequest(rawMessage)) {
		void handleWebContentCommand(rawMessage).then(sendResponse);
		return true;
	}

	const message = rawMessage as BackgroundMessage;

	// All handlers call sendResponse internally (sync or async).
	// Returning true synchronously is the correct way to keep the Chrome
	// message channel open for an async response.
	switch (message.type) {
		case "web-tool:tab-capture":
			sendResponse({
				success: true,
				url: window.location.href,
				title: document.title || "",
				html:
					document.documentElement?.outerHTML || document.body?.innerHTML || "",
				text:
					document.body?.innerText ||
					document.documentElement?.textContent ||
					"",
			} as MessageResponse);
			return true;

		case BACKGROUND_EVENTS.REMEMBER_THIS:
			void handleRememberThis(message, sendResponse);
			return true;

		case BACKGROUND_EVENTS.REMEMBER_CONTENT:
			void handleRememberContent(message, sendResponse);
			return true;

		case BACKGROUND_EVENTS.LET_REMEMBER:
			handleLetRemember(message, sendResponse);
			return true;

		case BACKGROUND_EVENTS.SHOW_TOPIC_SELECTOR:
			handleShowTopicSelector(message, sendResponse);
			return true;

		case BACKGROUND_EVENTS.SHOW_CHAT_MODAL:
			void handleShowChatModal(message, sendResponse);
			return true;

		case BACKGROUND_EVENTS.SHOW_IMAGE_SELECTOR:
			handleShowImageSelector(message, sendResponse);
			return true;

		default:
			sendResponse({ success: false, error: "Unknown message type" });
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
