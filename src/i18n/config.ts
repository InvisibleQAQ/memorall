/**
 * i18n Configuration
 * Initializes i18next with language detection and resources
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files
import enCommon from "./locales/en/common.json";
import enChat from "./locales/en/chat.json";
import enDocuments from "./locales/en/documents.json";
import enKnowledge from "./locales/en/knowledge.json";
import enLLM from "./locales/en/llm.json";
import enDatabase from "./locales/en/database.json";
import enEmbedding from "./locales/en/embedding.json";
import enLogs from "./locales/en/logs.json";

import vnCommon from "./locales/vn/common.json";
import vnChat from "./locales/vn/chat.json";
import vnDocuments from "./locales/vn/documents.json";
import vnKnowledge from "./locales/vn/knowledge.json";
import vnLLM from "./locales/vn/llm.json";
import vnDatabase from "./locales/vn/database.json";
import vnEmbedding from "./locales/vn/embedding.json";
import vnLogs from "./locales/vn/logs.json";

// Translation resources
const resources = {
	en: {
		common: enCommon,
		chat: enChat,
		documents: enDocuments,
		knowledge: enKnowledge,
		llm: enLLM,
		database: enDatabase,
		embedding: enEmbedding,
		logs: enLogs,
	},
	vn: {
		common: vnCommon,
		chat: vnChat,
		documents: vnDocuments,
		knowledge: vnKnowledge,
		llm: vnLLM,
		database: vnDatabase,
		embedding: vnEmbedding,
		logs: vnLogs,
	},
} as const;

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		defaultNS: "common",
		fallbackLng: "en",
		supportedLngs: ["en", "vn"],
		interpolation: {
			escapeValue: false, // React already escapes
		},
		detection: {
			order: ["localStorage", "navigator"],
			caches: ["localStorage"],
			lookupLocalStorage: "i18nextLng",
		},
	});

export default i18n;
