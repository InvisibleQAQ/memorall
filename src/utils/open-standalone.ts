import { logError, logInfo } from "@/utils/logger";

/**
 * Opens the standalone page using the preferred Chrome extension API.
 * Uses openOptionsPage() first; falls back to focusing an existing tab or
 * creating a new one (mirrors the context-menu handler logic).
 */
export const openStandalonePage = async (): Promise<void> => {
	try {
		await chrome.runtime.openOptionsPage();
		logInfo("🪟 Standalone opened via openOptionsPage()");
	} catch (err) {
		logError("⚠️ openOptionsPage failed, falling back to tab:", err);
		const optionsUrl = chrome.runtime.getURL("standalone.html");
		const existing = await chrome.tabs.query({ url: optionsUrl });
		if (existing.length > 0 && existing[0].id != null) {
			await chrome.tabs.update(existing[0].id, { active: true });
			await chrome.windows.update(existing[0].windowId!, { focused: true });
		} else {
			await chrome.tabs.create({ url: optionsUrl, active: true });
		}
	}
};
