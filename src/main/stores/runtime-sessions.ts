import { create } from "zustand";
import { serviceManager } from "@/services";
import type {
	SandboxCommandInfo,
	SandboxServerInfo,
} from "@/services/sandbox-container";
import type { ActiveWebSessionInfo } from "@/services/web-browser";

const DEFAULT_WEB_SESSION: ActiveWebSessionInfo = {
	isOpen: false,
};

export interface RuntimeSessionsState {
	commands: SandboxCommandInfo[];
	servers: SandboxServerInfo[];
	activeWebSession: ActiveWebSessionInfo;

	refresh: () => Promise<void>;
	getRuntimeCount: () => number;
	hasRuntime: () => boolean;
}

export const useRuntimeSessionsStore = create<RuntimeSessionsState>(
	(set, get) => ({
		commands: [],
		servers: [],
		activeWebSession: DEFAULT_WEB_SESSION,

		refresh: async () => {
			try {
				const [commandsResult, serversResult, webSessionInfo] =
					await Promise.all([
						serviceManager.getSandboxContainerService().listCommands(),
						serviceManager.getSandboxContainerService().listServers(),
						serviceManager.getWebBrowserService().getActiveSessionInfo(),
					]);

				set({
					commands: commandsResult.commands,
					servers: serversResult.servers,
					activeWebSession: webSessionInfo,
				});
			} catch {
				// Runtime services are optional; preserve the last known state on failures.
			}
		},

		getRuntimeCount: () => {
			const { commands, servers, activeWebSession } = get();
			return commands.length + servers.length + Number(activeWebSession.isOpen);
		},

		hasRuntime: () => get().getRuntimeCount() > 0,
	}),
);
