import React from "react";
import { useLocation } from "react-router-dom";
import { serviceManager } from "@/services";
import type { SandboxServerInfo } from "@/services/sandbox-container";
import type { ActiveWebSessionInfo } from "@/services/web-browser";

export interface RuntimeSessionsState {
	servers: SandboxServerInfo[];
	activeWebSession: ActiveWebSessionInfo;
	runtimeCount: number;
	hasRuntime: boolean;
	refresh: () => Promise<void>;
	isWideChatRuntimeRailVisible: boolean;
}

const RUNTIME_PANEL_BREAKPOINT = 1180;
const DEFAULT_WEB_SESSION: ActiveWebSessionInfo = {
	isOpen: false,
};

const RuntimeSessionsContext = React.createContext<RuntimeSessionsState | null>(
	null,
);

export const RuntimeSessionsProvider: React.FC<{
	children: React.ReactNode;
}> = ({ children }) => {
	const location = useLocation();
	const [servers, setServers] = React.useState<SandboxServerInfo[]>([]);
	const [activeWebSession, setActiveWebSession] =
		React.useState<ActiveWebSessionInfo>(DEFAULT_WEB_SESSION);
	const [isWideViewport, setIsWideViewport] = React.useState(() => {
		if (typeof window === "undefined") {
			return false;
		}

		return window.innerWidth >= RUNTIME_PANEL_BREAKPOINT;
	});

	const refresh = React.useCallback(async () => {
		try {
			const [serversResult, webSessionInfo] = await Promise.all([
				serviceManager.getSandboxContainerService().listServers(),
				serviceManager.getWebBrowserService().getActiveSessionInfo(),
			]);

			setServers(serversResult.servers);
			setActiveWebSession(webSessionInfo);
		} catch {
			// Runtime services are optional; preserve the last known state on failures.
		}
	}, []);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	React.useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const updateViewport = () => {
			setIsWideViewport(window.innerWidth >= RUNTIME_PANEL_BREAKPOINT);
		};

		updateViewport();
		window.addEventListener("resize", updateViewport);
		return () => window.removeEventListener("resize", updateViewport);
	}, []);

	const isPopupSurface =
		typeof document !== "undefined" &&
		document.documentElement.dataset.uiSurface === "popup";
	const isWideChatRuntimeRailVisible =
		location.pathname === "/" && !isPopupSurface && isWideViewport;
	const runtimeCount = servers.length + Number(activeWebSession.isOpen);
	const hasRuntime = runtimeCount > 0;

	const value = React.useMemo<RuntimeSessionsState>(
		() => ({
			servers,
			activeWebSession,
			runtimeCount,
			hasRuntime,
			refresh,
			isWideChatRuntimeRailVisible,
		}),
		[
			activeWebSession,
			hasRuntime,
			isWideChatRuntimeRailVisible,
			refresh,
			runtimeCount,
			servers,
		],
	);

	return (
		<RuntimeSessionsContext.Provider value={value}>
			{children}
		</RuntimeSessionsContext.Provider>
	);
};

export const useRuntimeSessions = (): RuntimeSessionsState => {
	const context = React.useContext(RuntimeSessionsContext);
	if (!context) {
		throw new Error(
			"useRuntimeSessions must be used within a RuntimeSessionsProvider",
		);
	}

	return context;
};
