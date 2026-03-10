import type { JobNotificationMessage } from "@/services/background-jobs/bridges/types";

// ── Job notification relay ────────────────────────────────────────────────────
// The ONLY relay needed in the architecture: forward job notifications that target
// content scripts, since chrome.runtime.sendMessage() cannot reach them directly.

export async function relayJobNotificationToContent(
	message: JobNotificationMessage,
	senderTabId: number | undefined,
): Promise<void> {
	// Specific tab target
	if (message.target === "content" && (message.tabId ?? senderTabId)) {
		const tabId = (message.tabId ?? senderTabId)!;
		await chrome.tabs.sendMessage(tabId, message).catch(() => {
			// Tab may not have content script — silently ignore
		});
		return;
	}

	// Broadcast to all eligible tabs
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
