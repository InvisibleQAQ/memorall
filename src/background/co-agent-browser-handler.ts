import { logError } from "@/utils/logger";
import { BACKGROUND_EVENTS } from "@/constants/events";
import {
	CO_AGENT_ACTIVE_SESSION_STORAGE_KEY,
	CO_AGENT_BROWSER_COMMAND_SOURCE,
	isCoAgentBrowserCommandRequest,
	isCoAgentContentCommandResponse,
	type CoAgentActiveSession,
	type CoAgentBrowserCommandRequest,
	type CoAgentBrowserCommandResponse,
	type CoAgentContentCommandRequest,
	type CoAgentContentCommandResponse,
} from "@/services/co-agent";

const DEFAULT_TIMEOUT_MS = 8_000;
const RESTORE_RETRY_DELAYS_MS = [120, 450, 1_000] as const;

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const createErrorResponse = (
	request: CoAgentBrowserCommandRequest,
	error: unknown,
): CoAgentBrowserCommandResponse => ({
	source: CO_AGENT_BROWSER_COMMAND_SOURCE,
	command: request.command,
	success: false,
	error: toErrorMessage(error),
});

const parseActiveSession = (value: unknown): CoAgentActiveSession | null => {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	if (typeof record.tabId !== "number") return null;
	return {
		tabId: record.tabId,
		windowId: typeof record.windowId === "number" ? record.windowId : undefined,
		url: typeof record.url === "string" ? record.url : undefined,
		title: typeof record.title === "string" ? record.title : undefined,
		enabledAt:
			typeof record.enabledAt === "number" ? record.enabledAt : Date.now(),
	};
};

const getActiveSessionOrNull =
	async (): Promise<CoAgentActiveSession | null> => {
		const storage = chrome.storage?.session;
		if (!storage) {
			throw new Error("Chrome session storage is unavailable.");
		}
		const result = await storage.get(CO_AGENT_ACTIVE_SESSION_STORAGE_KEY);
		const session = parseActiveSession(
			result[CO_AGENT_ACTIVE_SESSION_STORAGE_KEY],
		);
		if (!session) return null;
		const tab = await chrome.tabs.get(session.tabId).catch(() => null);
		if (!tab) {
			await storage.remove(CO_AGENT_ACTIVE_SESSION_STORAGE_KEY);
			return null;
		}
		return session;
	};

const getActiveSession = async (): Promise<CoAgentActiveSession> => {
	const session = await getActiveSessionOrNull();
	if (!session) {
		throw new Error("No active co-agent tab. Enable co-agent on a page first.");
	}
	return session;
};

const setActiveSession = async (
	tabId: number,
	tab?: chrome.tabs.Tab,
	existing?: CoAgentActiveSession,
): Promise<void> => {
	await chrome.storage?.session?.set?.({
		[CO_AGENT_ACTIVE_SESSION_STORAGE_KEY]: {
			tabId,
			windowId: tab?.windowId ?? existing?.windowId,
			url: tab?.url ?? existing?.url,
			title: tab?.title ?? existing?.title,
			enabledAt: existing?.enabledAt ?? Date.now(),
		} satisfies CoAgentActiveSession,
	});
};

const sendShowCoAgent = async (tabId: number): Promise<void> => {
	const tab = await chrome.tabs.get(tabId).catch(() => null);
	await chrome.tabs.sendMessage(tabId, {
		type: BACKGROUND_EVENTS.SHOW_CO_AGENT,
		tabId,
		url: tab?.url,
		mode: "general",
		displayMode: "popup",
		coAgentEnabled: true,
	});
};

const restoreCoAgentInTab = async (tabId: number): Promise<void> => {
	for (const delayMs of RESTORE_RETRY_DELAYS_MS) {
		await new Promise((resolve) => setTimeout(resolve, delayMs));
		try {
			await sendShowCoAgent(tabId);
			return;
		} catch {
			// Content scripts can arrive after tab completion on some pages; retry.
		}
	}
};

const maybeRestoreAfterNavigation = async (
	tabId: number,
	changeInfo: { status?: string },
	tab: chrome.tabs.Tab,
): Promise<void> => {
	if (changeInfo.status !== "complete") return;
	const storage = chrome.storage?.session;
	if (!storage) return;
	const result = await storage.get(CO_AGENT_ACTIVE_SESSION_STORAGE_KEY);
	const session = parseActiveSession(
		result[CO_AGENT_ACTIVE_SESSION_STORAGE_KEY],
	);
	if (!session || session.tabId !== tabId) return;
	await setActiveSession(tabId, tab, session);
	await restoreCoAgentInTab(tabId);
};

const clearSessionForClosedTab = async (tabId: number): Promise<void> => {
	const storage = chrome.storage?.session;
	if (!storage) return;
	const result = await storage.get(CO_AGENT_ACTIVE_SESSION_STORAGE_KEY);
	const session = parseActiveSession(
		result[CO_AGENT_ACTIVE_SESSION_STORAGE_KEY],
	);
	if (session?.tabId === tabId) {
		await storage.remove(CO_AGENT_ACTIVE_SESSION_STORAGE_KEY);
	}
};

const sendContentCommand = async (
	tabId: number,
	request: CoAgentContentCommandRequest,
	timeoutMs: number,
): Promise<CoAgentContentCommandResponse> => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(
			() => reject(new Error("Timed out waiting for co-agent content script.")),
			timeoutMs,
		);
	});

	try {
		const rawResponse = await Promise.race([
			chrome.tabs.sendMessage(tabId, request),
			timeout,
		]);
		if (!isCoAgentContentCommandResponse(rawResponse)) {
			throw new Error("Invalid co-agent content-script response.");
		}
		return rawResponse;
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
	}
};

const handleCommand = async (
	request: CoAgentBrowserCommandRequest,
	senderTabId?: number,
): Promise<CoAgentBrowserCommandResponse> => {
	if (request.command === "get-active") {
		const session = await getActiveSessionOrNull();
		if (!session) {
			return {
				source: CO_AGENT_BROWSER_COMMAND_SOURCE,
				command: request.command,
				success: false,
				error: "No active co-agent tab.",
			};
		}
		if (senderTabId !== undefined && session.tabId !== senderTabId) {
			return {
				source: CO_AGENT_BROWSER_COMMAND_SOURCE,
				command: request.command,
				success: false,
				error: "Co-agent is not active in this tab.",
			};
		}
		return {
			source: CO_AGENT_BROWSER_COMMAND_SOURCE,
			command: request.command,
			success: true,
			session,
		};
	}

	const session = await getActiveSession();
	const contentResponse = await sendContentCommand(
		session.tabId,
		request.request,
		request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);
	return {
		source: CO_AGENT_BROWSER_COMMAND_SOURCE,
		command: request.command,
		success: true,
		session,
		contentResponse,
	};
};

export function registerCoAgentBrowserHandler(): void {
	chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
		if (!isCoAgentBrowserCommandRequest(rawMessage)) {
			return false;
		}

		void handleCommand(rawMessage, sender.tab?.id)
			.then(sendResponse)
			.catch((error) => {
				logError("[CO_AGENT_BROWSER_HANDLER] Failed:", error);
				sendResponse(createErrorResponse(rawMessage, error));
			});
		return true;
	});

	chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
		void maybeRestoreAfterNavigation(tabId, changeInfo, tab).catch((error) => {
			logError("[CO_AGENT_BROWSER_HANDLER] Restore failed:", error);
		});
	});

	chrome.tabs.onRemoved.addListener((tabId) => {
		void clearSessionForClosedTab(tabId).catch((error) => {
			logError("[CO_AGENT_BROWSER_HANDLER] Cleanup failed:", error);
		});
	});
}
