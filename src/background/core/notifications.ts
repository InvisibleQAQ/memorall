import { logInfo, logError } from "@/utils/logger";

export function createNotification(title: string, message: string): void {
	chrome.notifications?.create({
		type: "basic" as const,
		title,
		message,
		iconUrl: chrome.runtime.getURL("icons/extension_48.png"),
	});
}

export async function openExtensionPopup(): Promise<void> {
	try {
		await chrome.action.openPopup();
		logInfo("🪟 Opened action popup");
	} catch (error) {
		const lastError = chrome.runtime?.lastError?.message;
		logError("❌ Failed to open action popup:", lastError ?? error);
		// Cannot open popup programmatically without a user gesture — inform user instead.
		createNotification(
			"Memorall",
			"Click the Memorall toolbar icon to open the popup.",
		);
	}
}
