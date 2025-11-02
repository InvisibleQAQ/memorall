import {
	DEFAULT_LANGUAGE,
	LANGUAGE_STORAGE_KEY,
	type Language,
} from "@/constants/language";

// Helper function to load language from storage
export async function loadLanguageFromStorage(): Promise<Language> {
	try {
		const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
		const savedLanguage = result[LANGUAGE_STORAGE_KEY];

		if (savedLanguage && (savedLanguage === "en" || savedLanguage === "vn")) {
			return savedLanguage;
		}
	} catch (error) {
		console.error("Failed to load language:", error);
	}
	return DEFAULT_LANGUAGE;
}
