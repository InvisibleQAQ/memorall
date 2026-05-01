import React from "react";

const PANEL_STORAGE_KEY = "memorall.agents.workspace-panels.v3";
const DEFAULT_PANEL_SIZES = [22, 78] as const;
const MIN_PANEL_SIZES = [16, 36] as const;
const DESKTOP_BREAKPOINT = 1180;

export const DESKTOP_SEPARATOR_TRACK = 2;

const clampPair = (
	nextPrimary: number,
	total: number,
	minPrimary: number,
	minSecondary: number,
): [number, number] => {
	const clampedPrimary = Math.min(
		total - minSecondary,
		Math.max(minPrimary, nextPrimary),
	);
	return [clampedPrimary, total - clampedPrimary];
};

const readStoredPanelSizes = (): [number, number] => {
	if (typeof window === "undefined") return [...DEFAULT_PANEL_SIZES];
	try {
		const raw = window.localStorage.getItem(PANEL_STORAGE_KEY);
		if (!raw) return [...DEFAULT_PANEL_SIZES];
		const parsed = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.length === 2 &&
			parsed.every((value) => typeof value === "number")
		) {
			return [parsed[0], parsed[1]];
		}
	} catch {
		// Fall back to defaults when localStorage is unavailable or corrupt.
	}
	return [...DEFAULT_PANEL_SIZES];
};

export const useAgentsWorkspacePanels = () => {
	const [panelSizes, setPanelSizes] =
		React.useState<[number, number]>(readStoredPanelSizes);
	const [isDesktop, setIsDesktop] = React.useState(false);
	const containerRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const handleViewportChange = () => {
			const isPopupSurface =
				document.documentElement.dataset.uiSurface === "popup";
			setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT && !isPopupSurface);
		};
		handleViewportChange();
		window.addEventListener("resize", handleViewportChange);
		return () => window.removeEventListener("resize", handleViewportChange);
	}, []);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panelSizes));
	}, [panelSizes]);

	const handleResizeStart = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!isDesktop || !containerRef.current) return;
			event.preventDefault();
			const startX = event.clientX;
			const startSizes = panelSizes;
			const containerWidth = containerRef.current.getBoundingClientRect().width;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			const handlePointerMove = (pointerEvent: MouseEvent) => {
				const deltaInFr =
					((pointerEvent.clientX - startX) / containerWidth) *
					(startSizes[0] + startSizes[1]);
				setPanelSizes(() => {
					const [left, right] = clampPair(
						startSizes[0] + deltaInFr,
						startSizes[0] + startSizes[1],
						MIN_PANEL_SIZES[0],
						MIN_PANEL_SIZES[1],
					);
					return [left, right];
				});
			};
			const handlePointerUp = () => {
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				window.removeEventListener("mousemove", handlePointerMove);
				window.removeEventListener("mouseup", handlePointerUp);
			};
			window.addEventListener("mousemove", handlePointerMove);
			window.addEventListener("mouseup", handlePointerUp);
		},
		[isDesktop, panelSizes],
	);

	return {
		containerRef,
		handleResizeStart,
		isDesktop,
		panelSizes,
	};
};
