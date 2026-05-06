import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LANGUAGE, type Language } from "@/constants/language";
import {
	EMBEDDED_TRANSLATIONS,
	loadLanguageFromStorage,
	type EmbeddedLocale,
} from "@/embedded/i18n/config";

export const useEmbeddedLanguage = (): Language => {
	const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

	useEffect(() => {
		let cancelled = false;
		void loadLanguageFromStorage().then((loadedLanguage) => {
			if (!cancelled) setLanguage(loadedLanguage);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return language;
};

export const getEmbeddedTranslation = <Scope extends keyof EmbeddedLocale>(
	scope: Scope,
): EmbeddedLocale[Scope] => {
	const language = useEmbeddedLanguage();
	return EMBEDDED_TRANSLATIONS[language][scope];
};

type TranslationValue = string | number;
type TranslationValues = Record<string, TranslationValue>;
type StringKeys<T> = {
	[Key in keyof T]: T[Key] extends string ? Key : never;
}[keyof T] &
	string;

export const formatEmbeddedTranslation = (
	template: string,
	values?: TranslationValues,
): string => {
	if (!values) return template;
	return template.replace(/\{(\w+)\}/g, (match, key) =>
		Object.prototype.hasOwnProperty.call(values, key)
			? String(values[key])
			: match,
	);
};

export const useEmbeddedTranslation = <Scope extends keyof EmbeddedLocale>(
	scope: Scope,
) => {
	const translations = getEmbeddedTranslation(scope);
	return useCallback(
		<Key extends StringKeys<EmbeddedLocale[Scope]>>(
			key: Key,
			values?: TranslationValues,
		) => formatEmbeddedTranslation(translations[key] as string, values),
		[translations],
	);
};
