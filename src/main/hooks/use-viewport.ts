import { useSyncExternalStore } from "react";
import { RUNTIME_PANEL_BREAKPOINT } from "@/utils/dom";

const getServerSnapshot = () => false;

export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onStoreChange) => {
			if (typeof window === "undefined") return () => {};
			const mediaQuery = window.matchMedia(query);
			mediaQuery.addEventListener("change", onStoreChange);
			return () => mediaQuery.removeEventListener("change", onStoreChange);
		},
		() => {
			if (typeof window === "undefined") return false;
			return window.matchMedia(query).matches;
		},
		getServerSnapshot,
	);
}

export function useIsWideViewport(): boolean {
	return useMediaQuery(`(min-width: ${RUNTIME_PANEL_BREAKPOINT}px)`);
}
