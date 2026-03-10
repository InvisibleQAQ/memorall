import { logInfo, logError } from "@/utils/logger";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { activityTrackingManager } from "@/background/activity-tracking-manager";
import { BACKGROUND_EVENTS } from "@/constants/events";
import {
	isJobNotificationMessage,
	type JobNotificationMessage,
} from "@/services/background-jobs/bridges/types";
import { openExtensionPopup } from "@/background/core/notifications";
import { relayJobNotificationToContent } from "./relay";

// ── Individual handlers ───────────────────────────────────────────────────────

type SendResponse = (response?: unknown) => void;

function handleActivityCaptured(
	message: Record<string, unknown>,
	senderTabId: number | undefined,
	sendResponse: SendResponse,
): true {
	(async () => {
		try {
			if (!senderTabId) {
				sendResponse({ success: false, error: "No tab ID" });
				return;
			}
			if (typeof message.activityType !== "string") {
				sendResponse({ success: false, error: "Invalid activity type" });
				return;
			}
			await activityTrackingManager.handleActivityFromContent(
				message.activityType,
				message.data,
				senderTabId,
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
}

function handleGetTopicsForSelector(sendResponse: SendResponse): true {
	(async () => {
		try {
			const response = await backgroundJob.execute(
				"get-topics",
				{},
				{ stream: false },
			);

			if ("promise" in response) {
				const result = await response.promise;
				const existingTopics = result?.result?.topics ?? [];
				const topicsWithDefault = [
					{
						id: "default",
						name: "Default",
						description: "Save to default location",
					},
					...existingTopics,
				];
				sendResponse({ success: true, topics: topicsWithDefault });
			}
		} catch (error) {
			logError("❌ Failed to get topics for selector:", error);
			sendResponse({
				success: false,
				error: error instanceof Error ? error.message : "Failed to load topics",
			});
		}
	})();
	return true;
}

function handleOpenFullPage(sendResponse: SendResponse): true {
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
}

function handleOpenSavePage(sendResponse: SendResponse): true {
	try {
		chrome.storage?.session?.set?.({ navigateTo: "documents" });
		void openExtensionPopup();
		sendResponse({ success: true });
	} catch (error) {
		logError("❌ Failed to open documents page:", error);
		sendResponse({ success: false, error: "Failed to open documents page" });
	}
	return true;
}

function handleSaveContentWithTopic(
	message: Record<string, unknown>,
	senderTabId: number | undefined,
	sendResponse: SendResponse,
): true {
	(async () => {
		try {
			logInfo("🔍 Background received topicId:", message.topicId);

			if (!senderTabId) {
				sendResponse({ success: false, error: "No active tab" });
				return;
			}

			const extractionResponse = await chrome.tabs.sendMessage(senderTabId, {
				type: BACKGROUND_EVENTS.REMEMBER_THIS,
				tabId: senderTabId,
				topicId: message.topicId,
			});

			sendResponse(
				extractionResponse?.success
					? { success: true }
					: { success: false, error: "Failed to extract page content" },
			);
		} catch (error) {
			logError("❌ Failed to save content with topic:", error);
			sendResponse({
				success: false,
				error: "Failed to save content with topic",
			});
		}
	})();
	return true;
}

function handleContentExtracted(
	message: Record<string, unknown>,
	sendResponse: SendResponse,
): true {
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
			const errorMsg =
				error instanceof Error ? error.message : "Failed to save content";
			logInfo("📨 Sending error response to content script:", errorMsg);
			sendResponse({ success: false, error: errorMsg });
		}
	})();
	return true;
}

function handleFilesystemChanged(message: Record<string, unknown>): false {
	if (message.relayedByBackground === true) return false;

	const sourceContextId =
		typeof message.sourceContextId === "string"
			? message.sourceContextId
			: undefined;
	const eventId =
		typeof message.eventId === "string" ? message.eventId : undefined;

	logInfo("🔁 Relaying FILESYSTEM_CHANGED to all contexts");

	chrome.runtime
		.sendMessage({
			type: BACKGROUND_EVENTS.FILESYSTEM_CHANGED,
			sourceContextId,
			eventId,
			relayedByBackground: true,
		})
		.catch((err: Error) => {
			if (
				!err.message?.includes("Receiving end does not exist") &&
				!err.message?.includes("Could not establish connection")
			) {
				logError("Failed to relay FILESYSTEM_CHANGED:", err);
			}
		});

	return false;
}

// ── Listener registration ─────────────────────────────────────────────────────

export function registerMessageHandler(onPopupOpened: () => void): void {
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		// Job notification relay — must come first
		if (isJobNotificationMessage(message)) {
			if (message.target === "content" || message.target === "all") {
				void relayJobNotificationToContent(
					message as JobNotificationMessage,
					sender.tab?.id,
				);
			}
			return false;
		}

		const msg = message as Record<string, unknown>;
		const type = msg.type;

		if (type === BACKGROUND_EVENTS.POPUP_OPENED) {
			logInfo("🪟 Popup opened");
			onPopupOpened();
			return false;
		}

		if (type === BACKGROUND_EVENTS.ACTIVITY_CAPTURED)
			return handleActivityCaptured(msg, sender.tab?.id, sendResponse);

		if (type === BACKGROUND_EVENTS.GET_TOPICS_FOR_SELECTOR)
			return handleGetTopicsForSelector(sendResponse);

		if (type === BACKGROUND_EVENTS.OPEN_FULL_PAGE)
			return handleOpenFullPage(sendResponse);

		if (type === BACKGROUND_EVENTS.OPEN_SAVE_PAGE)
			return handleOpenSavePage(sendResponse);

		if (type === BACKGROUND_EVENTS.SAVE_CONTENT_WITH_TOPIC)
			return handleSaveContentWithTopic(msg, sender.tab?.id, sendResponse);

		if (type === BACKGROUND_EVENTS.CONTENT_EXTRACTED)
			return handleContentExtracted(msg, sendResponse);

		if (type === BACKGROUND_EVENTS.FILESYSTEM_CHANGED)
			return handleFilesystemChanged(msg);
	});
}
