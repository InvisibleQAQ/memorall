export const RUNTIME_PANEL_BREAKPOINT = 700;

export function isPopupSurface(): boolean {
	return window.location.href.includes("popup.html");
}

export async function waitForDOMReady(): Promise<void> {
	return new Promise<void>((resolve) => {
		if (typeof document === "undefined") {
			// If document is not available at all, resolve immediately
			// This allows the class to work in non-DOM environments
			resolve();
			return;
		}

		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => resolve());
		} else {
			// DOM is already ready
			resolve();
		}
	});
}
