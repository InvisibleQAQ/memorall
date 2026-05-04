import { useCallback, useEffect, useState } from "react";
import { logError } from "@/utils/logger";
import type { EmbeddedChatDisplayMode } from "@/embedded/types";

const EMBEDDED_CHAT_DISPLAY_MODE_STORAGE_KEY =
	"memorallEmbeddedChatDisplayMode";

const isEmbeddedChatDisplayMode = (
	value: unknown,
): value is EmbeddedChatDisplayMode => value === "panel" || value === "popup";

export const useEmbeddedChatDisplayMode = (
	displayMode?: EmbeddedChatDisplayMode,
) => {
	const [currentDisplayMode, setCurrentDisplayMode] =
		useState<EmbeddedChatDisplayMode>(displayMode ?? "panel");

	useEffect(() => {
		let isMounted = true;

		if (displayMode) {
			setCurrentDisplayMode(displayMode);
			void chrome.storage.local.set({
				[EMBEDDED_CHAT_DISPLAY_MODE_STORAGE_KEY]: displayMode,
			});
			return () => {
				isMounted = false;
			};
		}

		void chrome.storage.local
			.get(EMBEDDED_CHAT_DISPLAY_MODE_STORAGE_KEY)
			.then((result) => {
				if (!isMounted) {
					return;
				}

				const storedMode = result[EMBEDDED_CHAT_DISPLAY_MODE_STORAGE_KEY];
				if (isEmbeddedChatDisplayMode(storedMode)) {
					setCurrentDisplayMode(storedMode);
				}
			})
			.catch((error) => {
				logError("[EmbeddedChat] Failed to load display mode", error);
			});

		return () => {
			isMounted = false;
		};
	}, [displayMode]);

	const toggleDisplayMode = useCallback(() => {
		setCurrentDisplayMode((previousMode) => {
			const nextMode = previousMode === "panel" ? "popup" : "panel";
			void chrome.storage.local
				.set({
					[EMBEDDED_CHAT_DISPLAY_MODE_STORAGE_KEY]: nextMode,
				})
				.catch((error) => {
					logError("[EmbeddedChat] Failed to save display mode", error);
				});
			return nextMode;
		});
	}, []);

	return {
		currentDisplayMode,
		toggleDisplayMode,
	};
};
