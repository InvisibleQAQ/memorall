import { create } from "zustand";

export type RightWorkspaceTab = "page" | "agent";

interface ShellLayoutState {
	chatRailCollapsed: boolean;
	chatShellCollapsed: boolean;
	chatShellWidth: number;
	rightPanelCollapsed: boolean;
	mobileChatListOpen: boolean;
	rightWorkspaceTab: RightWorkspaceTab;
	mobileWorkspaceSheet: Exclude<RightWorkspaceTab, "page"> | null;
	setChatRailCollapsed: (collapsed: boolean) => void;
	setChatShellCollapsed: (collapsed: boolean) => void;
	setChatShellWidth: (width: number) => void;
	setRightPanelCollapsed: (collapsed: boolean) => void;
	setMobileChatListOpen: (open: boolean) => void;
	setRightWorkspaceTab: (tab: RightWorkspaceTab) => void;
	setMobileWorkspaceSheet: (
		sheet: Exclude<RightWorkspaceTab, "page"> | null,
	) => void;
}

export const useShellLayoutStore = create<ShellLayoutState>((set) => ({
	chatRailCollapsed: true,
	chatShellCollapsed: false,
	chatShellWidth: 42,
	rightPanelCollapsed: true,
	mobileChatListOpen: false,
	rightWorkspaceTab: "page",
	mobileWorkspaceSheet: null,
	setChatRailCollapsed: (chatRailCollapsed) => set({ chatRailCollapsed }),
	setChatShellCollapsed: (chatShellCollapsed) => set({ chatShellCollapsed }),
	setChatShellWidth: (chatShellWidth) => set({ chatShellWidth }),
	setRightPanelCollapsed: (rightPanelCollapsed) => set({ rightPanelCollapsed }),
	setMobileChatListOpen: (mobileChatListOpen) => set({ mobileChatListOpen }),
	setRightWorkspaceTab: (rightWorkspaceTab) => set({ rightWorkspaceTab }),
	setMobileWorkspaceSheet: (mobileWorkspaceSheet) =>
		set({ mobileWorkspaceSheet }),
}));
