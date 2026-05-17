import React from "react";

export const DEFAULT_WORKSPACE_PANEL_SIZES = [22, 78] as const;
export const DEFAULT_WORKSPACE_MIN_PANEL_SIZES = [16, 36] as const;
export const DEFAULT_WORKSPACE_SPLIT_BREAKPOINT = 480;
export const DEFAULT_WORKSPACE_COLLAPSE_BREAKPOINT = 1180;
export const DEFAULT_WORKSPACE_SEPARATOR_TRACK = 2;
export const DEFAULT_COLLAPSED_WORKSPACE_SIDEBAR_WIDTH = "52px";
export const DEFAULT_COMPACT_WORKSPACE_SIDEBAR_WIDTH = "380px";
export const DEFAULT_WORKSPACE_SIDEBAR_MIN_WIDTH = "280px";

interface UseResponsiveWorkspacePanelsOptions {
	storageKey: string;
	defaultPanelSizes?: readonly [number, number];
	minPanelSizes?: readonly [number, number];
	splitBreakpoint?: number;
	collapseBreakpoint?: number;
	collapsedSidebarWidth?: string;
	compactSidebarWidth?: string;
	sidebarMinWidth?: string;
}

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

const readStoredPanelSizes = (
	storageKey: string,
	defaultPanelSizes: readonly [number, number],
): [number, number] => {
	if (typeof window === "undefined") return [...defaultPanelSizes];
	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) return [...defaultPanelSizes];
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
	return [...defaultPanelSizes];
};

export const useResponsiveWorkspacePanels = ({
	storageKey,
	defaultPanelSizes = DEFAULT_WORKSPACE_PANEL_SIZES,
	minPanelSizes = DEFAULT_WORKSPACE_MIN_PANEL_SIZES,
	splitBreakpoint = DEFAULT_WORKSPACE_SPLIT_BREAKPOINT,
	collapseBreakpoint = DEFAULT_WORKSPACE_COLLAPSE_BREAKPOINT,
	collapsedSidebarWidth = DEFAULT_COLLAPSED_WORKSPACE_SIDEBAR_WIDTH,
	compactSidebarWidth = DEFAULT_COMPACT_WORKSPACE_SIDEBAR_WIDTH,
	sidebarMinWidth = DEFAULT_WORKSPACE_SIDEBAR_MIN_WIDTH,
}: UseResponsiveWorkspacePanelsOptions) => {
	const [panelSizes, setPanelSizes] = React.useState<[number, number]>(() =>
		readStoredPanelSizes(storageKey, defaultPanelSizes),
	);
	const [isSplitLayout, setIsSplitLayout] = React.useState(false);
	const [isCompactSplitLayout, setIsCompactSplitLayout] = React.useState(false);
	const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
	const [hasManualSidebarToggle, setHasManualSidebarToggle] =
		React.useState(false);
	const containerRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		const updateLayoutMode = (availableWidth: number) => {
			const isPopupSurface =
				document.documentElement.dataset.uiSurface === "popup";
			const nextIsSplitLayout =
				availableWidth >= splitBreakpoint && !isPopupSurface;
			const nextIsCompactSplitLayout =
				nextIsSplitLayout && availableWidth < collapseBreakpoint;
			setIsSplitLayout(nextIsSplitLayout);
			setIsCompactSplitLayout(nextIsCompactSplitLayout);
			if (!hasManualSidebarToggle) {
				setIsSidebarCollapsed(nextIsCompactSplitLayout);
			}
		};

		const getAvailableWidth = () =>
			containerRef.current?.getBoundingClientRect().width ?? window.innerWidth;

		const handleViewportChange = () => {
			updateLayoutMode(getAvailableWidth());
		};

		handleViewportChange();
		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver((entries) => {
						const width = entries[0]?.contentRect.width ?? getAvailableWidth();
						updateLayoutMode(width);
					});

		if (containerRef.current) {
			resizeObserver?.observe(containerRef.current);
		}
		window.addEventListener("resize", handleViewportChange);
		return () => {
			resizeObserver?.disconnect();
			window.removeEventListener("resize", handleViewportChange);
		};
	}, [collapseBreakpoint, hasManualSidebarToggle, splitBreakpoint]);

	React.useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(storageKey, JSON.stringify(panelSizes));
	}, [panelSizes, storageKey]);

	const collapseSidebar = React.useCallback(() => {
		setHasManualSidebarToggle(true);
		setIsSidebarCollapsed(true);
	}, []);

	const expandSidebar = React.useCallback(() => {
		setHasManualSidebarToggle(true);
		setIsSidebarCollapsed(false);
	}, []);

	const gridTemplateColumns = React.useMemo(() => {
		if (isSidebarCollapsed || isCompactSplitLayout) {
			return `${collapsedSidebarWidth} minmax(0, 1fr)`;
		}
		return `minmax(${sidebarMinWidth}, ${panelSizes[0]}fr) ${DEFAULT_WORKSPACE_SEPARATOR_TRACK}px minmax(0, ${panelSizes[1]}fr)`;
	}, [
		collapsedSidebarWidth,
		isCompactSplitLayout,
		isSidebarCollapsed,
		panelSizes,
		sidebarMinWidth,
	]);

	const handleResizeStart = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (
				!isSplitLayout ||
				!containerRef.current ||
				isSidebarCollapsed ||
				isCompactSplitLayout
			)
				return;
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
						minPanelSizes[0],
						minPanelSizes[1],
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
		[
			isCompactSplitLayout,
			isSidebarCollapsed,
			isSplitLayout,
			minPanelSizes,
			panelSizes,
		],
	);

	return {
		collapseSidebar,
		containerRef,
		expandSidebar,
		gridTemplateColumns,
		handleResizeStart,
		isCompactSplitLayout,
		isSidebarCollapsed,
		isSplitLayout,
		panelSizes,
		sidebarOverlayWidth: compactSidebarWidth,
	};
};
