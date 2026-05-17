import { useResponsiveWorkspacePanels } from "@/main/hooks/use-responsive-workspace-panels";

const PANEL_STORAGE_KEY = "memorall.agents.workspace-panels.v3";

export const useAgentsWorkspacePanels = () => {
	const {
		collapseSidebar,
		containerRef,
		expandSidebar,
		gridTemplateColumns,
		handleResizeStart,
		isCompactSplitLayout,
		isSidebarCollapsed,
		isSplitLayout,
		sidebarOverlayWidth,
	} = useResponsiveWorkspacePanels({ storageKey: PANEL_STORAGE_KEY });

	return {
		collapseSidebar,
		containerRef,
		expandSidebar,
		gridTemplateColumns,
		handleResizeStart,
		isDesktop: isSplitLayout,
		isCompactSplitLayout,
		isSidebarCollapsed,
		sidebarOverlayWidth,
	};
};
