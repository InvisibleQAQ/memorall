/**
 * Language Hook
 * Custom hook for managing language switching with chrome storage sync
 */

import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { logInfo, logError } from "@/utils/logger";
import { LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE } from "@/constants/language";
import type { Language } from "@/constants/language";

export type { Language };

/**
 * Hook for managing language with chrome storage sync
 */
export function useLanguage() {
	const { i18n } = useTranslation();

	// Load language from chrome.storage on mount
	useEffect(() => {
		const loadLanguage = async () => {
			try {
				const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
				const savedLanguage = result[LANGUAGE_STORAGE_KEY];

				if (
					savedLanguage &&
					(savedLanguage === "en" || savedLanguage === "vn")
				) {
					if (i18n.language !== savedLanguage) {
						await i18n.changeLanguage(savedLanguage);
						logInfo(`Language loaded from storage: ${savedLanguage}`);
					}
				} else {
					// Set default language if none saved
					await chrome.storage.local.set({
						[LANGUAGE_STORAGE_KEY]: DEFAULT_LANGUAGE,
					});
				}
			} catch (error) {
				logError("Failed to load language from storage:", error);
			}
		};

		loadLanguage();
	}, [i18n]);

	// Listen for language changes from other contexts
	useEffect(() => {
		const handleStorageChange = (
			changes: { [key: string]: chrome.storage.StorageChange },
			areaName: string,
		) => {
			if (areaName === "local" && changes[LANGUAGE_STORAGE_KEY]) {
				const newLanguage = changes[LANGUAGE_STORAGE_KEY].newValue as string;
				if (newLanguage && i18n.language !== newLanguage) {
					i18n.changeLanguage(newLanguage);
					logInfo(`Language changed from storage: ${newLanguage}`);
				}
			}
		};

		chrome.storage.onChanged.addListener(handleStorageChange);

		return () => {
			chrome.storage.onChanged.removeListener(handleStorageChange);
		};
	}, [i18n]);

	// Change language and save to storage
	const changeLanguage = useCallback(
		async (lang: Language) => {
			try {
				await i18n.changeLanguage(lang);
				await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: lang });
				logInfo(`Language changed to: ${lang}`);
			} catch (error) {
				logError("Failed to change language:", error);
			}
		},
		[i18n],
	);

	return {
		language: i18n.language as Language,
		changeLanguage,
		isEnglish: i18n.language === "en",
		isVietnamese: i18n.language === "vn",
	};
}
