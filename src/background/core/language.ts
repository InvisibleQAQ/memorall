import { logInfo, logError } from "@/utils/logger";
import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "@/constants/language";
import type { Language } from "@/constants/language";

let currentLanguage: Language = DEFAULT_LANGUAGE;

export function getCurrentLanguage(): Language {
	return currentLanguage;
}

export async function loadCurrentLanguage(): Promise<void> {
	try {
		const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
		const saved = result[LANGUAGE_STORAGE_KEY];

		if (saved === "en" || saved === "vn") {
			currentLanguage = saved;
			logInfo(`📝 Loaded language: ${currentLanguage}`);
		} else {
			currentLanguage = "en";
			logInfo("📝 Using default language: en");
		}
	} catch (error) {
		logError("❌ Failed to load language:", error);
		currentLanguage = "en";
	}
}

export function listenForLanguageChanges(
	onChange: (language: Language) => void,
): void {
	chrome.storage.onChanged.addListener((changes, namespace) => {
		if (namespace !== "local" || !changes[LANGUAGE_STORAGE_KEY]) return;

		const next = changes[LANGUAGE_STORAGE_KEY].newValue;
		if (next === "en" || next === "vn") {
			currentLanguage = next;
			logInfo(`🔄 Language changed to: ${currentLanguage}`);
			onChange(next);
		}
	});
}
