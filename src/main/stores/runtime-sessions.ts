import { create } from "zustand";
import { serviceManager } from "@/services";
import type { SandboxServerInfo } from "@/services/sandbox-container";
import type { ActiveWebSessionInfo } from "@/services/web-browser";

export const RUNTIME_PANEL_BREAKPOINT = 1180;

const DEFAULT_WEB_SESSION: ActiveWebSessionInfo = {
	isOpen: false,
};

const getInitialWideViewport = (): boolean => {
	if (typeof window === "undefined") {
		return false;
	}

	return window.innerWidth >= RUNTIME_PANEL_BREAKPOINT;
};

export interface RuntimeSessionsState {
	servers: SandboxServerInfo[];
	activeWebSession: ActiveWebSessionInfo;
	isWideViewport: boolean;

	refresh: () => Promise<void>;
	setIsWideViewport: (isWideViewport: boolean) => void;
	getRuntimeCount: () => number;
	hasRuntime: () => boolean;
}

export const useRuntimeSessionsStore = create<RuntimeSessionsState>(
	(set, get) => ({
		servers: [],
		activeWebSession: DEFAULT_WEB_SESSION,
		isWideViewport: getInitialWideViewport(),

		refresh: async () => {
			try {
				const [serversResult, webSessionInfo] = await Promise.all([
					serviceManager.getSandboxContainerService().listServers(),
					serviceManager.getWebBrowserService().getActiveSessionInfo(),
				]);

				set({
					servers: serversResult.servers,
					activeWebSession: webSessionInfo,
				});
			} catch {
				// Runtime services are optional; preserve the last known state on failures.
			}
		},

		setIsWideViewport: (isWideViewport) => {
			set({ isWideViewport });
		},

		getRuntimeCount: () => {
			const { servers, activeWebSession } = get();
			return servers.length + Number(activeWebSession.isOpen);
		},

		hasRuntime: () => get().getRuntimeCount() > 0,
	}),
);
